import { handleCors, verifyToken, invalidateUserTokens } from '../../config/utils.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const user = verifyToken(token)

  if (!user) {
    // Even without valid token, return success (idempotent)
    return res.json({ message: 'Logged out successfully' })
  }

  try {
    // Invalidate all tokens for this user by incrementing token version
    await invalidateUserTokens(user.id)

    return res.json({
      success: true,
      message: 'Logged out successfully. All sessions invalidated.'
    })
  } catch (error) {
    console.error('Logout error:', error.message)
    // Still return success - client should clear token regardless
    return res.json({ message: 'Logged out successfully' })
  }
}
