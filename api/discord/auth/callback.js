import { handleCors, verifyRequestToken, updateNotionPage } from '../../../config/utils.js'

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kryptoxotis-reg.vercel.app'
const REDIRECT_URI = `${FRONTEND_URL}/auth/discord/callback`

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require authenticated user
  const user = verifyRequestToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const { code, state } = req.body

    // Get stored state from cookie
    const cookies = req.headers?.cookie || ''
    const stateMatch = cookies.match(/discordOAuthState=([^;]+)/)
    const storedState = stateMatch ? stateMatch[1] : null

    // Validate state
    if (!storedState || state !== storedState) {
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
      console.error('Discord token exchange failed:', error)
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

    // Store Discord info in cookie (encrypted payload)
    const discordData = Buffer.from(JSON.stringify({
      id: discordUser.id,
      username: discordUser.username,
      accessToken: tokens.access_token,
      exp: Date.now() + (tokens.expires_in * 1000)
    })).toString('base64')

    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL
    res.setHeader('Set-Cookie', [
      `discordUser=${discordData}; HttpOnly; Path=/; Max-Age=${tokens.expires_in}; SameSite=Lax${isProduction ? '; Secure' : ''}`,
      `discordOAuthState=; HttpOnly; Path=/; Max-Age=0` // Clear state cookie
    ])

    // Update Notion with Discord ID (optional, don't fail if it errors)
    try {
      await updateNotionPage(user.id, {
        'Discord ID': {
          rich_text: [{ text: { content: discordUser.id } }]
        }
      })
    } catch (notionError) {
      console.warn('Failed to update Notion with Discord ID:', notionError.message)
    }

    res.json({
      success: true,
      discordId: discordUser.id,
      discordUsername: discordUser.username
    })

  } catch (error) {
    console.error('Discord OAuth callback error:', error.message)
    res.status(500).json({ error: 'Discord authentication failed' })
  }
}
