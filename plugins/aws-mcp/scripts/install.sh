#!/usr/bin/env bash
# Downloads/updates the aws-mcp-proxy binary from GitHub Releases (latest).
#
# Idempotent: resolves the latest release tag and only downloads when the
# installed version differs (or the binary is missing). If GitHub is
# unreachable but a binary is already installed, the existing binary is kept.
#
# Auth: the source repo is public, so no token is required. Explicit
# GH_TOKEN/GITHUB_TOKEN is used when set (raises GitHub API rate limits);
# otherwise downloads are unauthenticated. The installer does not read `gh`
# CLI credentials implicitly.
#
# Invoked two ways:
#   - SessionStart hook in Claude Code (keeps the binary fresh)
#   - run.sh, when the binary is missing at MCP launch (first-run safety net)
set -uo pipefail

REPO="ajbeck/go-aws-mcp-proxy"
BIN_NAME="aws-mcp-proxy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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
BIN_DIR="${DATA_DIR}/bin"
BIN="${BIN_DIR}/${BIN_NAME}"
VERSION_FILE="${DATA_DIR}/.installed-version"

log() { printf '[aws-mcp-proxy install] %s\n' "$*" >&2; }

# --- Detect OS/arch in Go's GOOS/GOARCH naming -----------------------------
os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$arch" in
  x86_64 | amd64) arch="amd64" ;;
  arm64 | aarch64) arch="arm64" ;;
  *) log "unsupported arch: $arch"; exit 1 ;;
esac
case "$os" in
  darwin | linux) ;;
  *) log "unsupported OS: $os (windows uses a .zip asset; not handled by this hook)"; exit 1 ;;
esac
ASSET="${BIN_NAME}-${os}-${arch}.tar.gz"

# --- Resolve auth ----------------------------------------------------------
token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

# Auth-aware curl wrapper (avoids conditional-header word-splitting bugs).
gh_curl() {
  if [ -n "$token" ]; then
    curl -fsSL -H "Authorization: Bearer $token" "$@"
  else
    curl -fsSL "$@"
  fi
}

# Cached GitHub API response for the latest release.
api_json=""
latest_json() {
  if [ -z "$api_json" ]; then
    api_json="$(gh_curl -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null)"
  fi
  printf '%s' "$api_json"
}

# --- Resolve the latest release tag ----------------------------------------
latest_tag="$(latest_json | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"

if [ -z "$latest_tag" ]; then
  if [ -x "$BIN" ]; then
    log "cannot reach GitHub; using already-installed binary"
    exit 0
  fi
  log "cannot resolve latest release and no binary is installed."
  log "check network access to github.com (or set GH_TOKEN if rate-limited)."
  exit 1
fi

# --- Skip if already up to date --------------------------------------------
installed="$(cat "$VERSION_FILE" 2>/dev/null || true)"
if [ -x "$BIN" ] && [ "$installed" = "$latest_tag" ]; then
  exit 0
fi

# --- Download --------------------------------------------------------------
log "installing ${BIN_NAME} ${latest_tag} (${os}/${arch})"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

download_one() { # $1 = asset filename -> $tmp/$1 ; returns nonzero on failure
  local name="$1" out url
  out="${tmp}/${1}"
  if [ -n "$token" ]; then
    url="$(latest_json | A="$name" python3 -c \
      'import sys,json,os; d=json.load(sys.stdin); print(next((a["url"] for a in d.get("assets",[]) if a["name"]==os.environ["A"]),""))' \
      2>/dev/null)"
    [ -z "$url" ] && return 1
    # -L (not --location-trusted): drop the auth header on the cross-host S3 redirect.
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
download_one "${ASSET}.sha256" || true

# --- Verify checksum (if the .sha256 sidecar was fetched) ------------------
if [ -s "${tmp}/${ASSET}.sha256" ]; then
  expected="$(awk '{print $1}' "${tmp}/${ASSET}.sha256")"
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

# --- Extract + install atomically ------------------------------------------
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
