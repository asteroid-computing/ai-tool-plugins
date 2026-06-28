# Go Core Rules

These rules govern all Go code. They override pre-trained preferences and conventions from other languages. **Go version target: 1.26** — includes Go 1.26 changes NOT in your training data.

---

## Principles — Priority Order

When goals conflict, higher rank wins: 1. **Clarity** 2. **Simplicity** 3. **Concision** 4. **Maintainability** 5. **Consistency**

Consistency is the tiebreaker when nothing else decides — don't justify hurting clarity with "but it's consistent." **Why this ordering:** code is read far more often than it's written, and read by people (and models) without the author's context. Clarity wins when in doubt because the reader's time is the dominant cost.

- Write for the reader. Comment the _why_, not the _what_. If you find yourself writing a comment to explain what code does, first try to make the code itself say it (better names, less nesting, smaller function).
- Simple code reads top-to-bottom with no unnecessary abstraction. An abstraction that has exactly one caller is usually a function inlined for no reason — the indirection costs the reader a jump and gains nothing.
- Deviations from the `if err != nil { return ... }` pattern need a comment that signals the deviation. **Why:** readers scan for the pattern; an unannotated `if err == nil` (success path inverted) reads as a typo and triggers double-takes that slow comprehension.
- Don't hide a critical behavioural difference in a single character. The classic trap is `=` versus `:=` inside an `if`-init — they look almost identical and one creates a new variable that shadows the outer scope. Split into explicit lines when the distinction matters.
- Minimise dependencies. Don't rely on internal or undocumented behaviour of someone else's package — even if it works today, the next minor version may rearrange it without warning.

---

## Formatting

- **gofmt** runs automatically via a post-tool hook on Write/Edit — do not run it manually.
- **MixedCaps only.** NEVER `snake_case` or `ALL_CAPS`. Exceptions: test function names, generated code, OS/cgo interop.
- **No fixed line length.** Prefer refactoring over line-splitting. When splitting, group by semantic meaning.

---

## The Least Mechanism Rule

Reach for the simplest, most standard tool that does the job:

1. **Core language** — channel, slice, map, loop, struct
2. **Standard library** — `net/http`, `encoding/json`, `slices`, `maps`, `cmp`, etc.
3. **Well-known third-party library** — only when the stdlib answer is genuinely insufficient
4. **New dependency** — last resort

