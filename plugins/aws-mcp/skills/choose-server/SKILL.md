---

name: choose-server
description: Decide which AWS MCP server to call (public vs authenticated) and ensure AWS credentials are in place when auth is required.
disable-model-invocation: true
---

# Choosing an AWS MCP server (public vs authenticated)

This plugin registers **two** MCP servers that proxy the **same** AWS MCP endpoint. They differ only in whether outbound requests are SigV4-signed with AWS credentials:

| Server                    | Requests                 | Use for                                      |
| :------------------------ | :----------------------- | :------------------------------------------- |
| `aws-proxy-public`        | Unsigned (`--skip-auth`) | Tools that work **without** AWS credentials. |
| `aws-proxy-authenticated` | SigV4-signed             | Tools that **require** AWS auth.             |

> The proxy does not yet decide per-tool whether signing is needed, so the choice is made here by calling the matching server. This skill is the stopgap until the proxy gains that awareness.

## Which server to use

Both servers expose the **same** AWS MCP Server tools (same `aws___*` names under each server's namespace). Route by tool: the **Knowledge tools** are content lookups that need no AWS account and should go to `aws-proxy-public`; the **API tools** act on your AWS account and require signed requests, so they must go to `aws-proxy-authenticated`.

| Tool                              | Server                    | What it does                                            |
| :-------------------------------- | :------------------------ | :------------------------------------------------------ |
| `aws___search_documentation`      | `aws-proxy-public`        | Search AWS docs, best practices, and skills.            |
| `aws___read_documentation`        | `aws-proxy-public`        | Fetch an AWS docs page as markdown.                     |
| `aws___recommend`                 | `aws-proxy-public`        | Related/recommended docs for a page.                    |
| `aws___list_regions`              | `aws-proxy-public`        | List AWS regions.                                       |
| `aws___get_regional_availability` | `aws-proxy-public`        | Regional availability of services/APIs/CFN resources.   |
| `aws___retrieve_skill`            | `aws-proxy-public`        | Retrieve an AWS skill (workflow/best-practice content). |
| `aws___call_aws`                  | `aws-proxy-authenticated` | Execute an authenticated AWS API call.                  |
| `aws___run_script`                | `aws-proxy-authenticated` | Run Python with authenticated AWS API access.           |
| `aws___get_presigned_url`         | `aws-proxy-authenticated` | Generate pre-signed S3 URLs.                            |
| `aws___get_tasks`                 | `aws-proxy-authenticated` | Poll long-running `call_aws`/`run_script` tasks.        |

Rules:

1. Knowledge tool → `aws-proxy-public` (avoids signing requests that don't need it).
2. API tool → `aws-proxy-authenticated`, and ensure credentials first (below).
3. If a call on `aws-proxy-public` returns an auth/permission error, ensure credentials, then retry the identical call on `aws-proxy-authenticated`.

(Tool catalog: <https://docs.aws.amazon.com/agent-toolkit/latest/userguide/understanding-mcp-server-tools.html>. New tools default to `aws-proxy-public` unless they act on your AWS account.)

## Before using `aws-proxy-authenticated`: ensure credentials

The signed server inherits AWS credentials from the standard chain — it has no token of its own. Before relying on it, confirm credentials resolve. Verify with:

```bash
aws sts get-caller-identity
```

If that fails, credentials are not in place. They come from (in resolution order):

- Environment: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- A profile: `AWS_PROFILE` (or `aws sso login --profile <name>` for SSO)
- An instance/container IAM role (EC2/ECS/EKS)

Region resolves from `AWS_REGION` (or is inferred from the endpoint). If credentials are missing, ask the user to set a profile or export credentials, then have them reconnect the MCP server (a new session, or `/mcp`) so the signed server picks up the environment.

## Endpoints

Both servers proxy the same AWS MCP Server endpoint. The plugin defaults to **Europe (Frankfurt)**. Available regional endpoints:

| Region                             | Identifier     | Endpoint                                   |
| :--------------------------------- | :------------- | :----------------------------------------- |
| Europe (Frankfurt) — **default** | `eu-central-1` | `https://aws-mcp.eu-central-1.api.aws/mcp` |
| US East (N. Virginia)              | `us-east-1`    | `https://aws-mcp.us-east-1.api.aws/mcp`    |

(Authoritative list: <https://docs.aws.amazon.com/general/latest/gr/aws-mcp.html>.)

### Changing the endpoint

To switch regions, edit the plugin's `.mcp.json` and replace the endpoint URL in the `args` of **both** `aws-proxy-public` and `aws-proxy-authenticated` (keep them pointed at the same region), then reconnect the servers (start a new session or run `/mcp`). For a signed (authenticated) endpoint, make sure your AWS credentials are valid in the matching region.

When a user asks to change or check the region, locate `.mcp.json` in the installed plugin, show them the current endpoint, and make the edit to both server entries.

## Notes

- Credentials set after the session started are not picked up until the server is reconnected.
