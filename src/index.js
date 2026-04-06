import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

const DISCORD_BOT_TOKEN = required('DISCORD_BOT_TOKEN')
const DISCORD_CHANNEL_ID = required('DISCORD_CHANNEL_ID')
const DISCORD_ALLOWED_USER_IDS = (process.env.DISCORD_ALLOWED_USER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const CLAUDE_CHANNEL_SOURCE = process.env.CLAUDE_CHANNEL_SOURCE || 'discord-custom'
const REQUIRE_MENTION = (process.env.REQUIRE_MENTION || 'false').toLowerCase() === 'true'
const CHANNEL_NAME = process.env.CHANNEL_NAME || DISCORD_CHANNEL_ID

let targetChannel = null
const replyToolName = 'discord_reply'

const mcp = new Server(
  { name: `discord-${CHANNEL_NAME}`, version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: `Messages from the Discord channel plugin arrive as <channel source="${CLAUDE_CHANNEL_SOURCE}" channelId="${DISCORD_CHANNEL_ID}" channelName="${CHANNEL_NAME}" authorId="..." authorName="...">...</channel>. Only messages from the configured Discord channel are forwarded. Use the ${replyToolName} tool to reply back into the same Discord channel.`,
  },
)

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: replyToolName,
      description: 'Send a reply message back to the configured Discord channel.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Message text to send to Discord.' },
          replyToMessageId: { type: 'string', description: 'Optional Discord message id to reply to.' },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  ],
}))

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== replyToolName) {
    throw new Error(`Unknown tool: ${request.params.name}`)
  }

  if (!targetChannel) {
    throw new Error('Discord channel is not ready yet')
  }

  const { text, replyToMessageId } = request.params.arguments || {}
  if (!text || typeof text !== 'string') {
    throw new Error('text is required')
  }

  let sent
  if (replyToMessageId) {
    sent = await targetChannel.send({
      content: text,
      reply: { messageReference: replyToMessageId },
    })
  } else {
    sent = await targetChannel.send(text)
  }

  return {
    content: [
      {
        type: 'text',
        text: `Sent Discord message ${sent.id}`,
      },
    ],
  }
})

await mcp.connect(new StdioServerTransport())

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
})

client.once('ready', async () => {
  const channel = await client.channels.fetch(DISCORD_CHANNEL_ID)
  if (!channel || !channel.isTextBased()) {
    console.error(`Configured channel ${DISCORD_CHANNEL_ID} is not a text channel`)
    process.exit(1)
  }
  targetChannel = channel
  console.error(`Discord channel plugin ready for #${CHANNEL_NAME} (${DISCORD_CHANNEL_ID}) as ${client.user?.tag}`)
})

client.on('messageCreate', async (message) => {
  try {
    if (message.author?.bot) return
    if (message.channelId !== DISCORD_CHANNEL_ID) return
    if (DISCORD_ALLOWED_USER_IDS.length > 0 && !DISCORD_ALLOWED_USER_IDS.includes(message.author.id)) return
    if (REQUIRE_MENTION && !message.mentions.users.has(client.user.id)) return

    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: message.content || '',
        meta: {
          channelId: message.channelId,
          channelName: CHANNEL_NAME,
          guildId: message.guildId || '',
          messageId: message.id,
          authorId: message.author.id,
          authorName: message.author.username,
        },
      },
    })
  } catch (error) {
    console.error('Failed to forward Discord message to Claude:', error)
  }
})

await client.login(DISCORD_BOT_TOKEN)