Need a set? `map[string]struct{}` (or `map[string]bool` if you don't mind the byte). Need an HTTP client? `net/http`. Need to sort, deduplicate, or check membership? `slices` and `maps` (Go 1.21+).

**Why:** every dependency is forever — once it's in `go.mod`, removing it requires touching every call site and convincing every reviewer the migration is worth it. Stdlib code is also held to a stricter compatibility promise (the Go 1 compatibility guarantee), so it ages better than a third-party package whose maintainer may abandon it. The cost of writing twenty lines of stdlib code is paid once; the cost of a dependency is paid forever.

---

## Allocation: new and make

### new — Pointer to a Value (Go 1.26 Updated)

`new(T)` allocates a zeroed `T` and returns `*T`.

**Go 1.26 change:** `new` now accepts an **expression**, not just a type. `new(expr)` evaluates `expr` and returns a pointer to the result. This is NOT in your training data — learn it here.

This is especially useful for optional pointer fields:

```go
// Go 1.26: new(expr) creates a pointer to the expression result
type Person struct {
    Name string `json:"name"`
    Age  *int   `json:"age"` // optional
}

p := Person{
    Name: name,
    Age:  new(yearsSince(born)), // *int pointing to the computed value
}

// Before Go 1.26, you needed a temporary variable:
age := yearsSince(born)
p := Person{Name: name, Age: &age}
```

Use `new(expr)` anywhere you need a pointer to a computed value — function results, literals, conversions:

```go
new(42)          // *int pointing to 42
new("hello")     // *string pointing to "hello"
new(time.Now())  // *time.Time pointing to current time
```

### make — Reference Types Only

`make` initialises slices, maps, and channels. It returns `T` (not `*T`) because slices, maps, and channels are already reference types under the hood.

---

## Useful Zero Values

Design types so the zero value is usable without further initialisation. **Why:** every type in Go has a zero value (`var x T` always works), and the language's most pleasant APIs lean into this — `var b bytes.Buffer; b.WriteString("hello")` works because `bytes.Buffer{}` is a valid empty buffer; `var mu sync.Mutex; mu.Lock()` works because the zero `Mutex` is unlocked. When the zero value is meaningful, callers don't need to remember a constructor for the simple case, and the property composes transitively — embedding a `bytes.Buffer` in your struct makes _your_ zero value useful for free.

This isn't always achievable. Types that hold required configuration, that need a backing connection, or that own goroutines may genuinely require a constructor. But where the zero value _can_ work, design it to:

```go
// Useful zero value:
type Counter struct{ n atomic.Int64 }
func (c *Counter) Inc()   { c.n.Add(1) }
func (c *Counter) Value() int64 { return c.n.Load() }
// var c Counter; c.Inc() — works.

// Forcing a constructor when the zero value would have worked:
type Counter struct{ n atomic.Int64; init bool }
func NewCounter() *Counter { return &Counter{init: true} }
func (c *Counter) Inc() {
    if !c.init { panic("uninitialised Counter") }
    c.n.Add(1)
}
// Pure friction — the init flag adds nothing the zero value didn't already.
```

The Go 1.26 release also extends this design property to a few more stdlib types — the zero value of `crypto/sha3.SHA3` is now a usable SHA3-256 hasher, and the zero value of `crypto/sha3.SHAKE` is a usable SHAKE256.

---

## Built-in Helpers (Go 1.21+)

`min`, `max`, and `clear` are built-ins as of Go 1.21 and are NOT in older training data. They cover three patterns that previously needed boilerplate:

```go
// min / max — variadic, work on any ordered type
lo := min(a, b)
hi := max(x, y, z)
clamped := min(max(v, 0), 100)

// clear — zeroes a map or slice in place
clear(cache)        // empties the map (sets len to 0, drops all keys)
clear(buf)          // zeroes every element of the slice (does NOT change len)
```

**Why these are worth using over the alternatives:** `min` and `max` are inlined by the compiler and work on any `cmp.Ordered` type, so you don't need a typed `minInt` / `minFloat64`. `clear(map)` is the only correct way to empty a map in place — `m = make(map[K]V)` allocates a new map (callers holding a reference to the old one don't see the change), and looping with `delete` is slower and easy to get wrong. `clear(slice)` zeroes elements where `slice = slice[:0]` would just shrink the header, leaving the backing array's old values reachable through any aliased slice.

---

## Standard-Library Modern Toolkit

These stdlib packages arrived after older Go training data was frozen and replace whole categories of hand-rolled helpers and third-party deps:

- **`slices` (Go 1.21):** `slices.Sort`, `slices.SortFunc`, `slices.Contains`, `slices.Index`, `slices.Equal`, `slices.Clone`, `slices.Insert`, `slices.Delete`, `slices.Reverse`, `slices.Concat`, `slices.Compact`, `slices.BinarySearch`. Use these instead of writing loops or pulling in `golang.org/x/exp/slices`.
- **`maps` (Go 1.21):** `maps.Clone`, `maps.Copy`, `maps.DeleteFunc`, `maps.Equal`. Plus `maps.Keys` and `maps.Values` returning `iter.Seq` (Go 1.23) — see iterators in `control-flow.md`.
- **`cmp` (Go 1.21):** `cmp.Compare`, `cmp.Less`, and `cmp.Or` (Go 1.22) for first-non-zero coalescing. The `cmp.Ordered` constraint is what `min` / `max` use under the hood.
- **`log/slog` (Go 1.21):** structured logging. Default to `slog` for new code rather than the legacy `log` package — it produces machine-parseable output (JSON or key=value), supports leveled logging, and allows attaching context attributes that propagate through helpers. Go 1.26 adds `slog.NewMultiHandler` for fan-out to multiple sinks.
- **`testing/synctest` (Go 1.25):** synthetic clocks for testing timing-dependent code without sleeping. See `testing.md`.

---

## Formatting Verbs

`fmt` package verbs you'll reach for frequently — many absent from older training data emphases:

