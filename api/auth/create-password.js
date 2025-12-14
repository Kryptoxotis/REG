import bcrypt from 'bcrypt'
import { generateToken, handleCors, sanitizeEmail, sanitizeString, findUserByEmail, updateNotionPage, checkRateLimit } from '../../config/utils.js'

const SALT_ROUNDS = 10

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
    const { email, password, confirmPassword } = req.body

    // Validate inputs BEFORE database lookup
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const sanitizedEmail = sanitizeEmail(email)
    const sanitizedPassword = sanitizeString(password)

    const user = await findUserByEmail(sanitizedEmail)

    if (!user) {
      return res.status(404).json({ error: 'Account not found' })
    }

    const status = user.status?.toLowerCase()
    if (status !== 'pending') {
      if (status === 'active') {
        return res.status(400).json({ error: 'Account already active. Please login.' })
      }
      if (status === 'terminated') {
        return res.status(400).json({ error: 'Account access revoked' })
      }
      return res.status(400).json({ error: 'Cannot create password for this account' })
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(sanitizedPassword, SALT_ROUNDS)

    // Update password and status in Notion
    await updateNotionPage(user.id, {
      'Password': {
        rich_text: [{ text: { content: hashedPassword } }]
      },
      'Status': {
        status: { name: 'Active' }
      }
    })

    const userData = {
      id: user.id,
      email: user.email,
      role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
      fullName: user.name
    }

    const token = generateToken({ ...user, role: userData.role })

    return res.json({
      message: 'Password created successfully',
      user: userData,
      token
    })

  } catch (error) {
    console.error('Create password error:', error.message)
    res.status(500).json({ error: 'Failed to create password' })
  }
}
