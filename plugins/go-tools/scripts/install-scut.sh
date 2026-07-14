#!/usr/bin/env bash
# Downloads/updates the scut binary from GitHub Releases (latest).
#
# Installs into this plugin's data dir, not the user's global PATH. The
# go-docs skill should invoke scripts/scut.sh, which prefers any user-installed
# scut on PATH and falls back to this plugin-managed binary.
#
# Auth: the source repo is public, so no token is required. The installer
# prefers the `gh` CLI when available so logged-in hosts use authenticated
# GitHub API/downloads and avoid unauthenticated rate limits. If `gh` is not
# available or cannot access the release, it falls back to curl. Explicit
# GH_TOKEN/GITHUB_TOKEN is used by the curl fallback when set.
set -uo pipefail

REPO="ajbeck/scut"
BIN_NAME="scut"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { printf '[go-tools scut install] %s\n' "$*" >&2; }

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
    printf '%s\n' "${PLUGIN_ROOT}/.data/scut"
  fi
}

plugin_data_dir() {
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
      if first_writable_dir "${value}/scut"; then
        return 0
      fi
      log "${name} is set but ${value}/scut is not writable"
      return 1
    fi
  done

  if [ -n "${XDG_CACHE_HOME:-}" ]; then
    cache_dir="${XDG_CACHE_HOME}/ai-tool-plugins/go-tools/scut"
  elif [ "$(uname -s)" = "Darwin" ] && [ -n "${HOME:-}" ]; then
    cache_dir="${HOME}/Library/Caches/com.asteroidcomputing.ai-tool-plugins/go-tools/scut"
  elif [ -n "${HOME:-}" ]; then
    cache_dir="${HOME}/.cache/ai-tool-plugins/go-tools/scut"
  else
    cache_dir=""
  fi

  dev_dir="$(repo_checkout_data_dir)"
  if first_writable_dir "$cache_dir" "$dev_dir"; then
    return 0
  fi

  log "no writable scut data directory found"
  return 1
}

DATA_DIR="$(plugin_data_dir)" || exit 1
BIN_DIR="${DATA_DIR}/bin"
BIN="${BIN_DIR}/${BIN_NAME}"
VERSION_FILE="${DATA_DIR}/.installed-version"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$arch" in
  x86_64 | amd64) arch="amd64" ;;
  arm64 | aarch64) arch="arm64" ;;
  *) log "unsupported arch: $arch"; exit 1 ;;
esac
case "$os" in
  darwin | linux) ;;
  *) log "unsupported OS: $os"; exit 1 ;;
esac

token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

gh_available() {
  command -v gh >/dev/null 2>&1
}

latest_tag_from_gh() {
  gh_available || return 1
  GH_PROMPT_DISABLED=1 gh release view --repo "$REPO" --json tagName --jq '.tagName' 2>/dev/null
}

gh_curl() {
  if [ -n "$token" ]; then
    curl -fsSL -H "Authorization: Bearer $token" "$@"
  else
    curl -fsSL "$@"
  fi
}

api_json=""
latest_json() {
  if [ -z "$api_json" ]; then
    api_json="$(gh_curl -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null)"
  fi
  printf '%s' "$api_json"
}

latest_tag_from_curl() {
  latest_json | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/'
}

latest_tag="$(latest_tag_from_gh || true)"
if [ -z "$latest_tag" ]; then
  latest_tag="$(latest_tag_from_curl)"
fi

if [ -z "$latest_tag" ]; then
  if [ -x "$BIN" ]; then
    log "cannot reach GitHub; using already-installed binary"
    exit 0
  fi
  log "cannot resolve latest release and no binary is installed"
  exit 1
fi

installed="$(cat "$VERSION_FILE" 2>/dev/null || true)"
if [ -x "$BIN" ] && [ "$installed" = "$latest_tag" ]; then
  exit 0
fi

ASSET="${BIN_NAME}-${latest_tag}-${os}-${arch}.tar.gz"

log "installing ${BIN_NAME} ${latest_tag} (${os}/${arch})"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

download_one() {
  local name="$1" out url
  out="${tmp}/${1}"
  if gh_available; then
    if GH_PROMPT_DISABLED=1 gh release download "$latest_tag" --repo "$REPO" --pattern "$name" \
      --dir "$tmp" --clobber >/dev/null 2>&1 && [ -s "$out" ]; then
      return 0
    fi
  fi
  if [ -n "$token" ]; then
    url="$(latest_json | A="$name" python3 -c \
      'import sys,json,os; d=json.load(sys.stdin); print(next((a["url"] for a in d.get("assets",[]) if a["name"]==os.environ["A"]),""))' \
      2>/dev/null)"
    [ -z "$url" ] && return 1
    curl -fsSL -H "Authorization: Bearer $token" -H "Accept: application/octet-stream" \
      -o "$out" "$url"
  else
    url="$(latest_json | grep -o '"browser_download_url": *"[^"]*"' \
      | sed -E 's/.*"(https[^"]+)".*/\1/' | grep -m1 -- "/${name}$")"
    [ -z "$url" ] && return 1
    curl -fsSL -o "$out" "$url"
  fi
}

if ! download_one "$ASSET"; then
  log "download failed for ${ASSET}"
  [ -x "$BIN" ] && { log "keeping existing binary"; exit 0; }
  exit 1
fi
download_one "checksums.txt" || true

if [ -s "${tmp}/checksums.txt" ]; then
  expected="$(awk -v asset="$ASSET" '$2 == asset {print $1}' "${tmp}/checksums.txt")"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${tmp}/${ASSET}" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "${tmp}/${ASSET}" | awk '{print $1}')"
  fi
  if [ -n "$expected" ] && [ "$expected" != "$actual" ]; then
    log "checksum mismatch for ${ASSET}: expected ${expected}, got ${actual}"
    exit 1
  fi
fi

tar -xzf "${tmp}/${ASSET}" -C "$tmp"
src="$(find "$tmp" -type f -name "$BIN_NAME" -perm -u+x 2>/dev/null | head -n1)"
[ -z "$src" ] && src="$(find "$tmp" -type f -name "$BIN_NAME" 2>/dev/null | head -n1)"
if [ -z "$src" ]; then
  log "binary '${BIN_NAME}' not found inside ${ASSET}"
  exit 1
fi

mkdir -p "$BIN_DIR"
chmod +x "$src"
mv -f "$src" "$BIN"
printf '%s' "$latest_tag" > "$VERSION_FILE"
log "installed to ${BIN} (${latest_tag})"
