import { verifyRequestToken, getTokenFromRequest, handleCors } from '../../config/utils.js'

export default function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get token from Authorization header or HttpOnly cookie
  const token = getTokenFromRequest(req)

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const payload = verifyRequestToken(req)

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  return res.json({
    user: {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName
    }
  })
}
