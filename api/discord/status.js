import { handleCors, verifyRequestToken } from '../../config/utils.js'

// Helper to get Discord user from cookie
function getDiscordUser(req) {
  const cookies = req.headers?.cookie || ''
  const match = cookies.match(/discordUser=([^;]+)/)
  if (!match) return null

  try {
    const data = JSON.parse(Buffer.from(match[1], 'base64').toString())
    // Check if expired
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

  const avatarUrl = discordUser?.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
    : 'https://cdn.discordapp.com/embed/avatars/0.png'

  res.json({
    connected: !!discordUser,
    discordId: discordUser?.id || null,
    discordUsername: discordUser?.username || null,
    discordAvatar: discordUser ? avatarUrl : null
  })
}
