# Go repositories

Read this with the step it adds to, in a repository with a `go.mod` or `go.work` at its root.
Its sources are the [Google Go Style Guide](https://google.github.io/styleguide/go/) (the guide, which is canonical; its decisions, which are normative; and its best practices), [go.dev/wiki/Comments](https://go.dev/wiki/Comments), and [Go Doc Comments](https://go.dev/doc/comment), which both defer to for syntax.
[comments.md](comments.md) has the comment rule and the quotes behind it; this file has what is particular to Go.

## Step 1: AGENTS.md

Use the Go form of the comment rule in [agents-md.md](agents-md.md), which links the style guide and go.dev/doc/comment and says that directives are code.
If the repository writes one sentence per line in comments, or any line rule other than the decisions document's wrapping at about 80 or 100 columns ([Comment line length](https://google.github.io/styleguide/go/decisions#comment-line-length)), say so in the same rule.

## What each Go comment holds

- **The package comment**: one per package, immediately above the `package` clause, starting "Package p …" ([Package comments](https://google.github.io/styleguide/go/decisions#package-comments), [go.dev/doc/comment#package](https://go.dev/doc/comment#package)).
  It says what the package provides and sets expectations for it as a whole: how its parts fit together, its error conventions ([Errors](https://google.github.io/styleguide/go/best-practices#documentation-conventions-errors)), what it does not guarantee.
  A long one goes in a `doc.go` that holds only the comment and the package clause.
  Its "why" is what a user needs, such as what the package guarantees and what it does not.
  A long package comment that explains the project's reasons for its design is the commonest place for history and citations: what a maintainer of the code needs moves to a file comment after the imports, the project's reasons move to the area's rules file, and what stays is what a user of the package needs.
- **A command's package comment** describes the program's behaviour, not its Go symbols, and starts with the program's name ([go.dev/doc/comment#cmd](https://go.dev/doc/comment#cmd)): "Gofmt formats Go programs."
- **Doc comments** on every exported name, and on unexported types and functions whose behaviour or meaning is not obvious ([Doc comments](https://google.github.io/styleguide/go/decisions#doc-comments)): full sentences that begin with the name.
  - A type says what each instance represents or provides, what its zero value means if that is not obvious, and any concurrency guarantee beyond single-goroutine use ([#type](https://go.dev/doc/comment#type)).
  - A function says what it returns or, if called for its side effects, what it does, with its special cases; a boolean function "reports whether" ([#func](https://go.dev/doc/comment#func)).
  - Document a parameter only when it is error-prone or not obvious, by saying why it is interesting; context and concurrency only where they differ from what callers assume; any cleanup the caller must do; and the errors and error types a caller can handle ([Documentation conventions](https://google.github.io/styleguide/go/best-practices#documentation-conventions)).
  - Not the algorithm of the current implementation: "Those are best left to comments inside the function body" ([#func](https://go.dev/doc/comment#func)).
- **`Deprecated:` paragraphs** say what to use instead ([#deprecations](https://go.dev/doc/comment#deprecations)); they describe the API now, so they are not history.
- **No notes**: Go renders `TODO(uid):` and `BUG(uid):` comments in their own section on pkg.go.dev ([#notes](https://go.dev/doc/comment#notes)), but by [the test](comments.md#the-test) work still to do is an issue, not a comment; a cleanup turns each note into a follow-up issue and removes it, and a `BUG` note's limitation, if it still holds, becomes a sentence in the doc comment saying what the code does not handle.
- **Comments in a function body** explain why the code does what it does where its names cannot ([Clarity](https://google.github.io/styleguide/go/guide#clarity-rationale)).
  They include the comments the decisions ask for: why an ignored error is safe ([Handle errors](https://google.github.io/styleguide/go/decisions#handle-errors)), what an empty `switch` clause is for ([`switch` and `break`](https://google.github.io/styleguide/go/decisions#switch-break)), and a short end-of-line comment that [boosts the signal](https://google.github.io/styleguide/go/best-practices#signal-boost) of a line that looks common but is not, such as `err == nil`.
  An inline comment on a function argument is avoided in favour of an option struct or the function's doc comment ([Function formatting](https://google.github.io/styleguide/go/decisions#func-formatting)).
- **Maintainer comments for a whole file** go after the imports, where Godoc does not show them ([Package comments](https://google.github.io/styleguide/go/decisions#package-comments)).
- **Examples** belong in `_test.go` files as runnable `Example` functions, not as code in comments, where that is feasible ([Examples](https://google.github.io/styleguide/go/decisions#examples)).
- **Tests**: a test's doc comment says what behaviour it checks, as for any function; the bug it guards against is described, not cited.

## What a cleanup never changes

These are comments to the parser, but code to the tools that read them ([go.dev/wiki/Comments](https://go.dev/wiki/Comments)):

- **Directives**: `//go:build` (and an old `// +build`), `//go:generate`, `//go:embed`, the compiler's `//line` and `/*line */`, `//go:noescape`, `//go:linkname`, `//go:noinline`, `//go:norace`, `//go:nosplit`, `//go:uintptrescapes`, `//go:wasmimport`, and any other `//go:` line.
  A directive has no space between `//` and `go:`; `// go:build` is an ordinary comment.
- **Other tools' directives**: any line of the form `//toolname:directive`, such as `//nolint:errcheck`, which [go.dev/doc/comment#directives](https://go.dev/doc/comment#directives) defines with the pattern `//(line |extern |export |[a-z0-9]+:[a-z0-9])`.
  A directive line can still carry a citation after it (`//nolint:errcheck // see #45`), and a lowercase note such as `//todo:fix` matches the directive pattern too; `gocomments` leaves all of these out, so read the directive lines in the code a PR touches by hand, and change only the text after a directive's own arguments.
- **The cgo preamble**: the comment immediately before `import "C"`, which is C code, including its `#cgo` lines; and `//export` above a Go function.
- **Examples' expected output**: the `// Output:` and `// Unordered output:` comments at the end of an `Example` function, which `go test` compares.
- **Generated files**: a file with a `// Code generated … DO NOT EDIT.` line ([go generate](https://pkg.go.dev/cmd/go#hdr-Generate_Go_files_by_processing_source)) is changed by changing its generator, never by hand.

Doc comment syntax is kept as it is: paragraphs separated by a blank `//` line, `# Heading` lines, `[Name]` and `[pkg.Name]` doc links, `[Text]: URL` link targets, lists, and indented code blocks ([go.dev/doc/comment](https://go.dev/doc/comment)).
gofmt reformats doc comments to a canonical form, so run it after every edit.
It also rewrites the best practices' older heading form, a single capitalised line with no terminating punctuation ([Godoc formatting](https://google.github.io/styleguide/go/best-practices#godoc-formatting)), as a `# ` heading ([#headings](https://go.dev/doc/comment#headings)); that is a comment change, which `gocomments same` accepts.
If such a line was not meant as a heading, end it with a full stop or a colon instead.

## Step 5: areas and `paths:`

- An area is a package or a group of packages: list them with `go list ./...` and group them by the code's own boundaries.
- Its `paths:` globs cover the package directories (`internal/store/**`), the command that wires them (`cmd/app/serve.go`), and the files they embed or read (`internal/web/templates/**`, `internal/web/testdata/**`).
- The repository's build and CI tooling is an area of its own.

## Step 6: `gocomments`

The skill ships a small tool, using only the standard library, in `scripts/gocomments/` next to SKILL.md.
Run it from the root of the Go module, which may be a subdirectory of its git repository; `go run -C` builds the tool in its own directory, so `-repo` says where to run:

```bash
TOOL="<the path SKILL.md gives>"                                  # set it in every command
go run -C "$TOOL" . -repo "$PWD" find ./internal/store            # list candidate comment lines
go run -C "$TOOL" . -repo "$PWD" same origin/main                 # prove only comments changed
```

- **`find [path ...]`** parses each `.go` file and prints every comment line that matches `pattern.txt`, the same pattern the other searches use, as `file:line: text`.
  It leaves out directives (by go.dev's pattern), the cgo preamble, examples' expected output, generated files, and `vendor`, `testdata` and the directories the go tool ignores.
  A file that does not parse is printed as not checked, and the search goes on.
  It exits 1 when it prints anything.
  Its matches are candidates: an external fact such as `golang/go#22682` matches too, and the PR body says why each remaining match stays.
- **`same <base>`** compares every `.go` file that differs between the working tree and the commit where the branch left `<base>` (`git merge-base <base> HEAD`), so commits that landed on main since do not count; it looks only at files under the module's directory, and stops with an error when the branch and `<base>` have no common ancestor.
  It compares each file's tokens without comments, its directives, its cgo preamble and its examples' expected output.
  It prints each file that changed more than its comments, with the first line that differs; each added (including untracked), deleted or generated `.go` file, a rename showing as one deleted and one added; and each `.go` file that does not parse.
  It lists other changed files as not checked, and exits 1 when any `.go` file changed more than its comments.
  Run it before pushing a comment PR, and say in the PR body that it passed; a reviewer with this skill loaded reruns it on the PR's checkout.

Then verify as for any Go change: `gofmt -l` prints nothing, `go vet ./...` and `go test ./...` pass (or the repository's own gate, such as `./walle check`), and the rewritten package docs read well in `go doc` or a local [pkgsite](https://pkg.go.dev/golang.org/x/pkgsite/cmd/pkgsite) ([Preview](https://google.github.io/styleguide/go/best-practices#documentation-preview)).
