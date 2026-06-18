# asteroid-computing-tools

Asteroid Computing's [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces). A catalog of plugins you can install into Claude Code.

## Add the marketplace

```shell
/plugin marketplace add asteroid-computing/ai-tool-plugins
```

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

## License

[Apache-2.0](./LICENSE).
