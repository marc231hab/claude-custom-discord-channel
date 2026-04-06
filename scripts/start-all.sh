#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 /path/to/global.env" >&2
  exit 1
fi

GLOBAL_ENV_FILE="$1"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DIR="$ROOT_DIR/config"
SCRIPT="$ROOT_DIR/scripts/start-claude-channel.sh"

for env_file in "$BASE_DIR"/*.env; do
  [[ -f "$env_file" ]] || continue
  [[ "$env_file" == "$GLOBAL_ENV_FILE" ]] && continue
  "$SCRIPT" "$GLOBAL_ENV_FILE" "$env_file"
done
