import { generateToken, verifyToken, handleCors, sanitizeEmail, findUserByEmail, checkRateLimit } from '../../config/utils.js'

// Re-export verifyToken for other files that import from login.js
export { verifyToken }

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting
  const rateLimit = checkRateLimit(req)
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const sanitizedEmail = sanitizeEmail(email)

    const user = await findUserByEmail(sanitizedEmail)
    
    if (!user) {
      return res.status(401).json({ error: 'Account not found' })
    }
    
    const status = user.status?.toLowerCase()
    if (status !== 'active') {
      if (status === 'pending') {
        return res.status(401).json({ error: 'Please create a password first' })
      }
      if (status === 'terminated') {
        return res.status(401).json({ error: 'Account access revoked' })
      }
      return res.status(401).json({ error: 'Account not active' })
    }
    
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    const userData = {
      id: user.id,
      email: user.email,
      role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
      fullName: user.name
    }

    const token = generateToken({ ...user, role: userData.role })

    return res.json({
      user: userData,
      token
    })
    
  } catch (error) {
    console.error('Login error:', error.message)
    res.status(500).json({ error: 'Login failed' })
  }
}
