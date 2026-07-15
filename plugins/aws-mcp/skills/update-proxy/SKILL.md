---
name: update-proxy
description: Manually check and update the aws-mcp-proxy binary used by the aws-mcp plugin.
disable-model-invocation: true
---

# Updating the AWS MCP proxy

Use this skill only when the user explicitly asks to update, refresh, check, reinstall, or verify the `aws-mcp-proxy` binary for the `aws-mcp` plugin.

The plugin's installer is idempotent. It resolves the latest `ajbeck/go-aws-mcp-proxy` GitHub release, compares it with the cached `.installed-version`, and downloads a new binary only when the cached binary is missing or out of date.

## Update procedure

1. Locate the installed `aws-mcp` plugin directory.
   - In a repository checkout, use `plugins/aws-mcp`.
   - In Claude Code, prefer `$CLAUDE_PLUGIN_ROOT` when it is set.
   - In Codex, use the installed plugin root if available; otherwise ask the user where the plugin is installed.
2. Run the plugin installer:

   ```bash
   scripts/install.sh
   ```

   If running from outside the plugin root, call it by absolute path:

   ```bash
   /path/to/aws-mcp/scripts/install.sh
   ```

3. Report whether the installer installed a new release, kept the existing binary, or could not reach GitHub.
4. If the binary changed, tell the user to reconnect the AWS MCP servers so the hosts launch the new process.

## Data directory

The installer chooses the first writable data directory from:

- `CLAUDE_PLUGIN_DATA`
- `CODEX_PLUGIN_DATA`
- `CLAUDE_DESKTOP_PLUGIN_DATA`
- `CODEX_APP_PLUGIN_DATA`
- `AWS_MCP_PLUGIN_DATA`
- `ASTEROID_AWS_MCP_PLUGIN_DATA`
- Host cache fallback, such as `~/Library/Caches/com.asteroidcomputing.ai-tool-plugins/aws-mcp` on macOS
- Plugin-local `.data` for repository checkouts

To update a specific cache, run with an explicit data directory:

```bash
AWS_MCP_PLUGIN_DATA=/path/to/aws-mcp-data /path/to/aws-mcp/scripts/install.sh
```

## Verification

After running the installer, inspect the selected data directory:

```bash
cat /path/to/aws-mcp-data/.installed-version
/path/to/aws-mcp-data/bin/aws-mcp-proxy --version
```

If `--version` is not supported by the installed binary, report the `.installed-version` tag instead.

## Notes

- `run.sh` only invokes the installer when the binary is missing. It does not check for updates on every MCP start.
- Claude Code also runs the installer from the plugin `SessionStart` hook.
- Codex users may need this manual update skill when an existing binary is already present.
- Do not remove the cached binary or data directory unless the user explicitly asks for a clean reinstall.
