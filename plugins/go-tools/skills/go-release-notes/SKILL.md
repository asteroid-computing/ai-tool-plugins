---
name: go-release-notes
description: This skill should be used when working on Go code where language, standard-library, command, toolchain, or module behavior may depend on Go release changes newer than the model's knowledge. Triggers include Go modules with a go.mod or go.work file, questions about upgrading Go, modernizing Go code, using a Go feature added in a recent release, checking whether an API exists in a target Go version, or reviewing code against the Go version declared by go.mod. Fetches official Go release notes from go.dev and caches them in the host plugin data directory when available.
---

# Go Release Notes

Use this skill to load official Go release notes into context before writing, reviewing, or explaining Go code that targets a newer Go version than the model can safely recall.

Do not rely on memory for post-cutoff Go behavior. Determine the target Go version from the project, fetch only the missing release-note versions, read the cached text files into context, then apply those notes while doing the user's task.

## Workflow

1. Find the project target version:
   - Prefer the nearest `go.mod` found from the working directory upward.
   - Use the higher of the `go` directive and `toolchain` directive when both are present.
   - If there is no `go.mod`, use an explicit version from the user's request. If neither exists, stop and ask for the target Go version.
2. Choose the baseline version:
   - Use the model or session knowledge cutoff when available. Load release notes for every Go minor version after the last Go release that predates that cutoff, through the target version.
   - If the cutoff is unknown, be conservative and start after Go 1.22.
   - The helper's `--from` value is exclusive: `--from=1.22 --to=1.26` loads Go 1.23, 1.24, 1.25, and 1.26.
3. Run the helper:

```bash
node "${CLAUDE_SKILL_DIR:-plugins/go-tools/skills/go-release-notes}/scripts/go_release_notes.mjs" --project .
```

For Codex or other hosts that do not expand `${CLAUDE_SKILL_DIR}`, resolve the script path relative to this skill directory and run the same command.

Pass an explicit baseline whenever the session provides one:

```bash
node /path/to/go-release-notes/scripts/go_release_notes.mjs --project . --from=1.22
```

4. Read every `text_path` printed by the helper before continuing the Go task.
5. Mention the release-note versions used when the answer or code change depends on them.

## Helper Behavior

The helper:

- Fetches official release notes from `https://go.dev/doc/go1.N`.
- Caches both the source HTML and extracted text in the plugin data directory.
- Uses `CLAUDE_PLUGIN_DATA` for Claude Code, `CODEX_PLUGIN_DATA` if a Codex host provides it, then `GO_TOOLS_PLUGIN_DATA`, then a plugin-local `.data` fallback.
- Reuses cached files unless `--refresh` is passed.
- Prints a machine-readable summary with `--json`.

Useful flags:

| Flag | Purpose |
| --- | --- |
| `--project <dir>` | Start directory for finding `go.mod`; defaults to the current directory. |
| `--go-mod <path>` | Use a specific `go.mod` instead of walking upward. |
| `--from=1.N` | Last version assumed known; release notes after this version are loaded. |
| `--to=1.N` | Target Go version; overrides `go.mod` and `toolchain`. |
| `--cache-dir <dir>` | Override host data-dir detection. |
| `--refresh` | Re-fetch notes even when cached. |
| `--json` | Print JSON instead of the human-readable summary. |

## Failure Handling

If fetching fails because network access is unavailable, use any already cached release notes and clearly state which versions could not be loaded. Do not invent release-note details for missing versions.
