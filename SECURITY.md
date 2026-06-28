# Security

## Reporting a Vulnerability

Please report suspected vulnerabilities privately to `aj@asteroidcomputing.com`.
Include the affected plugin, a short impact summary, and reproduction steps when
you can share them safely.

## Runtime Downloads

The `aws-mcp` plugin downloads the `aws-mcp-proxy` binary from public GitHub
Releases at `ajbeck/go-aws-mcp-proxy`.

- Downloads are unauthenticated by default.
- `GH_TOKEN` or `GITHUB_TOKEN` may be set explicitly to raise GitHub API rate
  limits.
- The installer does not read `gh` CLI credentials implicitly.
- A `.sha256` sidecar is verified when the release provides one.

## Credentials

This repository does not store AWS credentials. The authenticated AWS MCP server
inherits credentials from the standard AWS provider chain at runtime, such as
environment variables, `AWS_PROFILE`, AWS SSO, or instance/container roles.

Do not commit local tool settings, plugin runtime caches, cloud credentials, or
generated authentication files to this repository.
