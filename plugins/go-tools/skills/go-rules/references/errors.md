# Go Error Handling Rules

**Go 1.26 update:** `errors.AsType` — generic alternative to `errors.As`. NOT in your training data.

---

## Returning Errors

- `error` is the last return value. Return `nil` for success. **Why:** universal convention; readers expect `result, err := f()` and an out-of-place error parameter forces them to look up the signature every time.
- Return the `error` interface type, not a concrete error type. **Why:** Go's interface-vs-typed-nil rule is the single most common gotcha — a `(*MyError)(nil)` stored in an `error` is _not_ equal to `nil` because the interface carries type information. If your function signature says `error`, callers can compare to `nil` and get the right answer; if it says `*MyError`, a nil `*MyError` returned to a caller that assigns it to `error` will read as non-nil and trigger error handling for a successful call.
- Callers should treat non-error return values as unspecified when the error is non-nil. **Why:** the function may have allocated a partial result, returned a zero value, or left a buffer in an inconsistent state — its contract on error is "I failed," not "here's a half-working result." Callers that read the result anyway invite subtle bugs.

---

## Error Strings

Error strings start lowercase (unless beginning with an exported name, proper noun, or acronym) and end without punctuation. **Why:** error strings get composed — `fmt.Errorf("reading config: %w", err)` produces a chain that reads as one sentence. A leading capital or trailing period in the inner error breaks the flow: `"reading config: Failed to open file."` versus `"reading config: open foo.txt: no such file or directory"`. The lowercase, punctuation-free convention keeps composition clean.

---

## Handling Errors

Don't discard errors with `_`. Every error needs one of: **handle it**, **return it**, or **fatal on it**. **Why:** an error you ignore is a bug you've decided to ship. Even errors that "can never happen" eventually do, and when they do without being checked the only evidence is an inexplicable downstream failure with no log line near the actual cause.

The exception: documented-safe cases like `(*bytes.Buffer).Write`, which the godoc explicitly says never returns an error. When you ignore one of these, leave a one-line comment so the next reader doesn't waste time wondering whether you missed it: `_, _ = b.Write(p) // bytes.Buffer.Write never errors`.

## In-Band Errors

Don't use magic values (`-1`, `""`, `nil`) to signal failure when the function also has a normal "I worked" path that could return that same value. Use multiple return values: `(value, error)` or `(value, ok bool)`. **Why:** Go has multiple return specifically so you don't have to overload the result type with sentinel meanings. In-band sentinels propagate — every caller has to remember to check, the compiler can't help, and a forgotten check means the sentinel flows downstream as if it were valid data.

## Error Flow

Handle errors first and return early; keep the success path on the left margin (not nested in an `else`). **Why:** the reader's eye scans down the left edge looking for the happy path. Nesting success inside `else` pushes it rightward and forces the reader to mentally invert each error condition to follow the normal flow. Returning early flattens the function and makes the success story readable top-to-bottom.

If a variable declared in the `if`-init is needed beyond the block, declare it on its own line first. The condensed `if x, err := f(); err != nil` form is for cases where `x` is genuinely scoped to the error branch.

---

## Error Structure

Give errors structure when callers need to distinguish conditions programmatically — different sentinels for different categories, custom types for errors carrying data. Don't force callers to parse error strings. **Why:** error strings are not API; they're for humans. The moment a caller writes `if strings.Contains(err.Error(), "not found")` they've coupled themselves to a string the producer can change at any time, and the producer has lost the ability to improve the message without breaking downstream code.

- **Sentinels:** `var ErrNotFound = errors.New("not found")`. Compare with `errors.Is`, not `==`. **Why:** `==` only works for the sentinel itself; the moment anyone wraps it with `fmt.Errorf("...: %w", ErrNotFound)`, `==` returns false and the comparison silently fails. `errors.Is` walks the wrap chain and works in both cases. Wrapping sentinels at definition time (`fmt.Errorf("%w", ErrPermission)`) is a forcing function — callers physically can't use `==` anymore, so they don't accidentally write fragile checks.
- **Custom types that wrap an inner error** must implement `Unwrap() error`. **Why:** `errors.Is` and `errors.As` walk the chain by calling `Unwrap`; without it, a wrapping type that holds a sentinel hides that sentinel from every caller doing structured checks.
- **`errors.AsType[T]` (Go 1.26):** generic, type-safe replacement for `errors.As`. Prefer it in new code — it's faster, doesn't need a pre-declared variable, and the type appears at the call site rather than as an out-parameter:

