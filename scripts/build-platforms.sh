#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GO_DIR="$REPO_ROOT/mcp-server-go"
OUT_DIR="$REPO_ROOT/npm-platforms"
VERSION=$(node -p "require('$REPO_ROOT/package.json').version")

echo "Building agent-whiteboard v${VERSION}"

# ── 1. Build the MCP client UI (embedded into the Go binary) ──────────────
echo "→ Building mcp-client UI…"
(cd "$REPO_ROOT" && npm run build:mcp-client)

# ── 2. Cross-compile Go binary for each platform ─────────────────────────
TARGETS=(
  "linux   amd64  linux-x64"
  "linux   arm64  linux-arm64"
  "darwin  amd64  darwin-x64"
  "darwin  arm64  darwin-arm64"
  "windows amd64  win32-x64"
  "windows arm64  win32-arm64"
)

rm -rf "$OUT_DIR"

for target in "${TARGETS[@]}"; do
  read -r goos goarch pkg_suffix <<< "$target"

  pkg_dir="$OUT_DIR/$pkg_suffix"
  bin_dir="$pkg_dir/bin"
  mkdir -p "$bin_dir"

  bin_name="agent-whiteboard"
  if [ "$goos" = "windows" ]; then
    bin_name="agent-whiteboard.exe"
  fi

  echo "→ Compiling ${goos}/${goarch}…"
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
    go build -C "$GO_DIR" -trimpath -ldflags="-s -w" \
    -o "$bin_dir/$bin_name" .

  # Map goarch to npm cpu field
  case "$goarch" in
    amd64) npm_cpu="x64" ;;
    arm64) npm_cpu="arm64" ;;
  esac

  # Map goos to npm os field
  case "$goos" in
    linux)   npm_os="linux" ;;
    darwin)  npm_os="darwin" ;;
    windows) npm_os="win32" ;;
  esac

  cat > "$pkg_dir/package.json" <<PKGJSON
{
  "name": "@agent-whiteboard/${pkg_suffix}",
  "version": "${VERSION}",
  "description": "agent-whiteboard binary for ${goos}/${goarch}",
  "license": "MIT",
  "os": ["${npm_os}"],
  "cpu": ["${npm_cpu}"],
  "files": ["bin/"]
}
PKGJSON

  echo "  ✓ npm-platforms/${pkg_suffix} ($(du -h "$bin_dir/$bin_name" | cut -f1))"
done

echo ""
echo "Done. Platform packages are in ${OUT_DIR}/"
ls -1 "$OUT_DIR"