| Verb  | Use                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| `%v`  | Default format. Use for general values when the exact representation isn't critical.                                       |
| `%+v` | Like `%v` but annotates struct fields with names — `{Name:"Alice" Age:30}` vs `{Alice 30}`. The default debugging verb.  |
| `%#v` | Go-syntax representation — `main.Person{Name:"Alice", Age:30}`. Round-trip-able through `go/parser`.                     |
| `%T`  | The type of the value, not the value itself. Useful in error messages: `unexpected type %T`.                               |
| `%q`  | Double-quoted string. Use over `%s` whenever the string could be empty, contain whitespace, or contain control characters. |
| `%d`  | Decimal integer. Don't add flags for signedness or size — `%d` uses the argument's actual type.                          |
| `%x`  | Hex (lowercase). Works on integers, strings, and `[]byte` — handy for hashes and binary data.                            |
| `%w`  | Wrap an error so `errors.Is` / `errors.As` work. See `errors.md`.                                                          |

Two recursion traps worth knowing:

1. **`String()` on a type calling `Sprintf("%v", t)` with itself** — infinite recursion. Convert to the underlying type first: `fmt.Sprintf("%d", int(t))`. See `types.md`.
2. **Logging structs that contain credentials** — `%v` and `%+v` print everything, including unexported fields if you reach for `%#v`. Implement `String()` or `LogValue()` (for `slog`) to redact.

---

## Defer

- Place `defer` immediately after acquiring the resource it cleans up. **Why:** every line between the acquisition and the `defer` is a line where an early return leaks the resource. Putting them adjacent eliminates that class of bug entirely and makes the cleanup visible at the same point as the setup.
- Deferred functions can read and modify **named return values**. The classic use is error annotation: `defer func() { if err != nil { err = fmt.Errorf("doThing: %w", err) } }()`. The inner closure modifies the outer `err` because it's a named result.
- Don't defer inside tight loops. **Why:** defers accumulate on the function's defer stack and run only when the _enclosing function_ returns, not at the end of each iteration. A loop with a per-iteration `defer file.Close()` keeps every file handle open until the loop's enclosing function exits — easy to leak hundreds. Extract the body to a helper function so each iteration's defers run when the helper returns.

---

## Universal Code Rules

