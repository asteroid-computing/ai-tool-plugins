#!/usr/bin/env bash
# Resolves scut for plugin skills. Prefer a user-installed scut on PATH; if it
# is missing, install/use the plugin-managed copy from the plugin data dir.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

scut_data_dir() {
  local name value cache_dir dev_dir
  for name in \
    CLAUDE_PLUGIN_DATA \
    CODEX_PLUGIN_DATA \
    CLAUDE_DESKTOP_PLUGIN_DATA \
    CODEX_APP_PLUGIN_DATA \
    GO_TOOLS_PLUGIN_DATA \
    ASTEROID_GO_TOOLS_PLUGIN_DATA; do
    value="${!name:-}"
    if [ -n "$value" ]; then
      printf '%s\n' "${value}/scut"
      return
    fi
  done

  if [ -n "${XDG_CACHE_HOME:-}" ]; then
    printf '%s\n' "${XDG_CACHE_HOME}/ai-tool-plugins/go-tools/scut"
    return
  fi
  if [ "$(uname -s)" = "Darwin" ] && [ -n "${HOME:-}" ]; then
    printf '%s\n' "${HOME}/Library/Caches/com.asteroidcomputing.ai-tool-plugins/go-tools/scut"
    return
  fi
  if [ -n "${HOME:-}" ]; then
    printf '%s\n' "${HOME}/.cache/ai-tool-plugins/go-tools/scut"
    return
  fi
  if [ -d "${PLUGIN_ROOT}/../../.git" ] || [ -d "${PLUGIN_ROOT}/.git" ]; then
    printf '%s\n' "${PLUGIN_ROOT}/.data/scut"
  fi
}

if system_scut="$(command -v scut 2>/dev/null)"; then
  exec "$system_scut" "$@"
fi

DATA_DIR="$(scut_data_dir || true)"
if [ -z "$DATA_DIR" ]; then
  printf '[go-tools scut] no scut data directory is available\n' >&2
  exit 1
fi

BIN="${DATA_DIR}/bin/scut"
if [ -x "$BIN" ]; then
  exec "$BIN" "$@"
fi

"${SCRIPT_DIR}/install-scut.sh" || true

if [ ! -x "$BIN" ]; then
  printf '[go-tools scut] scut is unavailable; install failed\n' >&2
  exit 1
fi

exec "$BIN" "$@"
