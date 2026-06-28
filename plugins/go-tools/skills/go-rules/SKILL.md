---

name: go-rules
description: This skill should be used when writing, reviewing, modifying, or discussing Go code — even one-line changes or simple style questions. Triggers include "write a Go function", "is this idiomatic Go", "review my Go code", "how should I name this package", "wrap this error", "is this goroutine safe", "table-driven test", or any task touching Go naming, errors, types, generics, concurrency, testing, imports, control flow, or doc comments. Codifies Go 1.26 conventions from Effective Go and the Google Go Style Guide that supersede older pre-trained intuition.
---

# Go Rules Index

**Read the relevant rule files before writing, reviewing, modifying, or discussing any Go code — even one-line changes, even simple style questions.** Pre-trained Go intuition leans on patterns from older Go versions and from other languages; these rules supersede that.

This skill codifies Go conventions distilled from Effective Go, the Google Go Style Guide (Style Guide / Decisions / Best Practices), and the Go 1.26 release notes. When a rule here conflicts with prior training or with conventions from another language, the rule here wins — but the rules explain _why_, so apply judgment to cases the text doesn't cover.

**Scope:** general-purpose Go (Go 1.26 target), aimed at idiomatic community Go rather than any single organisation's house style. Where a rule reflects a Google-internal convention rather than broad community consensus, it is labelled inline.

**Go-version features covered here that may be missing from training data:**

- **Go 1.21:** `min` / `max` / `clear` builtins; `slices`, `maps`, `cmp`, `log/slog` packages; `cmp.Ordered` constraint.
- **Go 1.22:** integer range (`for i := range 10`); per-iteration loop-variable scoping (`for _, v := range s` no longer shares `v` across iterations).
- **Go 1.23:** function iterators (`iter.Seq`, `iter.Seq2`); `range` over a function value; `slices.All`, `maps.Keys`, `strings.Lines`, etc. as iterator-returning helpers.
- **Go 1.24:** generic type aliases; `(testing.TB).Context()`.
- **Go 1.25:** `testing/synctest` for testing time-dependent code without sleeping.
- **Go 1.26:** `new(expr)` (pointer to a computed value); `errors.AsType[T]` (generic, type-safe replacement for `errors.As`); self-referential generic constraints (`type Adder[A Adder[A]]`); `T.ArtifactDir()`; the rewritten `go fix` modernizers; the `goroutineleakprofile` GOEXPERIMENT; silent crypto-randomness changes (`GenerateKey` / `Sign` / `Prime` now ignore caller-supplied `io.Reader`); deprecation of PKCS #1 v1.5 encryption; PQ TLS key exchange enabled by default.

All rule files live in this skill's `references/` directory.

## How to Use These Rules

1. **Always read `references/core.md` first** — it contains the foundational principles, formatting rules, and universal code rules that apply to every line of Go code. No Go task should proceed without it.
2. **Then read the topic files below** that match the current task. Read the trigger — if the task matches, read the file.
3. Multiple files may apply. Most tasks require 2–4 files.

## File Index

Read every file whose trigger matches the current task.

| File                                                           | Trigger                                                                                                                                 | Contents                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[`references/core.md`](references/core.md)**                 | **ANY Go code task — writing, reviewing, modifying, reading, or discussing Go code. ALWAYS read this file.**                          | Principles, formatting, least mechanism, universal rules (pass values, don't panic, **new(expr) Go 1.26**, defer, sync, crypto/rand), struct literals, global state, **go fix modernizers**, anti-patterns checklist                                                              |
| **[`references/naming.md`](references/naming.md)**             | Declaring, naming, or renaming any identifier — variables, functions, methods, types, packages, receivers, constants, interfaces      | Package names, receiver names, constants/iota, initialisms, getters, interface names (-er suffix), variable scope/length rules, repetition elimination, shadowing, test double naming                                                                                             |
| **[`references/errors.md`](references/errors.md)**             | Creating, returning, wrapping, handling, logging, or documenting errors; choosing between %v and %w; designing error types or sentinels | Returning errors, error strings, handling/flow, in-band errors, error structure (sentinels, Unwrap, **errors.AsType Go 1.26**, custom Is/As), %v vs %w, wrapping as API contract, logging, Must functions, panic/recover                                                          |
| **[`references/testing.md`](references/testing.md)**           | Writing tests, test helpers, table-driven tests, benchmarks, fuzz tests, test fixtures, or test infrastructure                          | Test principles (fidelity/resilience/precision), state vs interactions, change-detector anti-pattern, failure messages, no assertion libraries, cmp/diffs, t.Error vs t.Fatal, table-driven tests, subtests, helpers, **T.ArtifactDir() Go 1.26**, acceptance testing             |
| **[`references/commentary.md`](references/commentary.md)**     | Writing comments, doc strings, package documentation, godoc formatting, runnable examples, or deprecation notices                       | Doc comments on exported names, type/function/const doc conventions, "reports whether" for bools, comment sentences, package comments, what to document (context, concurrency, cleanup, errors), godoc syntax (headings, links, lists, code blocks), deprecation, signal boosting |
| **[`references/functions.md`](references/functions.md)**       | Designing function or method signatures, choosing between option structs and variadic options, or working with named return parameters  | Function signatures (keep on one line), named result parameters, option structs, variadic options, string concatenation                                                                                                                                                           |
| **[`references/control-flow.md`](references/control-flow.md)** | Writing if/else, switch, for loops, type switches, or making decisions about line breaks and indentation around control structures      | Indentation confusion, if/for/switch formatting, boolean extraction, type switches, type assertions, function call formatting                                                                                                                                                     |
| **[`references/concurrency.md`](references/concurrency.md)**   | Working with goroutines, channels, sync primitives, context.Context, select, or designing concurrent APIs                               | Share by communicating, goroutine lifetimes, context rules, channels, sync primitives, patterns (semaphores, worker pools, leaky buffer), **goroutine leak profiles Go 1.26**                                                                                                     |
| **[`references/imports.md`](references/imports.md)**           | Organizing imports, creating or naming packages, choosing package structure, or deciding on package size and file layout                | Import grouping (4 groups), renaming, blank/dot imports, proto imports, package names, package size, util packages, flags                                                                                                                                                         |
| **[`references/types.md`](references/types.md)**               | Working with structs, interfaces, generics, type definitions, type aliases, embedding, or choosing between value and pointer receivers  | Interfaces (consumer package, YAGNI, compile-time checks), generics (**self-referential constraints Go 1.26**), embedding, type conversions, receiver types (decision tree), type definitions vs aliases, struct design, size hints                                               |

## Common Task Loading Patterns

| Task                                  | Read These Files                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Write a new function or method        | `core.md` + `naming.md` + `functions.md` + `errors.md`                                |
| Write or modify tests                 | `core.md` + `testing.md` + `naming.md`                                                |
| Design a public API or package        | `core.md` + `functions.md` + `types.md` + `naming.md` + `commentary.md` + `errors.md` |
| Write doc comments or examples        | `core.md` + `commentary.md`                                                           |
| Work with goroutines or channels      | `core.md` + `concurrency.md` + `errors.md`                                            |
| Organize imports or create a package  | `core.md` + `imports.md` + `naming.md`                                                |
| Define types, interfaces, or generics | `core.md` + `types.md` + `naming.md`                                                  |
| Refactor control flow                 | `core.md` + `control-flow.md`                                                         |
| Full code review                      | All files                                                                             |
