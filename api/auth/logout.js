import { handleCors, verifyToken } from '../../config/utils.js'

export default function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get token from Authorization header for logging (optional)
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      console.log(`User logged out: ${payload.email}`)
    }
  }

  // Note: Since we use stateless JWT tokens, there's no server-side session to invalidate
  // The client is responsible for clearing the token from localStorage
  // In a production environment, you might want to:
  // 1. Maintain a token blacklist (Redis/database)
  // 2. Use short-lived access tokens with refresh tokens
  // 3. Log the logout event for audit purposes

  return res.json({ message: 'Logged out successfully' })
}
