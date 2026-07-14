#!/usr/bin/env bash
# MCP launcher for aws-mcp-proxy.
#
# Used as the `command` for the MCP server. Ensures the binary exists before
# launching (covers the very first run and any SessionStart-vs-MCP startup
# race), then exec's it over stdio. Any configured args are forwarded verbatim.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${DIR}/.." && pwd)"

log() { printf '[aws-mcp-proxy] %s\n' "$*" >&2; }

first_writable_dir() {
  local candidate
  for candidate in "$@"; do
    [ -n "$candidate" ] || continue
    if mkdir -p "$candidate" 2>/dev/null && [ -w "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

repo_checkout_data_dir() {
  if [ -d "${PLUGIN_ROOT}/../../.git" ] || [ -d "${PLUGIN_ROOT}/.git" ]; then
    printf '%s\n' "${PLUGIN_ROOT}/.data"
  fi
}

plugin_data_dir() {
  local name value cache_dir dev_dir
  for name in \
    CLAUDE_PLUGIN_DATA \
    CODEX_PLUGIN_DATA \
    CLAUDE_DESKTOP_PLUGIN_DATA \
    CODEX_APP_PLUGIN_DATA \
    AWS_MCP_PLUGIN_DATA \
    ASTEROID_AWS_MCP_PLUGIN_DATA; do
    value="${!name:-}"
    if [ -n "$value" ]; then
      if first_writable_dir "$value"; then
        return 0
      fi
      log "${name} is set but is not writable: ${value}"
      return 1
    fi
  done

  if [ -n "${XDG_CACHE_HOME:-}" ]; then
    cache_dir="${XDG_CACHE_HOME}/ai-tool-plugins/aws-mcp"
  elif [ "$(uname -s)" = "Darwin" ] && [ -n "${HOME:-}" ]; then
    cache_dir="${HOME}/Library/Caches/com.asteroidcomputing.ai-tool-plugins/aws-mcp"
  elif [ -n "${HOME:-}" ]; then
    cache_dir="${HOME}/.cache/ai-tool-plugins/aws-mcp"
  else
    cache_dir=""
  fi

  dev_dir="$(repo_checkout_data_dir)"
  if first_writable_dir "$cache_dir" "$dev_dir"; then
    return 0
  fi

  log "no writable plugin data directory found"
  return 1
}

DATA_DIR="$(plugin_data_dir)" || exit 1
BIN="${DATA_DIR}/bin/aws-mcp-proxy"

if [ ! -x "$BIN" ]; then
  "${DIR}/install.sh" || true
fi

if [ ! -x "$BIN" ]; then
  log "binary unavailable; install failed"
  exit 1
fi

exec "$BIN" "$@"
