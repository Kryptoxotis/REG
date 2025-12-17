import express from 'express'
import { Client, GatewayIntentBits } from 'discord.js'
import { updatePage } from '../utils/notion.js'
import logger from '../utils/logger.js'

const router = express.Router()

// Discord configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1445647668125892620'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const REDIRECT_URI = `${FRONTEND_URL}/auth/discord/callback`

// Discord role IDs
const ROLES = {
  ADMIN: '1450913100940447966',
  IT: '1450913102639005788',
  MANAGER: '1450913104098492580',
  AGENT: '1450913105482612736'
}

// Channel configuration with required roles
const CHANNELS = {
  // Public channels - everyone can see
  '1450913248000868618': { name: 'announcements', category: 'INFO', roles: [] },
  '1450913249750159562': { name: 'rules', category: 'INFO', roles: [] },
  '1450913251281080613': { name: 'general', category: 'GENERAL', roles: [] },
  '1450913252551819325': { name: 'random', category: 'GENERAL', roles: [] },
  '1450913256834207874': { name: 'properties', category: 'WORK', roles: [] },
  '1450913258440495275': { name: 'leads', category: 'WORK', roles: [] },
  '1450913259828809865': { name: 'deals', category: 'WORK', roles: [] },
  // Restricted channels
  '1450913262442119258': { name: 'admin', category: 'RESTRICTED', roles: [ROLES.ADMIN] },
  '1450913264136617987': { name: 'it-support', category: 'RESTRICTED', roles: [ROLES.ADMIN, ROLES.IT] }
}

// Initialize Discord client (for bot operations)
let discordClient = null

async function getDiscordClient() {
  if (!discordClient) {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    })
    await discordClient.login(DISCORD_BOT_TOKEN)
    logger.info('Discord bot connected')
  }
  return discordClient
}

// Auth middleware - require logged in user
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

