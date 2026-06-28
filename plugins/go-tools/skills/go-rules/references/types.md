# Go Type Rules

**Go 1.26:** Self-referential generic type constraints are now legal. NOT in your training data.

---

## Interfaces

**Interfaces belong in the consumer package, not the implementation package.** The package that _uses_ the abstraction defines the interface listing exactly the methods it needs; the package that provides the implementation returns a concrete type. **Why:** if the producer defines the interface, every consumer is forced to depend on whichever set of methods the producer chose to expose, even when they only need one. Consumer-defined interfaces are minimal by construction (the consumer lists what it actually calls), they document the consumer's needs in the consumer's own code, and they avoid an import dependency from consumer → producer at the type level.

- Don't define an interface before you have a concrete use case. Wait for either two implementations to materialise or a clear external need (e.g. a test double). **Why:** "I'll add an interface so it's easier to mock later" almost always produces an interface that exactly mirrors one struct's methods — which is a useless abstraction that costs every reader an extra type to navigate.
- Don't export interfaces that package users don't need.
- Don't export test doubles via interfaces — consumers define their own minimal interfaces for their own testing needs.
- Use a compile-time check when an interface's implementation is non-obvious: `var _ json.Marshaler = (*RawMessage)(nil)`. **Why:** this fails at compile time if `RawMessage` ever stops satisfying `json.Marshaler` (a method renamed, a signature changed). Without it, the breakage surfaces at runtime as a missing dispatch — usually in production, far from the change that caused it.

### Function Types Implementing Interfaces (the adapter pattern)

A method can be defined on _any_ named type — including a function type. This lets a plain function satisfy an interface, which is the trick behind `http.HandlerFunc`:

```go
// http.HandlerFunc adapts an ordinary function into http.Handler:
type HandlerFunc func(http.ResponseWriter, *http.Request)

func (f HandlerFunc) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    f(w, r)  // the receiver IS a function; call it
}

// Now any matching function satisfies http.Handler without a struct:
http.Handle("/hello", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintln(w, "hi")
}))
```

**When to use this pattern:** when an interface has exactly one method and you want to let callers pass a function literal instead of forcing them to declare a struct that wraps a function. Pure adapter — no state, no construction ceremony.

**When not to use it:** when the implementation needs state. A `type Counter func(...)` can't carry a counter across calls because the receiver is the function itself, not a struct that owns the count. For stateful implementations, use a struct.

The standard library uses this pattern in `http.HandlerFunc`, `sort.SliceStable`'s `less` parameter, and many test-double helpers. It's idiomatic; reach for it whenever a one-method interface is being implemented by something stateless.

## Generics

Try existing language features first; reach for generics only when the alternative is significantly worse. The test: "Will more than one concrete type instantiate this?" If the answer is no, don't use generics — write the function for the one type you have.

**Why:** generics put a parsing tax on every reader. `func Find[T comparable](s []T, v T) int` is harder to read at a glance than `func FindString(s []string, v string) int`. The cost is paid every read; the benefit (code reuse across types) is paid once at write. Generics earn their keep when the alternative is duplicating substantial logic across types or boxing through `any` — not when the alternative is one extra typed function.

Don't use generics to build DSLs, error-handling frameworks, or assertion libraries. **Why:** these uses produce code where the _type machinery_ is the load-bearing part, not the actual logic. A custom `Result[T, E]` type or `Assert[T any]` helper looks elegant in isolation and turns every call site into a puzzle. Go's existing tools — multiple return values, `error`, `cmp.Diff` with explicit messages — solve these problems with code that reads top-to-bottom.

### Self-Referential Constraints (Go 1.26)

Go 1.26 lifts the restriction on generic types referring to themselves:

```go
type Adder[A Adder[A]] interface {
    Add(A) A
}

func algo[A Adder[A]](x, y A) A {
    return x.Add(y)
}
```

### Generic Type Aliases (Go 1.24)

As of Go 1.24, type aliases can carry type parameters:

```go
// Alias for a frequently-used parameterised type:
type Set[T comparable] = map[T]struct{}

// Now Set[string] is just shorthand for map[string]struct{}.
```

**Why this matters:** before Go 1.24, an alias could only refer to a fully-instantiated generic type (`type StringSet = map[string]struct{}`). Generic aliases let you define shorthand for a family of types — useful when migrating a package from a non-generic API to a generic one without breaking existing code.

The `gotypesalias` GODEBUG that controlled the older partial implementation will be **removed in Go 1.27**; new code should assume generic aliases work and produce real `Alias` types from `go/types`.

## Embedding

