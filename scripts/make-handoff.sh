#!/usr/bin/env bash
# Build dist/delibra-engine.zip — engine only, no git, no DELIBRA_DATA.
# Usage: ./scripts/make-handoff.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="delibra-engine"
STAGE="$(mktemp -d)"
OUT="$ROOT/dist"
ZIP="$OUT/${NAME}.zip"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

echo "staging engine from $ROOT"

mkdir -p "$STAGE/$NAME/delibra"
rsync -a \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='node_modules' \
  --exclude='.bridge' \
  --exclude='.cursor' \
  --exclude='dist' \
  --exclude='*.bak' \
  --exclude='.tmp-*' \
  "$ROOT/" "$STAGE/$NAME/delibra/"

cp "$ROOT/scripts/handoff-START.txt" "$STAGE/$NAME/START.txt"

mkdir -p "$OUT"
rm -f "$ZIP"
( cd "$STAGE" && zip -r -q "$ZIP" "$NAME" )

BYTES=$(wc -c < "$ZIP" | tr -d ' ')
echo "wrote $ZIP ($BYTES bytes)"
echo ""
echo "Send together with your .lbr export:"
echo "  1. $ZIP"
echo "  2. <libra>.lbr   (gallery → Export)"
