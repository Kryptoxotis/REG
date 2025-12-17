import { handleCors, verifyRequestToken, updateNotionPage } from '../../config/utils.js'

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

  // Clear Discord cookie
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL
  res.setHeader('Set-Cookie', [
    `discordUser=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProduction ? '; Secure' : ''}`
  ])

  // Clear from Notion (optional)
  try {
    await updateNotionPage(user.id, {
      'Discord ID': {
        rich_text: []
      }
    })
  } catch (error) {
    console.warn('Failed to clear Discord ID from Notion:', error.message)
  }

  res.json({ success: true })
}
