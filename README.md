# Custom Discord channel plugin for Claude Code

This project gives you one Discord-bound MCP channel server per Claude Code tmux session so each project only listens to its own Discord channel.

## What it does

- Uses a custom MCP channel server instead of the shared official Discord plugin
- Forwards messages from exactly one Discord channel into one Claude Code session
- Forwards any attachments on those messages, inlined into the message text as `[Attachment: name | mime-type | sizeKB | url]` lines
- Exposes a reply tool so Claude can answer back into that same channel
- Exposes a download tool so Claude can fetch attachment URLs to local files and then Read them (images are read multimodally, so screenshots work)
- Lets you run one tmux session per project without cross-talk

## Files

- `src/index.js` - custom Discord MCP channel server
- `config/*.env.example` - per-project environment templates
- `scripts/start-claude-channel.sh` - start one tmux-backed Claude session
- `scripts/start-all.sh` - start all configured sessions

## Prereqs

- Node.js installed
- `claude` CLI installed and logged in with your subscription account
- `tmux` installed
- A Discord bot token with access to the target server/channels
- Claude Code v2.1.80+ for custom channels

## Install dependencies

```bash
cd /path/to/claude-custom-discord-channel
npm install
```

## Configure one project channel

1. Create the shared global secret file:

```bash
cp config/global.env.example config/global.env
```

2. Edit `config/global.env` and set the real bot token.

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_ALLOWED_USER_IDS=your_discord_user_id_here
REQUIRE_MENTION=false
```

3. Copy a project example env file:

```bash
cp config/project.env.example config/project.env
```

4. Edit it with only project-specific values.

Example:

```bash
DISCORD_CHANNEL_ID=your_discord_channel_id_here
CHANNEL_NAME=your-channel-name
CLAUDE_CHANNEL_SOURCE=your-channel-source
PROJECT_DIR=/absolute/path/to/your/project
TMUX_SESSION=your-tmux-session-name
```

## Start one session

```bash
bash scripts/start-claude-channel.sh config/global.env config/project.env
```

## Start all sessions

```bash
bash scripts/start-all.sh config/global.env
```

## Inspect tmux

```bash
tmux ls
tmux attach -t your-tmux-session-name
```

Detach with `Ctrl-b d`.

## Important note

This uses Claude Code development channels:

```bash
claude --dangerously-load-development-channels server:custom-discord
```

That is expected for custom channels during preview.

## MCP tools exposed to Claude

- `discord_reply(text, replyToMessageId?)` — sends a message back to the bound Discord channel.
- `discord_download_attachment(url, filename?)` — downloads an attachment URL (taken from the `[Attachment: ... | url]` line in the forwarded message) into `~/.claude/channels/discord/inbox/<timestamp>-<name>` and returns the local path. Use `Read` on that path afterward (images are multimodal).

## Attachment flow

When a Discord user posts an image, PDF, log file, etc. into the bound channel, the message arrives to Claude like:

```
<channel source="..." channelId="..." authorId="..." authorName="...">
Here is the error I'm seeing

[Attachment: error-screenshot.png | image/png | 184.3KB | https://cdn.discordapp.com/attachments/.../error-screenshot.png]
</channel>
```

Claude can then call `discord_download_attachment` with that URL to pull it down, and `Read` the local file.

## Notes

