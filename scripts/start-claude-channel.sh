#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 /path/to/global.env /path/to/channel.env" >&2
  exit 1
fi

GLOBAL_ENV_FILE="$1"
CHANNEL_ENV_FILE="$2"

for file in "$GLOBAL_ENV_FILE" "$CHANNEL_ENV_FILE"; do
  if [[ ! -f "$file" ]]; then
    echo "env file not found: $file" >&2
    exit 1
  fi
done

set -a
source "$GLOBAL_ENV_FILE"
source "$CHANNEL_ENV_FILE"
set +a

: "${PROJECT_DIR:?PROJECT_DIR is required}"
: "${TMUX_SESSION:?TMUX_SESSION is required}"
: "${DISCORD_BOT_TOKEN:?DISCORD_BOT_TOKEN is required}"
: "${DISCORD_CHANNEL_ID:?DISCORD_CHANNEL_ID is required}"

CHANNEL_SERVER_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CHANNEL_SERVER="$CHANNEL_SERVER_DIR/src/index.js"

if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  echo "tmux session already exists: $TMUX_SESSION"
  exit 0
fi

tmux new-session -d -s "$TMUX_SESSION" \
  "cd $PROJECT_DIR && \
   export DISCORD_BOT_TOKEN='$DISCORD_BOT_TOKEN' && \
   export DISCORD_CHANNEL_ID='$DISCORD_CHANNEL_ID' && \
   export DISCORD_ALLOWED_USER_IDS='${DISCORD_ALLOWED_USER_IDS:-}' && \
   export CHANNEL_NAME='${CHANNEL_NAME:-$TMUX_SESSION}' && \
   export CLAUDE_CHANNEL_SOURCE='${CLAUDE_CHANNEL_SOURCE:-custom-discord}' && \
   export REQUIRE_MENTION='${REQUIRE_MENTION:-false}' && \
   claude mcp add-json custom-discord '{\"command\":\"node\",\"args\":[\"$CHANNEL_SERVER\"]}' >/dev/null 2>&1 || true; \
   claude --dangerously-skip-permissions --dangerously-load-development-channels server:custom-discord"

echo "started $TMUX_SESSION for $PROJECT_DIR on Discord channel $DISCORD_CHANNEL_ID"