Embedding promotes the inner type's methods onto the outer type. Interface embedding composes interfaces (a `ReadWriter` is anything that satisfies both `Reader` and `Writer`); struct embedding borrows methods so the outer type implements the inner's interface for free.

- Embedded pointer fields must be initialised before use, or method calls through them will nil-deref. **Why:** unlike value embedding, where the inner field is part of the struct's memory and zero-initialised automatically, an embedded `*Logger` defaults to `nil`. Either make the constructor populate it or use value embedding.
- The receiver of a promoted method is the _inner_ type, not the outer. So a method defined on `*Logger` and promoted onto `*Job` still sees `*Logger` as its receiver — it cannot reach the outer `*Job`'s other fields. **Why this matters:** embedding is _not_ inheritance. If you find yourself needing the outer type from a promoted method, you actually want a forwarding method, not embedding.
- Outer fields and methods hide same-name embedded ones. To override a promoted method, define the same name on the outer type and (if needed) call the embedded version explicitly via the embedded type's name: `j.Logger.Print(...)`.

## Type Conversions

Convert between types with the same underlying type to access a different method set — `sort.IntSlice([]int{...})` for example, which gives a plain `[]int` access to `sort.Interface`'s methods.

**String() recursion trap:** in a `String()` method on type `T`, don't pass the receiver itself to `Sprintf` with `%s`, `%v`, or `%q` — that triggers `String()` again, infinitely. Convert to the underlying type first: `fmt.Sprintf("%d", int(t))` rather than `fmt.Sprintf("%v", t)`. **Why:** `fmt`'s formatting routines call `String()` on anything that implements `Stringer`, so a recursive call is the easiest stack-overflow bug to write in Go. The conversion strips the methods so the inner call sees a plain `int` (or whatever the underlying type is) and formats it directly.

---

## Receiver Types — Value vs Pointer

Decision tree, first match wins:

**Pointer required** — the choice is forced:

- The method mutates the receiver (a value receiver gets a copy and the mutation is invisible to the caller).
- The struct contains uncopyable fields (`sync.Mutex`, `sync.WaitGroup`, `bytes.Buffer`).
- The struct is large enough that copying it on every call is measurable (rule of thumb: a few cache lines, or anything with a meaningful number of fields).
- The struct holds pointer fields that the method mutates through.

**Value required** — using a pointer would be wrong:

- The receiver is a map, function, or channel (these are already reference types; a `*map[K]V` is almost always a mistake).
- The receiver is a built-in type or named scalar and the method doesn't mutate.
- The receiver is a slice and the method doesn't reslice or reallocate.

**Value preferred** when both are correct: small structs with no mutable fields and no internal pointers. **Why:** value receivers communicate "this method observes, doesn't change" — the type system carries the contract.

**Pointer preferred** when both are correct: types under concurrent access (so all methods see the same instance), types likely to grow new mutating methods later, types whose identity matters. **When genuinely in doubt, pick pointer** — adding mutation later doesn't require changing every receiver.

**Consistency:** all methods on a single type should use the same receiver kind. **Why:** mixing receivers makes the method set confusing — a value of `T` has access to value-receiver methods but not pointer-receiver ones, and a `*T` has both. When a type's method set splits across both kinds, callers spend time figuring out which form they need to call which method, and Go's automatic addressing rules paper over the inconsistency just enough to leave subtle bugs around interface satisfaction (a value `T` does _not_ satisfy an interface whose methods have pointer receivers).

---

## Type Definitions vs Aliases

- **Type definition** (`type T1 T2`) creates a _new, distinct_ type with its own method set. Use for semantic types — `type UserID int64` lets you accept `UserID` parameters that the compiler keeps separate from raw `int64`s, so passing a `ProductID` where a `UserID` was expected is a type error rather than a runtime bug.
- **Type alias** (`type T1 = T2`) creates a second name for the _same_ type. Methods, identity, conversions — all shared with `T2`. Use aliases narrowly: package migrations (re-exporting a moved type so old imports still work), generic aliases (Go 1.24+, see above), and a handful of stdlib conventions like `byte = uint8` and `rune = int32`.

**Why the distinction matters:** a definition gives you compiler-enforced separation of two values that share an underlying representation; an alias gives you ergonomic naming without separation. Reaching for one when you want the other produces either annoying conversions where they shouldn't be needed (over-defining) or missing safety where you wanted it (over-aliasing).

## Struct Design

Structs with uncopyable fields: MUST pass by pointer, pointer receivers, return from constructor as pointer. Proto messages: ALWAYS `*pb.Something`.

### API Boundary Types — Input and Result

