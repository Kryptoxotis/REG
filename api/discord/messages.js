import { handleCors, verifyRequestToken } from '../../config/utils.js'
import crypto from 'crypto'

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1445647668125892620'

// Pusher config
const PUSHER_APP_ID = process.env.PUSHER_APP_ID
const PUSHER_KEY = process.env.PUSHER_KEY
const PUSHER_SECRET = process.env.PUSHER_SECRET
const PUSHER_CLUSTER = process.env.PUSHER_CLUSTER || 'us2'

// Trigger Pusher event (using REST API directly)
async function triggerPusher(channelName, event, data) {
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET) return

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const body = JSON.stringify({ name: event, channel: channelName, data: JSON.stringify(data) })
  const bodyMd5 = crypto.createHash('md5').update(body).digest('hex')

  const params = new URLSearchParams({
    auth_key: PUSHER_KEY,
    auth_timestamp: timestamp,
    auth_version: '1.0',
    body_md5: bodyMd5
  })
  params.sort()

  const stringToSign = `POST\n/apps/${PUSHER_APP_ID}/events\n${params.toString()}`
  const signature = crypto.createHmac('sha256', PUSHER_SECRET).update(stringToSign).digest('hex')
  params.append('auth_signature', signature)

  try {
    const response = await fetch(
      `https://api-${PUSHER_CLUSTER}.pusher.com/apps/${PUSHER_APP_ID}/events?${params.toString()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      }
    )
    if (!response.ok) {
      console.error('Pusher error:', response.status, await response.text())
    }
  } catch (err) {
    console.error('Pusher trigger failed:', err.message)
  }
}

// Discord role IDs
const ROLES = {
  ADMIN: '1450913100940447966',
  IT: '1450913102639005788',
  MANAGER: '1450913104098492580',
  AGENT: '1450913105482612736'
}

// Channel configuration with required roles
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

// Helper to get Discord user from cookie
function getDiscordUser(req) {
  const cookies = req.headers?.cookie || ''
  const match = cookies.match(/discordUser=([^;]+)/)
  if (!match) return null

  try {
    const data = JSON.parse(Buffer.from(match[1], 'base64').toString())
    if (data.exp && data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

// Verify user has access to channel
async function verifyChannelAccess(discordUserId, channelId) {
  const channelConfig = CHANNELS[channelId]
  if (!channelConfig) return { hasAccess: false, error: 'Channel not found' }

  // Public channel - everyone has access
  if (channelConfig.roles.length === 0) {
    return { hasAccess: true }
  }

  // Get member roles from Discord
  const memberResponse = await fetch(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`,
    {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
    }
  )

  if (!memberResponse.ok) {
    if (memberResponse.status === 404) {
      return { hasAccess: false, error: 'You are not a member of the Discord server' }
    }
    throw new Error(`Discord API error: ${memberResponse.status}`)
  }

  const member = await memberResponse.json()
  const memberRoles = member.roles || []

  const hasAccess = channelConfig.roles.some(role => memberRoles.includes(role))
  if (!hasAccess) {
    return { hasAccess: false, error: 'You do not have access to this channel' }
  }

  return { hasAccess: true, member }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  // Require authenticated user
  const user = verifyRequestToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const discordUser = getDiscordUser(req)
  if (!discordUser) {
    return res.status(400).json({ error: 'Discord not connected' })
  }

  const { channelId } = req.query

  if (!channelId) {
    return res.status(400).json({ error: 'channelId is required' })
  }

  try {
    // Verify access
    const access = await verifyChannelAccess(discordUser.id, channelId)
    if (!access.hasAccess) {
      return res.status(403).json({ error: access.error })
    }

    if (req.method === 'GET') {
      // Fetch messages
      const limit = Math.min(parseInt(req.query.limit) || 50, 100)

      const messagesResponse = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
        {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
        }
      )

      if (!messagesResponse.ok) {
        throw new Error(`Failed to fetch messages: ${messagesResponse.status}`)
      }

      const messages = await messagesResponse.json()

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          avatar: msg.author.avatar
            ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=32`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(msg.author.discriminator || '0') % 5}.png`
        },
        timestamp: new Date(msg.timestamp).getTime(),
        attachments: (msg.attachments || []).map(a => ({
          url: a.url,
          name: a.filename
        }))
      })).reverse() // Oldest first

      return res.json({ messages: formattedMessages })

    } else if (req.method === 'POST') {
      // Send message
      const { content } = req.body

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message content is required' })
      }

      // Get or create webhook for this channel
      let webhook = null

      // First, try to find existing webhook created by our bot
      const webhooksResponse = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/webhooks`,
        { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
      )

      if (webhooksResponse.ok) {
        const webhooks = await webhooksResponse.json()
        webhook = webhooks.find(w => w.name === 'REG Dashboard')
      }

      // Create webhook if not found
      if (!webhook) {
        const createResponse = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/webhooks`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'REG Dashboard' })
          }
        )

        if (createResponse.ok) {
          webhook = await createResponse.json()
        }
      }

      // Build user's avatar URL
      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`

      let sentMessage

      if (webhook) {
        // Send via webhook with user's name and avatar
        const webhookResponse = await fetch(
          `https://discord.com/api/v10/webhooks/${webhook.id}/${webhook.token}?wait=true`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: content,
              username: discordUser.username,
              avatar_url: avatarUrl
            })
          }
        )

        if (!webhookResponse.ok) {
          throw new Error(`Failed to send webhook message: ${webhookResponse.status}`)
        }

        sentMessage = await webhookResponse.json()
      } else {
        // Fallback to bot message if webhook fails
        const sendResponse = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: `**${discordUser.username}:** ${content}`
            })
          }
        )

        if (!sendResponse.ok) {
          throw new Error(`Failed to send message: ${sendResponse.status}`)
        }

        sentMessage = await sendResponse.json()
      }

      // Trigger Pusher to notify other dashboard users
      const messageData = {
        id: sentMessage.id,
        content: sentMessage.content,
        author: {
          id: discordUser.id,
          username: discordUser.username,
          avatar: avatarUrl
        },
        timestamp: new Date(sentMessage.timestamp).getTime(),
        attachments: []
      }

      // Await Pusher trigger (don't block response on failure)
      await triggerPusher(`discord-${channelId}`, 'new-message', messageData)

      return res.json({
        success: true,
        message: messageData
      })

    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Discord messages error:', error.message)
    res.status(500).json({ error: 'Failed to process request' })
  }
}
