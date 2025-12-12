import express from 'express'
import { queryDatabase, formatPage, updatePage, DATABASE_IDS } from '../utils/notion.js'

const router = express.Router()

// Helper: Find user by email in Notion
async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim()

  // Query all team members and filter by email
  const results = await queryDatabase(DATABASE_IDS.TEAM_MEMBERS)

  for (const page of results) {
    const formatted = formatPage(page)
    const eraEmail = formatted['Email - ERA']?.toLowerCase().trim()
    const personalEmail = formatted['Email - Personal']?.toLowerCase().trim()

    if (eraEmail === normalizedEmail || personalEmail === normalizedEmail) {
      return {
        id: page.id,
        name: formatted['Name'] || '',
        email: eraEmail || personalEmail,
        status: formatted['Stauts'] || null, // Note: typo in Notion field name
        password: formatted['Password'] || '',
        role: formatted['View'] || 'Employee'
      }
    }
  }

  return null
}

// Check email endpoint - returns user status
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const user = await findUserByEmail(email)

    if (!user) {
      return res.json({
        status: 'not_found',
        message: 'Please contact admin to create an account'
      })
    }

    // Return status based on user's status in Notion
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

    // Unknown status
    return res.json({
      status: 'unknown',
      message: 'Account status unknown. Please contact admin.'
    })

  } catch (error) {
    console.error('Check email error:', error)
    res.status(500).json({ error: 'Failed to check email' })
  }
})

// Login endpoint - for active users
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const user = await findUserByEmail(email)

    if (!user) {
      return res.status(401).json({ error: 'Account not found' })
    }

    // Check if user is active
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

    // Verify password
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Store user in session
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
      fullName: user.name
    }

    return res.json({
      user: req.session.user
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Create password endpoint - for pending users
router.post('/create-password', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const user = await findUserByEmail(email)

    if (!user) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // Only allow pending users to create passwords
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

    // Update password and status in Notion
    await updatePage(user.id, {
      'Password': {
        rich_text: [{ text: { content: password } }]
      },
      'Stauts': {
        status: { name: 'Active' }
      }
    })

    // Auto-login after password creation
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
      fullName: user.name
    }

    return res.json({
      message: 'Password created successfully',
      user: req.session.user
    })

  } catch (error) {
    console.error('Create password error:', error)
    res.status(500).json({ error: 'Failed to create password' })
  }
})

// Check authentication status
router.get('/check', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user })
  } else {
    res.status(401).json({ error: 'Not authenticated' })
  }
})

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.clearCookie('connect.sid')
    res.json({ message: 'Logged out successfully' })
  })
})

export default router
