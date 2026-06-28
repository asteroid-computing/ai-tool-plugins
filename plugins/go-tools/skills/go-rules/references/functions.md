# Go Function and API Design Rules

---

## Signatures

Keep signatures on one line. If a signature is genuinely too long, the right fix is to redesign the API (fewer parameters, an option struct, splitting into two functions) — not to line-break the signature. Shorten _call sites_ with named local variables, not by breaking the call across lines. Don't add inline comments next to individual arguments; use an option struct or named-field literal instead.

**Why:** a multi-line signature buries the parameter list and forces every reader to mentally reassemble it. A signature that genuinely needs multiple lines is usually trying to do too many things at once, and the redesign that fits it on one line will make the function easier to use too. Inline argument comments (`f(true /* failFast */, 30, "name")`) are a sign that the API has positional booleans and unmotivated integers — fix the API, not the call site.

## Named Result Parameters

Name results only when the names add clarity the types don't already provide. `(left, right *Node, err error)` is useful because the two `*Node` results would be indistinguishable otherwise. `(n int, err error)` from a `Read` method is a slight readability win and matches a strong stdlib convention. Don't name results just to avoid declaring local variables in the body, and don't use naked `return` (returning the named values without listing them) outside of very small functions — the implicit return reads cleanly in a five-line function and confusingly in a fifty-line one.

Named results are always acceptable when a deferred closure needs to read or modify them — the classic error-annotation pattern (`defer func() { err = fmt.Errorf("doThing: %w", err) }()`) requires it.

---

## Parameter Lists — When They Get Too Long

### Option Struct

Use an option struct when most callers need to set several options, when options are shared across multiple functions, or when the option list is likely to grow. Never put `context.Context` in an option struct — `ctx` always belongs as the first positional parameter so cancellation flows naturally and callers can't forget to pass it.

**Why option structs work:** field-name literals at the call site (`Open(name, Options{Mode: Read, BufferSize: 4096})`) self-document, callers can omit fields they don't care about (zero values), and adding a new field is a non-breaking change. The cost is a slightly heavier API surface (one extra type) for a function that only takes 2-3 arguments.

### Variadic Options (functional options)

Use variadic options when most callers want zero or one option, when there are many options most callers won't touch, or when third parties may want to define their own options. Options should accept parameters (`FailFast(enable bool)`) rather than being presence-only (`EnableFailFast()`) — presence-only options can't be turned _off_ and don't compose with default-changing helpers. Document whether last-write-wins or whether duplicate options accumulate.

**Why functional options work:** the call site reads `New(name, FailFast(true), Timeout(30*time.Second))` — every option is named, the API can grow indefinitely without breaking callers, and packages can ship their own options. The cost is real: option types are functions/closures, not data, so they're harder to introspect, harder to serialise, and a touch heavier than struct fields.

### Which to Choose

If most callers will set most fields and the set is roughly stable: **option struct**. If most callers want defaults, the option set is large, or extensibility matters: **variadic options**. When in doubt, option struct first — you can always migrate to variadic later, and most APIs never grow into the variadic regime.

---

## String Concatenation

Simple join: `+`. Formatted: `fmt.Sprintf`. Writing to `io.Writer`: `fmt.Fprintf` directly. Loop/piecemeal: `strings.Builder`. Multi-line constant: backticks. Complex logic: `text/template`.
