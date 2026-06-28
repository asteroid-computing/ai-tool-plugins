# Go Control Flow Rules

---

## Core Rule

Go uses indentation to signal scope. Don't line-break a control structure so the continuation lines look like the body — readers scanning the indentation will mistake the wrapped condition for code that runs inside the `if`/`for`. **Why:** Go has no other visual delimiter for "this is still the condition" — there's no parenthesis layout the way C++ does it. The reader's only cue is indentation, and a wrapped condition that lands at body indentation lies to that cue.

## If Statements

Don't split an `if` condition across lines. If the condition is genuinely too long, extract the operands into named boolean variables; the names also document what each clause is _for_:

```go
// Bad: split condition looks like body
if db.CurrentStatusIs(db.InTransaction) &&
    db.ValuesEqual(db.TransactionKey(), row.Key()) {

// Good: named booleans
inTransaction := db.CurrentStatusIs(db.InTransaction)
keysMatch := db.ValuesEqual(db.TransactionKey(), row.Key())
if inTransaction && keysMatch {
```

Error flow: handle errors first and return early. Don't put the success path inside an `else`. **Why:** the reader's eye scans the left margin for the happy path; nesting it in `else` pushes it right and forces them to mentally invert each error branch to follow the normal flow.

## For Loops

Don't line-break a `for` statement either — the same indentation-confusion problem applies, and `for` clauses are usually shorter than the `if` conditions that motivated this rule. Let the line be long, or extract pieces into local variables before the loop.

### The Three Forms of `for`

```go
for init; condition; post { }   // C-style
for condition { }               // C-style "while"
for { }                         // infinite loop
```

Go has no `while` keyword — `for condition { }` _is_ the while loop. Go has no `do-while` either; emulate it with `for { ...; if !cond { break } }`.

### Range Forms

`range` is the workhorse loop construct. The forms it accepts have grown significantly:

```go
// Slices and arrays — index, value
for i, v := range s { ... }
for i := range s { ... }     // index only
for _, v := range s { ... }  // value only

// Maps — key, value (iteration order is randomized)
for k, v := range m { ... }

// Channels — receive until closed
for v := range ch { ... }

// Strings — yields rune (code point) and the byte index where it starts
for i, r := range "héllo" { ... }  // r is rune, not byte

// Integer range (Go 1.22+) — iterate 0..n-1
for i := range 10 { ... }    // i = 0, 1, 2, ..., 9

// Function iterators (Go 1.23+) — see below
for v := range mySeq { ... }
for k, v := range mySeq2 { ... }
```

**Range over string yields runes, not bytes.** **Why this matters:** `len("héllo") == 6` (bytes), not `5`. Iterating with `for i := 0; i < len(s); i++` gives you bytes; iterating with `for i, r := range s` gives you runes and the _byte_ index where each rune begins. Choosing the wrong one corrupts non-ASCII text — a bug that won't surface until someone enters their name with an accent.

**Integer range (Go 1.22+):** `for i := range n` is the idiomatic counted loop now — shorter than `for i := 0; i < n; i++` and it can't suffer from off-by-one mistakes in the bounds.

### Function Iterators (Go 1.23+)

A function with one of these signatures is a `range`-able iterator:

```go
type (
    Seq[V]     = func(yield func(V) bool)
    Seq2[K, V] = func(yield func(K, V) bool)
)
```

The iterator function calls its `yield` parameter for each value; if `yield` returns `false`, the iterator stops (the consumer broke out of the loop). The standard library uses these heavily as of Go 1.23: `slices.All`, `slices.Values`, `maps.Keys`, `maps.Values`, `strings.Lines`, `strings.SplitSeq`, `bytes.Lines`.

```go
// Iterate map keys without materialising a slice:
for k := range maps.Keys(m) { ... }

// Iterate lines from a string without splitting up front:
for line := range strings.Lines(text) { ... }

// Write your own:
func Squares(n int) iter.Seq[int] {
    return func(yield func(int) bool) {
        for i := range n {
            if !yield(i * i) {
                return
            }
        }
    }
}

for sq := range Squares(5) {
    fmt.Println(sq)  // 0 1 4 9 16
}
```