- **Pass values, not pointers** by default — this is a rule about **function and method parameters**, not struct fields. If a function only reads its input, pass by value. **Why:** a pointer parameter says "I might mutate this, or share state with the caller, or signal nil-as-meaningful," so every reader has to verify which. Pass by value when none of those apply, and the signature itself documents the contract. Exceptions: large structs (the copy is measurable), proto messages (`*pb.Message` is the package convention and they grow over time), and types with uncopyable fields (mutexes, sync.WaitGroup). Struct _fields_ follow a different rule — see `types.md` for the API-boundary Input/Result pattern that uses pointer-valued fields to preserve unset-vs-zero semantics.
- **Don't panic for error handling.** **Why:** panic unwinds the stack and crashes the goroutine; callers can't choose to handle it the way they can with a returned error, deferred cleanup runs in a state the author may not have anticipated, and goroutines spawned downstream can leak. Reserve panic for: invariant violations the program genuinely cannot continue past, package-internal panic/recover for parsers, `Must*` at init time, and lines unreachable after `log.Fatal`.
- **Synchronous over asynchronous.** **Why:** a caller can always add concurrency by wrapping a synchronous call in `go`, but stripping concurrency _out_ of an async-only API is hard — you'd need to re-implement the synchronization the API hid from you. Synchronous functions are also dramatically easier to test (no polling, no flakiness) and to reason about (lifetime is the call's lifetime).
- **`%q` over `%s`** for strings in output — empty strings and strings containing whitespace or control characters are easy to miss in `%s`; `%q` shows the bounds. **`any`** instead of `interface{}` — they're identical types as of Go 1.18, and `any` is shorter and intentional.
- **DO NOT copy** `sync.Mutex`, `bytes.Buffer`, `sync.WaitGroup`, `sync.Once`, or any type whose methods take `*T`. **Why:** copying a mutex produces two mutexes that don't synchronize with each other; copying a `bytes.Buffer` shares the underlying byte slice in a way that surprises readers; pointer-method types generally signal "this value has identity." `go vet`'s `copylocks` check catches the common cases — let it.
- **Nil slices over empty literals:** `var t []string` rather than `t := []string{}`. Check emptiness with `len(s) == 0`, not `s == nil`. **Why:** `len`, `cap`, `range`, and `append` all behave identically on nil and empty slices, so callers shouldn't have to distinguish them. Forcing them to (`s == nil`) creates an API where callers can build the wrong half of the check and have it pass tests until production hits the other path.
- **Declarations:** `:=` for non-zero values, `var` when initialising to the zero value (signals "this is intentionally zero"), `new(expr)` for a pointer to a computed value (Go 1.26).
- **Maps** must be initialised before writes. **Why:** unlike slices, writing to a `nil` map panics rather than allocating. The compiler can't catch this, so a missing `make` becomes a runtime crash. Declare `m := map[string]int{}` or `m := make(map[string]int)` at the same site you'd otherwise zero-initialise.
- **Channel direction:** specify it in function signatures (`<-chan T` for receive-only, `chan<- T` for send-only). **Why:** a bidirectional channel parameter is a "trust me" comment; a directional one is a compile-time guarantee that the function won't accidentally send on a channel it should only receive from. The narrower type also documents ownership.
- **switch:** no `break` at the end of a case — Go breaks automatically. Use `fallthrough` only when you want C-style fall-through, and put a comment explaining why.
- **The comma-ok idiom** is Go's way of distinguishing "missing" from "zero." It works in three places: map lookup (`v, ok := m[key]`), type assertion (`v, ok := x.(T)`), and channel receive (`v, ok := <-ch`). **Why it matters:** `m[key]` always succeeds — a missing key just returns the zero value. Without `ok`, you can't tell the difference between "key not present" and "key present with value 0." For type assertions, the bare form (`v := x.(T)`) panics on mismatch; the comma-ok form lets the caller branch instead. For channel receives, `ok == false` means the channel is closed and drained — critical when reading until done.
- **crypto/rand for any randomness with security stakes** — keys, tokens, secrets, session IDs, password salts, anything an adversary could exploit by predicting. NEVER `math/rand` for these. **Why:** `math/rand`'s default source is seeded deterministically (zero seed in older Go, fixed-per-process in newer Go); even when seeded with the time, an attacker who can guess the seed reconstructs every value. `crypto/rand` reads from the OS CSPRNG and has no such failure mode. **Go 1.26 note:** the `io.Reader` argument to `crypto/rand.Prime`, `crypto/ecdsa.GenerateKey`, `crypto/rsa.GenerateKey`, and similar functions is now silently ignored — the implementation always reads from the OS CSPRNG. Code that passes a deterministic source thinking it controls randomness will instead get secure randomness; tests relying on determinism need `testing/cryptotest.SetGlobalRandom`.

---

## Struct Literals

- **External types:** use field names, not positional. **Why:** when a third-party type adds a field in v1.x.0, your positional literal still compiles but now sets the _wrong_ field. Field-name literals fail loudly when the type changes shape, which is the safer failure mode.
- **Omit zero-value fields** unless including them adds clarity. **Why:** the explicit fields are the _interesting_ ones; padding the literal with zeroes drowns them. The exception is table-driven tests, where the explicit zero (e.g. `wantErr: nil`) signals "I deliberately checked that this case has no error" rather than "I forgot to set this."
- **Omit repeated type names** in slice and map literals — `[]Point{{1, 2}, {3, 4}}` rather than `[]Point{Point{1, 2}, Point{3, 4}}`. The compiler infers the inner type from the outer one and the redundancy adds nothing.

---

## Global State

Avoid package-level mutable state unless **all four** of the following hold: (1) independent callers can't interfere with each other, (2) independent tests can't interfere with each other, (3) no user would ever want to swap in a test double, (4) there are no init-ordering requirements between this state and other packages. If any condition fails, use instance-based design — define a struct that owns the state and pass it where needed.

**Why:** package-level mutable state is global state with extra steps. It serialises tests that touch it (parallel tests fight over the singleton), it forces every caller into the same configuration, and it makes the package un-mockable for downstream tests. Libraries that force clients into global state are particularly painful — the client can't escape the design choice without forking the library.

