import bcrypt from 'bcrypt'
import { generateToken, verifyToken, handleCors, sanitizeEmail, findUserByEmail, checkRateLimit } from '../../config/utils.js'

// Re-export verifyToken for other files that import from login.js
export { verifyToken }

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting
  const rateLimit = await checkRateLimit(req)
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  try {
    const { email, password, action } = req.body

    // Handle check-email action (consolidated from check-email.js)
    if (action === 'check-email') {
      if (!email) {
        return res.status(400).json({ error: 'Email is required' })
      }

      const user = await findUserByEmail(sanitizeEmail(email))

      if (!user) {
        return res.json({
          status: 'not_found',
          message: 'Please contact admin to create an account'
        })
      }

      const status = user.status?.toLowerCase() || 'unknown'

      if (status === 'active') {
        return res.json({
          status: 'active',
          message: 'Please enter your password',
          hasPassword: !!user.password
        })
      }

      if (status === 'pending') {
        return res.json({
          status: 'pending',
          message: 'Please create a password to activate your account'
        })
      }

      if (status === 'terminated') {
        return res.json({
          status: 'terminated',
          message: 'You do not have access. Please contact admin.'
        })
      }

      return res.json({
        status: 'unknown',
        message: 'Account status unknown. Please contact admin.'
      })
    }

    // Regular login flow
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
    
    // Check password - bcrypt only (no plain text)
    const isHashed = user.password && user.password.startsWith('$2')

    if (!isHashed) {
      // Force password reset for legacy accounts
      return res.status(401).json({ error: 'Password reset required. Please contact admin.' })
    }

    const passwordValid = await bcrypt.compare(password, user.password)
    if (!passwordValid) {
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
