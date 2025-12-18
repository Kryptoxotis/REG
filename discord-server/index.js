import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Client, GatewayIntentBits, Events } from 'discord.js'

const app = express()
const httpServer = createServer(app)

// Socket.io with CORS for frontend
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Discord client with necessary intents
const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
})

// Configuration
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1445647668125892620'
const PORT = process.env.PORT || 3001

// Role IDs for access control
const ROLES = {
  ADMIN: '1450913100940447966',
  IT: '1450913102639005788',
  MANAGER: '1450913104098492580',
  AGENT: '1450913105482612736'
}

// Channel configuration
const CHANNELS = {
  '1450913248000868618': { name: 'announcements', category: 'INFO', roles: [] },
  '1450913249750159562': { name: 'rules', category: 'INFO', roles: [] },
  '1450913251281080613': { name: 'general', category: 'GENERAL', roles: [] },
  '1450913252551819325': { name: 'random', category: 'GENERAL', roles: [] },
  '1450913256834207874': { name: 'properties', category: 'WORK', roles: [] },
  '1450913258440495275': { name: 'leads', category: 'WORK', roles: [] },
  '1450913259828809865': { name: 'deals', category: 'WORK', roles: [] },
  '1450913262442119258': { name: 'admin', category: 'RESTRICTED', roles: [ROLES.ADMIN] },
  '1450913264136617987': { name: 'it-support', category: 'RESTRICTED', roles: [ROLES.ADMIN, ROLES.IT] }
}

// Track connected clients and their subscriptions
const clients = new Map()

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    discord: discord.isReady() ? 'connected' : 'disconnected',
    clients: clients.size
  })
})

// Discord ready event
discord.once(Events.ClientReady, (client) => {
  console.log(`Discord bot ready as ${client.user.tag}`)
})