**Why iterators were added:** before Go 1.23, exposing a sequence meant returning a slice (eager allocation), exposing a channel (concurrency overhead), or inventing a custom interface with `Next()` / `Value()` (verbose at the call site). Iterators give you lazy, one-line consumption without any of those costs.

### Loop Variable Scoping (Go 1.22+ change — IMPORTANT)

In Go 1.21 and earlier, the loop variable in a `for` was _shared_ across iterations:

```go
// Pre-1.22 trap:
var fns []func()
for _, v := range []int{1, 2, 3} {
    fns = append(fns, func() { fmt.Println(v) })
}
// All three closures print 3 — they captured the same `v`.
```

**Go 1.22 changed this:** each iteration gets its own `v`, and the example above prints `1 2 3`. **Why this matters:** code that _relied on_ the shared-variable behaviour (rare, usually accidental) now behaves differently; code that worked around it with `v := v` shadowing now has a redundant copy. The new behaviour is what nearly every developer expected from the start, so the change fixes more code than it breaks — but if you're reading older code that captures loop variables in goroutines or closures, the semantics depend on the module's `go` directive in `go.mod`.

The conservative pattern (`v := v` inside the loop body before the closure) still works under both versions and is harmless.

### Labeled `break` and `continue`

`break` and `continue` apply to the _innermost_ enclosing `for`, `switch`, or `select`. To break out of an outer loop from inside a `switch` or nested loop, label the outer loop and reference the label:

```go
Outer:
for _, row := range grid {
    for _, cell := range row {
        switch {
        case cell.Invalid():
            break Outer       // exits the outer for, not just the switch
        case cell.Skip():
            continue Outer    // next iteration of the outer for
        }
    }
}
```

Without labels, a bare `break` inside the `switch` would only exit the switch and the outer loop would continue. Use labels sparingly — they're powerful but make control flow harder to follow.

## Switch

Each case stays on one line where possible; case bodies that need real code go on subsequent indented lines. Don't write redundant `break` at the end of cases (Go breaks automatically) and don't write Yoda conditions (`if "foo" == x`) — these are habits from languages where assignment-in-condition is a problem Go doesn't have.

Cases can group multiple values with commas — `case 1, 2, 3:` rather than three separate cases.

A `switch` with no expression switches on `true`, which gives you a clean if-else-if chain:

```go
switch {
case n < 0:
    return "negative"
case n == 0:
    return "zero"
default:
    return "positive"
}
```

Prefer this form over a long chain of `if`/`else if` when the conditions are independent — the structure makes the cases parallel.

### Type Switches

A type switch dispatches on the dynamic type of an interface value. The idiom is to _reuse the variable name_ with the asserted type — each case sees its own correctly-typed `v`:

```go
switch v := x.(type) {
case nil:
    // v is the typed nil
case int:
    fmt.Println("int:", v + 1)       // v has type int here
case string:
    fmt.Println("string:", len(v))   // v has type string here
case io.Reader:
    io.Copy(os.Stdout, v)            // v has type io.Reader here
default:
    fmt.Printf("unhandled %T\n", v)  // v has type any in default
}
```

**Why this is preferable to chained `errors.As`/`x.(T)` calls:** the compiler narrows the type _inside each case automatically_, so you don't need a fresh assertion in every branch. Type switches also handle the `nil` case explicitly, which a chain of single-type assertions doesn't.

### Type Assertions (outside type switches)

For type assertions, use the comma-ok form (`v, ok := x.(string)`) rather than the panic form (`v := x.(string)`). **Why:** the bare assertion panics on a type mismatch, which crashes the goroutine and may take down the request. The comma-ok form gives the caller a chance to handle the mismatch with a normal `if` branch. Reserve bare assertions for cases where a mismatch genuinely is a programmer bug worth panicking on (e.g. recovering a value you yourself stored into a `context.Context` and know the type of).

## Function Calls

Keep a call on one line. If it's getting long, factor arguments into named locals before the call — the names document what each argument is _for_. Splitting a call across lines by semantic grouping is the last resort for genuinely unavoidable long calls.

## Decision Tree (too long for one line?)

1. **If:** extract booleans into named variables
2. **For:** extract conditions into the body
3. **Switch:** indented-all-cases pattern for extreme lists
4. **Call:** factor out locals, then semantic grouping
5. **Signature:** redesign the API

In ALL cases: prefer refactoring over line-breaking.
