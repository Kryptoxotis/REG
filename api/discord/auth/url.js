import { handleCors, verifyRequestToken } from '../../../config/utils.js'

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kryptoxotis-reg.vercel.app'
const REDIRECT_URI = `${FRONTEND_URL}/auth/discord/callback`

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

  // Create state with user ID for callback verification
  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    timestamp: Date.now()
  })).toString('base64')

  // Store state in cookie for verification
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL
  res.setHeader('Set-Cookie', [
    `discordOAuthState=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${isProduction ? '; Secure' : ''}`
  ])

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state: state
  })

  res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` })
}
