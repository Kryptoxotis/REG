import { handleCors, verifyRequestToken } from '../../config/utils.js'

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1445647668125892620'

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

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require authenticated user
  const user = verifyRequestToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const discordUser = getDiscordUser(req)
  if (!discordUser) {
    return res.status(400).json({ error: 'Discord not connected' })
  }

  // Debug log
  console.log('Discord user from cookie:', discordUser.id, discordUser.username)
  console.log('Bot token length:', DISCORD_BOT_TOKEN?.length)
  console.log('Bot token first 10 chars:', DISCORD_BOT_TOKEN?.substring(0, 10))
  console.log('Guild ID:', DISCORD_GUILD_ID)

  try {
    // Get member from Discord to check roles (using bot token)
    const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUser.id}`
    console.log('Fetching:', url)

    const memberResponse = await fetch(url, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
    })

    if (!memberResponse.ok) {
      const errorBody = await memberResponse.text()
      console.log('Discord error response:', memberResponse.status, errorBody)

      if (memberResponse.status === 404) {
        return res.status(400).json({ error: 'You are not a member of the Discord server' })
      }
      throw new Error(`Discord API error: ${memberResponse.status} - ${errorBody}`)
    }

    const member = await memberResponse.json()
    const memberRoles = member.roles || []

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
    console.error('Get channels error:', error.message, error.stack)
    res.status(500).json({ error: 'Failed to get channels', details: error.message })
  }
}