// Discord message event - broadcast to subscribed clients
discord.on(Events.MessageCreate, async (message) => {
  // Ignore DMs and messages from bots (except webhooks which show user info)
  if (!message.guild || message.guild.id !== GUILD_ID) return

  const channelId = message.channel.id
  if (!CHANNELS[channelId]) return

  const formattedMessage = {
    id: message.id,
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      avatar: message.author.avatarURL({ size: 32 }) ||
        `https://cdn.discordapp.com/embed/avatars/${parseInt(message.author.discriminator || '0') % 5}.png`
    },
    timestamp: message.createdTimestamp,
    attachments: message.attachments.map(a => ({
      url: a.url,
      name: a.name
    }))
  }

  // Broadcast to all clients subscribed to this channel
  for (const [socketId, clientData] of clients) {
    if (clientData.channels.has(channelId)) {
      io.to(socketId).emit('message', { channelId, message: formattedMessage })
    }
  }
})

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  clients.set(socket.id, {
    discordId: null,
    channels: new Set()
  })

  // Authenticate with Discord user ID
  socket.on('auth', async (data) => {
    const { discordId } = data
    if (!discordId) return socket.emit('error', { message: 'Discord ID required' })

    try {
      const guild = discord.guilds.cache.get(GUILD_ID)
      if (!guild) return socket.emit('error', { message: 'Guild not found' })

      const member = await guild.members.fetch(discordId).catch(() => null)
      if (!member) return socket.emit('error', { message: 'Not a member of the server' })

      const clientData = clients.get(socket.id)
      clientData.discordId = discordId
      clientData.memberRoles = member.roles.cache.map(r => r.id)

      socket.emit('authenticated', { success: true })
      console.log(`Client ${socket.id} authenticated as ${discordId}`)
    } catch (err) {
      console.error('Auth error:', err)
      socket.emit('error', { message: 'Authentication failed' })
    }
  })

  // Subscribe to a channel
  socket.on('subscribe', async (data) => {
    const { channelId } = data
    const clientData = clients.get(socket.id)

    if (!clientData.discordId) {
      return socket.emit('error', { message: 'Not authenticated' })
    }

    const channelConfig = CHANNELS[channelId]
    if (!channelConfig) {
      return socket.emit('error', { message: 'Channel not found' })
    }

    // Check access
    if (channelConfig.roles.length > 0) {
      const hasAccess = channelConfig.roles.some(role =>
        clientData.memberRoles.includes(role)
      )
      if (!hasAccess) {
        return socket.emit('error', { message: 'No access to this channel' })
      }
    }

    clientData.channels.add(channelId)
    socket.emit('subscribed', { channelId })
    console.log(`Client ${socket.id} subscribed to ${channelId}`)
  })

  // Unsubscribe from a channel
  socket.on('unsubscribe', (data) => {
    const { channelId } = data
    const clientData = clients.get(socket.id)
    clientData.channels.delete(channelId)
    socket.emit('unsubscribed', { channelId })
  })

  // Get channel messages (initial load)
  socket.on('getMessages', async (data) => {
    const { channelId, limit = 50 } = data
    const clientData = clients.get(socket.id)

    if (!clientData.discordId) {
      return socket.emit('error', { message: 'Not authenticated' })
    }

    try {
      const channel = discord.channels.cache.get(channelId)
      if (!channel) {
        return socket.emit('error', { message: 'Channel not found' })
      }

      const messages = await channel.messages.fetch({ limit: Math.min(limit, 100) })
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          avatar: msg.author.avatarURL({ size: 32 }) ||
            `https://cdn.discordapp.com/embed/avatars/${parseInt(msg.author.discriminator || '0') % 5}.png`
        },
        timestamp: msg.createdTimestamp,
        attachments: msg.attachments.map(a => ({
          url: a.url,
          name: a.name
        }))
      })).reverse()

      socket.emit('messages', { channelId, messages: formattedMessages })
    } catch (err) {
      console.error('Get messages error:', err)
      socket.emit('error', { message: 'Failed to get messages' })
    }
  })

  // Send message via webhook
  socket.on('sendMessage', async (data) => {
    const { channelId, content, username, avatarUrl } = data
    const clientData = clients.get(socket.id)

    if (!clientData.discordId) {
      return socket.emit('error', { message: 'Not authenticated' })
    }

    if (!content || content.trim().length === 0) {
      return socket.emit('error', { message: 'Message content required' })
    }

    try {
      const channel = discord.channels.cache.get(channelId)
      if (!channel) {
        return socket.emit('error', { message: 'Channel not found' })
      }

      // Get or create webhook
      const webhooks = await channel.fetchWebhooks()
      let webhook = webhooks.find(w => w.name === 'REG Dashboard')

      if (!webhook) {
        webhook = await channel.createWebhook({ name: 'REG Dashboard' })
      }

      // Send via webhook
      const sent = await webhook.send({
        content: content,
        username: username || 'Unknown',
        avatarURL: avatarUrl
      })

      socket.emit('messageSent', {
        success: true,
        message: {
          id: sent.id,
          content: sent.content,
          timestamp: sent.createdTimestamp
        }
      })
    } catch (err) {
      console.error('Send message error:', err)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // Get accessible channels for user
  socket.on('getChannels', () => {
    const clientData = clients.get(socket.id)

    if (!clientData.discordId) {
      return socket.emit('error', { message: 'Not authenticated' })
    }

    const accessibleChannels = {}

    for (const [channelId, config] of Object.entries(CHANNELS)) {
      // Check access
      let hasAccess = config.roles.length === 0
      if (!hasAccess) {
        hasAccess = config.roles.some(role => clientData.memberRoles.includes(role))
      }

      if (hasAccess) {
        if (!accessibleChannels[config.category]) {
          accessibleChannels[config.category] = []
        }
        accessibleChannels[config.category].push({
          id: channelId,
          name: config.name,
          category: config.category
        })
      }
    }

    socket.emit('channels', { channels: accessibleChannels })
  })

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    clients.delete(socket.id)
  })
})

// Start server
async function start() {
  try {
    // Login to Discord
    await discord.login(process.env.DISCORD_BOT_TOKEN)
    console.log('Logged into Discord')

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`WebSocket server running on port ${PORT}`)
    })
  } catch (err) {
    console.error('Failed to start:', err)
    process.exit(1)
  }
}

start()
