# Go Import and Package Rules

---

## Import Grouping

Four groups, separated by blank lines, in this order:

1. Standard library
2. Other packages (your project, vendored, third-party)
3. Protocol buffer imports (renamed with `pb`/`grpc` suffix)
4. Side-effect imports (`_ "package"`)

**Why:** the grouping makes the dependency surface scannable at a glance. A reader can see "stdlib only" or "this file pulls in three third-party deps" without having to mentally sort the list. The trailing groups (proto, side-effect) call attention to imports that behave differently from regular ones — proto types tend to be `*pb.Foo` everywhere, and side-effect imports run `init()` code without exposing names.

## Import Renaming

Don't rename imports unless you must. When you must (collision, package name conflict with a local, or proto convention), follow the package naming rules and use the same local name across every file in the package. **Why:** a renamed import is one more thing every reader has to track. Two files importing the same package under different names is actively confusing. The exception is mechanical conventions (proto's `_pb` suffix), where consistency across the codebase outweighs minimising renames.

When two imports collide, rename the more project-specific one — the standard library or widely-known third-party package keeps its canonical name; your `internal/foo` shifts.

## Blank and Dot Imports

- `import _ "package"` (blank import) only in `main` packages or test files; never in library packages. **Why:** a blank import runs the package's `init()` for its side effects. In a library, that side effect propagates to every binary that transitively imports the library — they get registered codecs, started timers, or modified globals they never asked for. Exception: `embed`, which is a compiler directive rather than a side effect.
- `import . "package"` (dot import): don't. **Why:** dot imports drop the package qualifier from every reference, so `Marshal` in your code could be from any of three imported packages, and the reader has to grep all three to find out which. The brevity isn't worth the confusion.

## Package Size

- Group related types together — closely coupled types belong in the same package, especially when they need access to each other's unexported members.
- Conceptually distinct things go in their own packages, but err toward "smaller, focused packages" rather than "one giant grab-bag."
- Go has no "one type per file" rule. Avoid the two extremes: a single 5000-line file (hard to navigate, painful in diffs) and a flock of 50-line single-type files (every change touches a new file, the boundaries are arbitrary). Group code by what's read together.

## Flags

Flag names use the convention of the surrounding project — typically `kebab-case` (e.g. `--max-retries`) when consumed by users, sometimes `snake_case` in Google-flavored codebases. Flag variables: `mixedCaps`. Flags MUST only be in `package main`. Libraries MUST NOT export flags — a library that registers flags forces every binary that imports it (directly or transitively) to inherit them, which surfaces unrelated knobs in `--help` and breaks isolation.