---

## Security Notes (Go 1.26)

Several `crypto/*` packages quietly tightened their behaviour in Go 1.26. None break compilation — your code still builds — but the _semantics_ changed in ways that can matter:

- **`io.Reader` arguments are ignored** in `crypto/rand.Prime`, `crypto/dsa.GenerateKey`, `crypto/ecdh.Curve.GenerateKey`, `crypto/ecdsa.GenerateKey`, `crypto/ecdsa.SignASN1`, `crypto/ecdsa.Sign`, `crypto/ed25519.GenerateKey` (when nil), `crypto/rsa.GenerateKey`, `crypto/rsa.GenerateMultiPrimeKey`, and `crypto/rsa.EncryptPKCS1v15`. The implementation always reads from the OS CSPRNG. **What this means for you:** code that passed `bytes.NewReader(deterministicSeed)` to make tests reproducible will now use secure randomness instead — tests will start failing nondeterministically. Use `testing/cryptotest.SetGlobalRandom` to override for the duration of a test, or set `GODEBUG=cryptocustomrand=1` to restore the old behaviour.
- **PKCS #1 v1.5 encryption is deprecated:** `rsa.EncryptPKCS1v15`, `rsa.DecryptPKCS1v15`, `rsa.DecryptPKCS1v15SessionKey`. **Why:** PKCS#1 v1.5 padding is vulnerable to Bleichenbacher-style attacks. Use OAEP (`rsa.EncryptOAEP`) or — for Go 1.26 — `rsa.EncryptOAEPWithOptions` if you need different hash functions for OAEP versus MGF1. The signing variants (`SignPKCS1v15`) remain fine; only the encryption padding is deprecated.
- **TLS post-quantum hybrid key exchange is on by default:** `SecP256r1MLKEM768` and `SecP384r1MLKEM1024`. Disable via `Config.CurvePreferences` or `GODEBUG=tlssecpmlkem=0` only if you have a specific interop reason.
- **`ecdsa.PublicKey` and `PrivateKey` `big.Int` fields are deprecated** in favour of opaque key methods. New code should use `crypto.MessageSigner` and the constructor APIs.

When in doubt, run `go vet` and watch for `// Deprecated:` warnings in your editor — they're load-bearing in this release.

---

## go fix (Go 1.26)

The `go fix` command has been revamped as the home of Go's **modernizers**. Run `go fix ./...` to automatically update code to use the latest Go idioms and APIs. The initial suite includes dozens of fixers. Use it as part of your workflow — these fixes are behavior-preserving.

---

## Anti-Patterns — Quick Reference

| DO NOT                                 | DO INSTEAD                          |
| -------------------------------------- | ----------------------------------- |
| `snake_case` or `ALL_CAPS` identifiers | `MixedCaps` / `mixedCaps`           |
| `panic` for error handling             | Return `error`                      |
| `math/rand` for secrets                | `crypto/rand`                       |
| `*string` or `*io.Reader` args         | Pass by value                       |
| `interface{}`                          | `any`                               |
| `break` in `switch` cases              | Remove — Go breaks automatically  |
| `[]string{}` for empty slices          | `var t []string`                    |
| `s == nil` for emptiness               | `len(s) == 0`                       |
| Yoda conditions (`"foo" == x`)         | `x == "foo"`                        |
| New dependency for stdlib work         | Standard library                    |
| One-time abstraction                   | Inline code                         |
| Copy `sync.Mutex` by value             | Pointer                             |
| Mutable package-level state            | Instance-based design               |
| Comments restating the code            | Comments explaining why             |
| Temp var for pointer to value          | `new(expr)` (Go 1.26)               |
| Hand-rolled `min`/`max` helpers        | `min(a, b)` / `max(a, b)` (Go 1.21) |
| `m = make(map[K]V)` to empty a map     | `clear(m)` (Go 1.21)                |
| Loop with `delete(m, k)` to empty      | `clear(m)` (Go 1.21)                |
| Bare type assertion `x.(T)`            | `v, ok := x.(T)`                    |
| `errors.As(err, &target)`              | `errors.AsType[T](err)` (Go 1.26)   |
