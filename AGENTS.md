# Asteroid Computing AI Tool Plugins

This repository is Asteroid Computing's shared plugin marketplace for Codex and Claude Code. It publishes installable plugins, skills, MCP server definitions, hooks, scripts, and marketplace metadata for both agent hosts.

## Project Structure

- `.agents/plugins/marketplace.json` - Codex marketplace metadata and plugin availability policy.
- `.claude-plugin/marketplace.json` - Claude Code marketplace metadata.
- `plugins/` - plugin implementations. Each plugin should carry its own host-specific manifests, skills, scripts, hooks, and runtime notes.
- `plugins/*/.codex-plugin/plugin.json` - Codex plugin manifest for a plugin.
- `plugins/*/skills/**/SKILL.md` - skill instructions shared by supported hosts where practical.
- `plugins/*/skills/**/agents/openai.yaml` - Codex-specific skill metadata and invocation policy.
- `plugins/*/hooks/` - Claude Code hook definitions when a plugin needs them.
- `plugins/*/scripts/` - plugin-local install, launch, or helper scripts.
- `scripts/validate-plugin.mjs` - dependency-free metadata validator for marketplace and plugin manifests.
- `.github/workflows/` - release and validation automation.

## Agent Guidance

Use progressive discovery. Start with this file and `README.md`, then inspect the nearest manifest, skill, script, or reference file for the specific plugin you are changing. Do not assume the top-level docs contain complete behavioral details.

Treat the code and metadata in the plugin directories as the up-to-date, authoritative source for implementation details. In particular, verify current plugin shape in `plugins/<name>/`, Codex behavior in `.codex-plugin/plugin.json` and `agents/openai.yaml`, Claude Code behavior in Claude metadata and hooks, and runtime behavior in scripts before editing or documenting behavior.

When changing marketplace or plugin metadata, keep Codex and Claude Code support aligned where the plugin is intended to be dual-host. Run the validator after metadata changes:

```shell
node scripts/validate-plugin.mjs
```

Use `--strict-codex` only when checking Codex-only ingestion behavior.
