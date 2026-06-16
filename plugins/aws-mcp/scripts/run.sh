#!/usr/bin/env bash
# MCP launcher for aws-mcp-proxy.
#
# Used as the `command` for the MCP server. Ensures the binary exists before
# launching (covers the very first run and any SessionStart-vs-MCP startup
# race), then exec's it over stdio. Any args configured in .mcp.json are
# forwarded verbatim.
set -uo pipefail

: "${CLAUDE_PLUGIN_DATA:?CLAUDE_PLUGIN_DATA is not set}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${CLAUDE_PLUGIN_DATA}/bin/aws-mcp-proxy"

if [ ! -x "$BIN" ]; then
  "${DIR}/install.sh" || true
fi

if [ ! -x "$BIN" ]; then
  echo "[aws-mcp-proxy] binary unavailable; install failed" >&2
  exit 1
fi

exec "$BIN" "$@"