// OAuth2: Generate login URL
router.get('/auth/url', requireAuth, (req, res) => {
  const state = Buffer.from(JSON.stringify({
    userId: req.session.user.id,
    timestamp: Date.now()
  })).toString('base64')

  req.session.discordOAuthState = state

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state: state
  })

  res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` })
})

// OAuth2: Handle callback
router.post('/auth/callback', requireAuth, async (req, res) => {
  try {
    const { code, state } = req.body

    // Validate state
    if (state !== req.session.discordOAuthState) {
      return res.status(400).json({ error: 'Invalid state parameter' })
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      logger.error('Discord token exchange failed', { error })
      return res.status(400).json({ error: 'Failed to exchange code for token' })
    }

    const tokens = await tokenResponse.json()

    // Get user info from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })

    if (!userResponse.ok) {
      return res.status(400).json({ error: 'Failed to get Discord user info' })
    }

    const discordUser = await userResponse.json()

    // Store Discord info in session
    req.session.user.discordId = discordUser.id
    req.session.user.discordUsername = discordUser.username
    req.session.discordAccessToken = tokens.access_token

    // Update Notion with Discord ID
    try {
      await updatePage(req.session.user.id, {
        'Discord ID': {
          rich_text: [{ text: { content: discordUser.id } }]
        }
      })
    } catch (notionError) {
      logger.warn('Failed to update Notion with Discord ID', { error: notionError.message })
      // Don't fail the whole flow if Notion update fails
    }

    res.json({
      success: true,
      discordId: discordUser.id,
      discordUsername: discordUser.username
    })

  } catch (error) {
    logger.error('Discord OAuth callback error', { error: error.message })
    res.status(500).json({ error: 'Discord authentication failed' })
  }
})

// Get Discord connection status
router.get('/status', requireAuth, (req, res) => {
  res.json({
    connected: !!req.session.user.discordId,
    discordId: req.session.user.discordId || null,
    discordUsername: req.session.user.discordUsername || null
  })
})

// Disconnect Discord
router.post('/disconnect', requireAuth, async (req, res) => {
  req.session.user.discordId = null
  req.session.user.discordUsername = null
  req.session.discordAccessToken = null

  // Clear from Notion
  try {
    await updatePage(req.session.user.id, {
      'Discord ID': {
        rich_text: []
      }
    })
  } catch (error) {
    logger.warn('Failed to clear Discord ID from Notion', { error: error.message })
  }

  res.json({ success: true })
})

// Get channels user has access to
router.get('/channels', requireAuth, async (req, res) => {
  try {
    if (!req.session.user.discordId) {
      return res.status(400).json({ error: 'Discord not connected' })
    }

    const client = await getDiscordClient()
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID)

    // Get member to check roles
    let member
    try {
      member = await guild.members.fetch(req.session.user.discordId)
    } catch (error) {
      return res.status(400).json({ error: 'You are not a member of the Discord server' })
    }

    const memberRoles = member.roles.cache.map(r => r.id)

    // Filter channels based on user's roles
    const accessibleChannels = []
    for (const [channelId, config] of Object.entries(CHANNELS)) {
      // If no roles required, everyone can access
      if (config.roles.length === 0) {
        accessibleChannels.push({
          id: channelId,
          name: config.name,
          category: config.category
        })
      } else {
        // Check if user has any of the required roles
        const hasAccess = config.roles.some(role => memberRoles.includes(role))
        if (hasAccess) {
          accessibleChannels.push({
            id: channelId,
            name: config.name,
            category: config.category
          })
        }
      }
    }

    // Group by category
    const grouped = {}
    for (const channel of accessibleChannels) {
      if (!grouped[channel.category]) {
        grouped[channel.category] = []
      }
      grouped[channel.category].push(channel)
    }

    res.json({ channels: grouped })

  } catch (error) {
    logger.error('Get channels error', { error: error.message })
    res.status(500).json({ error: 'Failed to get channels' })
  }
})

// Get messages from a channel
router.get('/channels/:channelId/messages', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params
    const { limit = 50 } = req.query

    if (!req.session.user.discordId) {
      return res.status(400).json({ error: 'Discord not connected' })
    }

    // Verify user has access to this channel
    const channelConfig = CHANNELS[channelId]
    if (!channelConfig) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    const client = await getDiscordClient()
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID)

    // Check user's roles
    let member
    try {
      member = await guild.members.fetch(req.session.user.discordId)
    } catch (error) {
      return res.status(400).json({ error: 'You are not a member of the Discord server' })
    }

    const memberRoles = member.roles.cache.map(r => r.id)

    // Verify access
    if (channelConfig.roles.length > 0) {
      const hasAccess = channelConfig.roles.some(role => memberRoles.includes(role))
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this channel' })
      }
    }

    // Fetch messages
    const channel = await client.channels.fetch(channelId)
    const messages = await channel.messages.fetch({ limit: parseInt(limit) })

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        avatar: msg.author.displayAvatarURL({ size: 32 })
      },
      timestamp: msg.createdTimestamp,
      attachments: msg.attachments.map(a => ({
        url: a.url,
        name: a.name
      }))
    })).reverse() // Oldest first

    res.json({ messages: formattedMessages })

  } catch (error) {
    logger.error('Get messages error', { error: error.message })
    res.status(500).json({ error: 'Failed to get messages' })
  }
})

// Send a message to a channel
router.post('/channels/:channelId/messages', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params
    const { content } = req.body

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    if (!req.session.user.discordId) {
      return res.status(400).json({ error: 'Discord not connected' })
    }

    // Verify user has access to this channel
    const channelConfig = CHANNELS[channelId]
    if (!channelConfig) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    const client = await getDiscordClient()
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID)

    // Check user's roles
    let member
    try {
      member = await guild.members.fetch(req.session.user.discordId)
    } catch (error) {
      return res.status(400).json({ error: 'You are not a member of the Discord server' })
    }

    const memberRoles = member.roles.cache.map(r => r.id)

    // Verify access
    if (channelConfig.roles.length > 0) {
      const hasAccess = channelConfig.roles.some(role => memberRoles.includes(role))
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this channel' })
      }
    }

    // Send message as bot with user attribution
    const channel = await client.channels.fetch(channelId)
    const userName = req.session.user.fullName || req.session.user.discordUsername || 'Unknown'

    const sentMessage = await channel.send({
      content: `**${userName}:** ${content}`
    })

    res.json({
      success: true,
      message: {
        id: sentMessage.id,
        content: sentMessage.content,
        timestamp: sentMessage.createdTimestamp
      }
    })

  } catch (error) {
    logger.error('Send message error', { error: error.message })
    res.status(500).json({ error: 'Failed to send message' })
  }
})

export default router
