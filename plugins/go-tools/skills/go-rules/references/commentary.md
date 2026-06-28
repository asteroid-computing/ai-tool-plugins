# Go Commentary and Documentation Rules

---

## Doc Comments

Every exported name has a doc comment. Full sentences, starting with the symbol's name. **Why:** the comment shows up in godoc, in IDE hover, and in language-server tooltips — for many readers, this _is_ the documentation. Starting with the name lets the doc be presented in any order ("Reader reads bytes from..." reads correctly when shown alone, "reads bytes from..." doesn't) and makes searching the doc index easier.

- **Types:** document what an instance represents, not how it's implemented. Note whether the zero value is usable (the Effective-Go ideal) and what its concurrency guarantees are. The default assumption is "safe to read concurrently, _not_ safe to mutate concurrently" — only document deviations from that.
- **Functions:** describe what the caller needs to know, not the internals. For functions returning `bool`, the convention is "reports whether" rather than "returns true if" — `IsValid reports whether the input is well-formed.` reads more naturally than `IsValid returns true if the input is well-formed.`. Document special cases (what happens on empty input, on negative numbers, on nil), and asymptotic complexity when it's surprising.
- **Constants and variables:** when grouped in a `const (...)` or `var (...)` block, write one doc comment for the group and use end-of-line comments for any individual oddities.

Unexported code with non-obvious behaviour benefits from doc comments too — future-you and code reviewers count.

## Comment Style

Complete sentences: capitalise and punctuate. End-of-line fragments on struct fields don't need to be sentences (the field name carries half the meaning). Prefer one sentence per line in multi-sentence comments — the diff stays clean when a single sentence is later edited, instead of rewrapping a paragraph.

## Package Comments

Immediately above `package` clause, no blank line between. One package comment per package — pick a single file to host it.

- **Library packages:** start with `// Package <name> ...` — e.g. `// Package math provides basic constants and mathematical functions.`
- **Command packages (`package main`):** start with the binary's role, not the literal package name. Common forms: `// Command seed-generator produces deterministic seeds for the X service.` or `// The seed-generator command produces deterministic seeds...` Both are idiomatic; `Command <name>` reads slightly cleaner in godoc.
- **Long-form package docs:** put them in a dedicated `doc.go` file so the package comment doesn't push working code off the screen.

---

## What to Document

Document the **non-obvious** — constraints, error-prone usage, defaults, required cleanup. Don't restate things the parameter name and type already say. **Why:** comments compete with code for the reader's attention; comments that paraphrase the signature ("ctx context.Context — the context") add noise without adding signal, and the reader stops reading comments carefully because most of them don't pay off.

- **Context cancellation** is implied — when a function takes `ctx`, callers already expect cancellation to interrupt it and the return error to be `ctx.Err()`. Only document context behaviour when it deviates (the function ignores cancellation, or returns a custom error on cancel).
- **Concurrency safety:** the default reading is "read-only operations are safe, mutating operations are not." Only document the _deviations_ — "safe for concurrent use" on a mutating operation is information, "safe for concurrent use" on a getter is noise.
- **Cleanup:** always document any cleanup the caller is responsible for. `// Call Stop to release resources.` or `// The caller must Close the returned reader.` — without it, the reader has to either run the code under a leak detector or read the source to find out.
- **Errors:** document the sentinel values and custom error types your function may return, so callers know what to check for with `errors.Is` / `errors.As`.

## Examples

Write runnable examples in `*_test.go` files, named `ExampleType_Method`, with `// Output:` comments verifying behaviour. Prefer runnable examples over hand-written code blocks in comments. **Why:** runnable examples are tested by `go test` — if the example code stops compiling or the output drifts, the test fails. Code in a comment block can rot for years before anyone notices, and copy-pasted-into-godoc examples are often subtly wrong.

## Godoc Syntax

Paragraphs: blank comment line. Headings: `// # Heading`. Doc links: `[Name]`, `[pkg.Name]`. Lists: indent, start with `-`/`*`/`+`. Code blocks: indented lines. Deprecation: `// Deprecated: Use [NewThing] instead.`

## Pitfalls

- Indented continuation lines become preformatted — keep continuations flush.
- Signal-boost deviations from common patterns (e.g., `err == nil` instead of `!= nil`).
