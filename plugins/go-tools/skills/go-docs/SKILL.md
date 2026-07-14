---

name: go-docs
description: This skill should be used whenever working with Go and an authoritative package or symbol definition is needed — confirming a function signature, checking what a type or method does, scanning a package's exported surface, or looking up an external module's API at a specific version. Triggers include "what's the signature of", "look up the Go docs for", "how do I use <package>", "what does <symbol> return", "show me the godoc for", or any moment a Go API detail should be verified rather than recalled from memory. Uses the `scut gotools doc` command, an agent-tuned `go doc`.
---

# Looking up Go documentation with `scut gotools doc`

Go API details — signatures, return types, error contracts — drift between versions and are easy to misremember, especially for external modules. Look them up with `scut gotools doc` instead of recalling them from memory whenever accuracy matters (before calling an unfamiliar function, or when the user asks how an API behaves).

## Why `scut gotools doc` over `go doc`

`go doc` can only see packages that are already part of the current build: a dependency listed in the project's `go.mod`, or a module already downloaded into the local module cache. To look up anything else, you must first run `go get` (which mutates `go.mod`/`go.sum`) or be standing inside the right module to begin with.

`scut gotools doc` has no such constraint — this is its main advantage:

- **The module need not be in the project's `go.mod`.** Look up any public module by import path, including from a directory that is not a Go module at all.
- **The module need not already be in the local Go cache.** It is resolved on demand; you don't have to pre-fetch it with `go get`.
- **No side effects.** Nothing is written to `go.mod`, `go.sum`, or the build list — the project's dependency set is left untouched.
- **Version-pinnable** via `--module-version=<query>` (default `latest`), again without adding the dependency.

For packages already in the build (the standard library, current dependencies) it behaves like `go doc`; the advantage shows up for everything outside it — which is exactly the common case when checking an unfamiliar third-party API. The one requirement for an out-of-build lookup is network access to the module proxy (it fetches on demand).

## Step 1 — resolve `scut`

This skill uses the plugin wrapper at `scripts/scut.sh`. The wrapper prefers a user-installed `scut` on PATH. If none is available, it installs/updates a plugin-managed `scut` binary in the host plugin data directory and then runs it.

Resolve the wrapper from the installed plugin root. For Claude Code, that is:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/scut.sh" --help >/dev/null
```

For hosts that do not expand `${CLAUDE_PLUGIN_ROOT}`, resolve `../../scripts/scut.sh` relative to this skill directory. Do not assume the user's current project contains a `plugins/go-tools` path.

If the wrapper cannot install or run `scut`, stop and report the wrapper's error. Do not fall back to guessing Go API details from memory.

## Step 2 — look up documentation

```bash
/path/to/go-tools/scripts/scut.sh gotools doc [flags] [<lookup> ...]
```

`<lookup>` follows the same grammar as `go doc` — a package, a symbol, a `package.Symbol` pair, or a space-separated `<package> <symbol>`:

| Goal                            | Command                                                |
| ------------------------------- | ------------------------------------------------------ |
| Package overview                | `scripts/scut.sh gotools doc fmt`                                 |
| A symbol in a package           | `scripts/scut.sh gotools doc fmt.Errorf`                          |
| A method on a type              | `scripts/scut.sh gotools doc sync.Mutex.Lock`                     |
| Package + symbol (two args)     | `scripts/scut.sh gotools doc strings Builder`                     |
| A symbol in the current package | `scripts/scut.sh gotools doc MyType` (run from the package's dir) |

### Flags

| Flag                       | Use                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--short`                  | One line per symbol — the fastest way to scan a package's exported surface before drilling in.            |
| `--all`                    | Full documentation for every exported symbol in the package.                                                |
| `--src`                    | The full source of the selected symbol, not just its doc comment.                                           |
| `-u`                       | Include unexported symbols as well as exported ones.                                                        |
| `-c`                       | Case-sensitive symbol matching.                                                                             |
| `--cmd`                    | Document the symbols of a `main` package (normally treated as a command, not a library).                    |
| `--module-version=<query>` | Resolve an **external** package at a version (default `latest`) even if it isn't in the current build list. |

### When to reach for it

- **Before calling an unfamiliar stdlib or third-party function** — confirm the exact signature and error contract rather than guessing.
- **When the user asks "how do I use X" or "what does Y return"** for a Go API.
- **To inspect an external module without adding it to `go.mod`:** `scripts/scut.sh gotools doc --module-version=v1.2.3 github.com/foo/bar.Thing`.
- **To map an unfamiliar package:** run `--short` on the package first, then look up the specific symbol that matters.

## Notes

- This is the agent-tuned counterpart to `go doc`; prefer it for documentation lookups in this environment.
- The plugin wrapper installs `scut` from GitHub Releases with `gh` first, then curl/token fallback, and verifies checksums when the release checksum file is available.
- `--module-version` lookups need network access to the Go module proxy.
- The output is real godoc from the resolved toolchain, so it reflects whichever Go version is installed.
