---

name: go-docs
description: This skill should be used whenever working with Go and an authoritative package or symbol definition is needed — confirming a function signature, checking what a type or method does, scanning a package's exported surface, or looking up an external module's API at a specific version. Triggers include "what's the signature of", "look up the Go docs for", "how do I use <package>", "what does <symbol> return", "show me the godoc for", or any moment a Go API detail should be verified rather than recalled from memory. Uses the `scut gotools doc` command, an agent-tuned `go doc`.
---

# Looking up Go documentation with `scut gotools doc`

Go API details — signatures, return types, error contracts — drift between versions and are easy to misremember, especially for external modules. Look them up with `scut gotools doc` instead of recalling them from memory whenever accuracy matters (before calling an unfamiliar function, or when the user asks how an API behaves).

## Step 1 — confirm `scut` is installed

This skill depends on the `scut` binary. Before the first lookup in a session, verify it is on PATH:

```bash
command -v scut
```

If that prints a path, proceed to Step 2. If it prints nothing, `scut` is not installed — **stop and tell the user**, with this message:

> This skill needs the `scut` CLI, which isn't on your PATH. See the scut README for installation instructions: https://github.com/ajbeck/scut
>
> The quickest path (review it first if your environment requires it) is the install script:
>
> ```bash
> curl -fsSL https://install-scut.ajbeck.dev | sh
> ```
>
> The README also covers a custom install directory, `go install`, and checksum verification.

Do not install it automatically — installing a tool is the user's decision. Wait for them to install it and start a new shell, then retry the lookup.

## Step 2 — look up documentation

```bash
scut gotools doc [flags] [<lookup> ...]
```

`<lookup>` follows the same grammar as `go doc` — a package, a symbol, a `package.Symbol` pair, or a space-separated `<package> <symbol>`:

| Goal                            | Command                                                |
| ------------------------------- | ------------------------------------------------------ |
| Package overview                | `scut gotools doc fmt`                                 |
| A symbol in a package           | `scut gotools doc fmt.Errorf`                          |
| A method on a type              | `scut gotools doc sync.Mutex.Lock`                     |
| Package + symbol (two args)     | `scut gotools doc strings Builder`                     |
| A symbol in the current package | `scut gotools doc MyType` (run from the package's dir) |

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
- **To inspect an external module without adding it to `go.mod`:** `scut gotools doc --module-version=v1.2.3 github.com/foo/bar.Thing`.
- **To map an unfamiliar package:** run `--short` on the package first, then look up the specific symbol that matters.

## Notes

- This is the agent-tuned counterpart to `go doc`; prefer it for documentation lookups in this environment.
- `--module-version` lookups need network access to the Go module proxy.
- The output is real godoc from the resolved toolchain, so it reflects whichever Go version is installed.
