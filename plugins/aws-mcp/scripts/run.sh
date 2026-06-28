#!/usr/bin/env bash
# MCP launcher for aws-mcp-proxy.
#
# Used as the `command` for the MCP server. Ensures the binary exists before
# launching (covers the very first run and any SessionStart-vs-MCP startup
# race), then exec's it over stdio. Any configured args are forwarded verbatim.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${DIR}/.." && pwd)"

plugin_data_dir() {
  if [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then
    printf '%s\n' "$CLAUDE_PLUGIN_DATA"
    return
  fi
  if [ -n "${CODEX_PLUGIN_DATA:-}" ]; then
    printf '%s\n' "$CODEX_PLUGIN_DATA"
    return
  fi
  if [ -n "${AWS_MCP_PLUGIN_DATA:-}" ]; then
    printf '%s\n' "$AWS_MCP_PLUGIN_DATA"
    return
  fi
  if mkdir -p "${PLUGIN_ROOT}/.data" 2>/dev/null; then
    printf '%s\n' "${PLUGIN_ROOT}/.data"
    return
  fi
  if [ -n "${XDG_CACHE_HOME:-}" ]; then
    printf '%s\n' "${XDG_CACHE_HOME}/ai-tool-plugins/aws-mcp"
    return
  fi
  : "${HOME:?HOME is not set}"
  printf '%s\n' "${HOME}/.cache/ai-tool-plugins/aws-mcp"
}

DATA_DIR="$(plugin_data_dir)"
BIN="${DATA_DIR}/bin/aws-mcp-proxy"

if [ ! -x "$BIN" ]; then
  "${DIR}/install.sh" || true
fi

if [ ! -x "$BIN" ]; then
  echo "[aws-mcp-proxy] binary unavailable; install failed" >&2
  exit 1
fi

exec "$BIN" "$@"