```go
if e, ok := errors.AsType[*QueryError](err); ok {
    fmt.Println(e.Query)
}
```

- **Custom Is/As methods:** use sparingly — for template-style matching where only non-zero fields are compared.

---

## Adding Information

Add context the _caller_ has but the callee couldn't have known — the operation that was being attempted, the identifier of the resource involved, the parameters that were passed in. Don't duplicate what the underlying error already says, and don't add empty wrappers like `fmt.Errorf("failed: %v", err)` — just return `err`.

**Why:** wrapping is for the reader of the eventual log line. They want a chain that reads like a story: "uploading user avatar: writing to S3: connection timed out." If every layer adds "failed:" or restates the error verbatim, the chain becomes "failed: failed to upload: failed: connection timed out: connection timed out" — same information, four times the noise, harder to grep.

## %v vs %w

- **`%v`** flattens the error into a string and drops the wrap chain. Use at system boundaries (RPC, HTTP responses, log lines) or when you specifically _don't_ want callers to depend on what the inner error was.
- **`%w`** preserves the chain so `errors.Is` and `errors.As` work. **Wrapping with `%w` is an API contract** — the moment your function returns `fmt.Errorf("...: %w", innerErr)`, the type and identity of `innerErr` become part of your public API and callers can (and will) depend on them.
- Place `%w` at the end of the format string: `"context: %w"`. **Why:** the chain prints newest-to-oldest, so putting the wrapped error last makes the human-readable output read in causal order.

**Why the boundary distinction matters:** `%w` is a one-way commitment. Once you wrap `sql.ErrNoRows` with `%w`, every caller can write `errors.Is(err, sql.ErrNoRows)` and you can never change the storage backend without breaking them. `%v` lets you swap implementations freely because the inner error is no longer part of your contract — it's just text in a message.

```go
// Commits you to sql.ErrNoRows forever:
return fmt.Errorf("accessing DB: %w", err)

// Free to change internals:
return fmt.Errorf("accessing DB: %v", err)
```

## Logging Errors

- **DO NOT log and return.** Pick one. Let the caller decide. Logging _and_ returning means the same error gets logged again at every layer above, producing duplicate stack traces and obscuring the real cause. The caller has more context than you do about whether the error is expected, recoverable, or worth alerting on.
- **Reserve ERROR-level logs for actionable conditions** — something a human should investigate. Routine failures (a request that 404s, a retryable timeout) belong at INFO or WARN. Some logging backends additionally treat ERROR as expensive (synchronous flush, paging, metrics emission); when in doubt, assume ERROR carries operational weight.

## Must Functions

`MustXYZ` helpers (`template.Must`, `regexp.MustCompile`) panic on failure. Use them only where panic is the right outcome: at init time (package-level vars, `init()` functions) and in test helpers. Don't use them in normal request-handling code paths.

**Why:** at init, a failure means the program can't start — panic is fine because there's no caller to inform. In a request handler, panic kills the goroutine and may take down the request without a proper error response; the caller had every right to handle the error gracefully and your `Must` took that choice away.

## Internal Panic/Recover

The exception to "never panic for control flow" is deeply nested internal code, classically a recursive-descent parser, where threading errors back through every level is genuinely worse than a controlled panic. The rules:

1. The panic must never escape the package boundary — recover at the public API.
2. Use a custom panic type so the recover can distinguish _your_ panics from genuine bugs (a `nil` deref shouldn't be silently swallowed). Re-panic anything that isn't your type.
3. The public API returns `error`, never panic.

**Why the strict boundary:** callers contract with your package on `error`-returning functions. A panic that escapes breaks that contract and surfaces as a crashing goroutine in code the caller never expected to be parsing — extremely surprising and very hard to debug.

## Error Documentation

Document sentinel values and named error types in doc comments — the calling code needs to know which sentinels exist so they can write `errors.Is` checks against them. **Why:** if `pkg.Find` returns `pkg.ErrNotFound` on missing items but the godoc only says "returns an error if the item cannot be located," the caller is left guessing. They'll either over-handle (catch every error as "not found") or under-handle (miss the case entirely). Naming the sentinel in the doc makes the contract grep-able.
