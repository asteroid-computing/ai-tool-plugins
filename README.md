# asteroid-computing-tools

Asteroid Computing's plugin marketplace for Claude Code and Codex.

## Add the marketplace

### Claude Code

```shell
/plugin marketplace add asteroid-computing/ai-tool-plugins
```

### Codex

```shell
codex plugin marketplace add asteroid-computing/ai-tool-plugins
```

Then launch Codex and run `/plugins` to browse and install plugins from **Asteroid Computing Tools**.

Codex marketplace metadata lives in [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json). Plugins are kept dual-host where possible: Claude Code keeps its native metadata, and Codex-specific behavior lives in `.codex-plugin/plugin.json` and skill `agents/openai.yaml` sidecars.

## Validate plugins

This repo uses a dependency-free Node validator for shared marketplace and plugin metadata:

```shell
node scripts/validate-plugin.mjs plugins/aws-mcp
```

Run it without arguments to validate every plugin discovered under `plugins/`. Use `--strict-codex` when you specifically want Codex-only ingestion checks; that mode may flag Claude-specific metadata that is intentionally kept in shared skills.

See [SECURITY.md](./SECURITY.md) for runtime download, credential handling, and vulnerability reporting notes.

## Plugins

### `aws-mcp`

Gives Claude AWS access through the [AWS MCP Server](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/), bridged by the native-binary [`go-aws-mcp-proxy`](https://github.com/ajbeck/go-aws-mcp-proxy) (a Go rewrite of [`aws/mcp-proxy-for-aws`](https://github.com/aws/mcp-proxy-for-aws) that ships a single binary instead of a Python/`uv` runtime).

```shell
/plugin install aws-mcp@asteroid-computing-tools
```

**What it does**

- A `SessionStart` hook downloads the `aws-mcp-proxy` binary from GitHub Releases into the plugin's persistent data dir, and keeps it on the latest release (idempotent — only re-downloads on a version change).
- It registers two MCP servers against the same AWS MCP Server endpoint: `aws-proxy-public` (unsigned requests, for tools that need no AWS credentials) and `aws-proxy-authenticated` (SigV4-signed, for tools that act on your account).
- The `choose-server` skill (`/aws-mcp:choose-server`) tells Claude which server to use per tool and how to ensure AWS credentials are in place.

**Default endpoint:** Europe (Frankfurt), `https://aws-mcp.eu-central-1.api.aws/mcp`. To change regions, edit `args` in the plugin's `.mcp.json` (both servers) — see the `choose-server` skill for the regional endpoint list.

**Credentials:** the authenticated server inherits AWS credentials from the standard chain (environment variables, `AWS_PROFILE`, SSO, or an instance/container role). Region resolves from `AWS_REGION` or is inferred from the endpoint.

**Codex status:** marketplace, plugin metadata, skill metadata, and MCP server definitions are present. Codex does not currently pass Claude-style plugin root/data environment variables into MCP processes; its manifest uses `cwd: "."` so relative launchers run from the installed plugin root, and the proxy binary cache falls back to a writable user cache when no host-provided plugin data dir is available. Plugin-local `.data` writes are reserved for local development checkouts.

### `go-tools`

Skills for writing and reviewing idiomatic Go, targeting **Go 1.26**. The rules are distilled from [Effective Go](https://go.dev/doc/effective_go), the [Google Go Style Guide](https://google.github.io/styleguide/go/), and Go release notes.

```shell
/plugin install go-tools@asteroid-computing-tools
```

**Skills**

- **`/go-tools:go-rules`** — explicit-invoke. Routes to a topic-organised ruleset (naming, errors, types, concurrency, testing, imports, control flow, doc comments) using progressive disclosure, so only the rule files relevant to the task are read. The ruleset covers post-training-cutoff Go features (Go 1.21–1.26: `min`/`max`/`clear`, `slices`/`maps`/`cmp`, iterators, `errors.AsType`, `new(expr)`, and the Go 1.26 `crypto`/`go fix` changes), keeping generated and reviewed code current rather than reverting to older idioms.
- **`/go-tools:go-review`** — explicit-invoke. Audits existing Go against the `go-rules` ruleset: dispatches five parallel reviewer sub-agents (correctness, API design, idiom, modernisation, test quality), runs `go vet` and a dependency-freshness check (`go list -m -u`, `govulncheck`), and prints a severity-classified report with rule citations. `--apply` auto-applies only mechanical and complete-local fixes.
- **`go-docs`** — auto-loads when a Go API needs verifying. Uses `scut gotools doc` (an agent-tuned `go doc`) to look up package and symbol documentation, including external modules at a specific version. It prefers a user-installed [`scut`](https://github.com/ajbeck/scut) on PATH and can bootstrap a plugin-local copy from GitHub Releases when needed.
- **`go-release-notes`** — auto-loads when a Go task depends on release behavior newer than the model can safely recall. It reads the module's `go.mod`, fetches official release notes from `go.dev` for each missing Go minor version, and caches them in the host plugin data directory when available.

**Codex status:** marketplace, plugin metadata, and skill metadata are present. Shared skills keep Claude-specific invocation metadata where needed; Codex-specific invocation policy lives in each skill's `agents/openai.yaml`.

## License

[Apache-2.0](./LICENSE).