A type **crosses an API boundary** when it is consumed by a package other than the one that defines it, or when it is marshalled to JSON / a wire format. Input types (request parameters, operation options) and Result types (response bodies, operation outputs) are the canonical examples. Derived or computed types used inside one package are NOT boundary types and do NOT follow these rules.

At API boundaries, scalar fields (`string`, `int`, `bool`, `time.Time`) MUST be pointers (`*string`, `*int`, `*bool`, `*time.Time`). A nil pointer means **unset / not supplied / not produced**; a non-nil pointer carries the explicit value, even when that value is the zero value of the underlying type. This tri-state preserves the unset-vs-zero distinction across layers so every consumer can apply its own defaults instead of a single layer collapsing the information prematurely.

Slices and maps stay as plain values at API boundaries — their zero value (`nil`, `len == 0`) already communicates "empty collection," and pointerising them adds no information.

Composite types that carry their own internal unset semantics (e.g. a typed parameters struct whose fields are already pointers) stay as values. Do not double-wrap.

### Input Types: unexported fields + constructor + accessors

Input types use the Effective-Go canonical pattern for types that carry state across a boundary:

```go
// Fields unexported — the type owns its invariants.
type DoctorInput struct {
    config     platform.Config
    target     platform.Target
    targetName *string
}

// Constructor positional args are REQUIRED fields.
func NewDoctorInput(cfg platform.Config, target platform.Target) *DoctorInput {
    return &DoctorInput{config: cfg, target: target}
}

// With* builders set OPTIONAL fields. Return the receiver so
// construction is a single expression.
func (i *DoctorInput) WithTargetName(name string) *DoctorInput {
    i.targetName = &name
    return i
}

// Accessors use the idiomatic noun name (NOT GetConfig) —
// Effective Go: "The use of upper-case names for export provides
// the hook to discriminate the field from the method."
func (i DoctorInput) Config() platform.Config { return i.config }
func (i DoctorInput) Target() platform.Target { return i.target }

// Optional fields use the comma-ok form to preserve the tri-state
// at the read site. Callers decide what unset means.
func (i DoctorInput) TargetName() (string, bool) {
    if i.targetName == nil {
        return "", false
    }
    return *i.targetName, true
}
```

Rules:

- Required fields are positional args on `New*`; optional fields are `With*` builders.
- Accessors for required fields return `T`; accessors for optional pointer fields return `(T, bool)`.
- NEVER use a `Get` prefix — follow Effective Go and rely on capitalisation to separate field from method.
- DO NOT add an `OrDefault(def T)` accessor unless a terminal consumer needs the default pattern. The comma-ok form preserves the tri-state for every downstream layer; `Or(def)` collapses it, defeating the purpose.

### Result Types: exported pointer fields, no accessors

Result types are read by renderers and JSON marshallers. `encoding/json` marshals exported fields, not methods, so fields MUST be exported. Accessor methods would collide with field names (a method can't share a name with an exported field on the same type), so the Effective-Go unexport-and-accessor pattern does not apply here:

```go
type DoctorResult struct {
    Target *string       `json:"target,omitempty"`
    Passed *bool         `json:"passed,omitempty"`
    Stacks []DoctorStack `json:"stacks"`
}
```

Rules:

- Scalar fields are pointers with `omitempty` JSON tags. `omitempty` drops unset fields from the wire format.
- Slices of composites stay as value slices (`[]DoctorStack`, not `[]*DoctorStack`) unless the composite is uncopyable.
- Readers and renderers access fields directly. No accessor layer.

### Renderer Contract: Invariant Violations Panic

The producer of a Result type (the package that owns the operation) defines an invariant about which fields are populated on each exit path. Consumers (renderers, serialisers) rely on that contract.

When a renderer encounters a nil pointer on a field the producer's contract says is always set, it MUST NOT silently render the zero value. Silent coercion hides the bug upstream. Instead:

- PREFER returning a `Validate() error` method on the Result type called by the producer before returning. This catches the invariant violation at the producer's boundary, where context is fresh.
- When no validator is in place, the renderer MAY `panic` with a clear message naming the field. Panic is acceptable here under the "invariant violation (bug)" exception from core.md.
- DO NOT use helper functions like `derefString` that collapse nil to the zero value without signalling — they encourage the renderer to ignore what the pointer is telling it.

Genuinely optional fields (the producer's contract says "may be nil") use explicit nil-check branches: render when present, skip otherwise. Use judgement about which fields are which and document it on the type.

## Size Hints

Preallocate ONLY when size is known or profiling shows allocation as a bottleneck. Document the rationale.
