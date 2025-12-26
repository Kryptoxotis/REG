import express from 'express'
import bcrypt from 'bcrypt'
import { queryDatabase, formatPage, updatePage, DATABASE_IDS } from '../utils/notion.js'
import logger from '../utils/logger.js'

const SALT_ROUNDS = 10

const router = express.Router()

// Password policy validation
function validatePassword(password) {
  const errors = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

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
    logger.error('Check email error', { error: error.message })
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

    // Verify password with bcrypt only - no plaintext fallback
    if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
      // Legacy plaintext password detected - force password reset
      logger.warn('Legacy password detected - forcing reset', { email: user.email })
      return res.status(401).json({
        error: 'Password reset required',
        code: 'PASSWORD_RESET_REQUIRED',
        message: 'Your password needs to be reset. Please contact admin.'
      })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Regenerate session to prevent session fixation attacks
    const userData = {
      id: user.id,
      email: user.email,
      role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
      fullName: user.name
    }

    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed', { error: err.message })
        return res.status(500).json({ error: 'Login failed - session error' })
      }

      req.session.user = userData

      return res.json({
        user: req.session.user
      })
    })
  } catch (error) {
    logger.error('Login error', { error: error.message })
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

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      })
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

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    // Update password and status in Notion
    await updatePage(user.id, {
      'Password': {
        rich_text: [{ text: { content: hashedPassword } }]
      },
      'Stauts': {
        status: { name: 'Active' }
      }
    })

    // Regenerate session to prevent session fixation attacks
    const userData = {
      id: user.id,
      email: user.email,
      role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
      fullName: user.name
    }

    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed', { error: err.message })
        return res.status(500).json({ error: 'Account activation failed - session error' })
      }

      req.session.user = userData

      return res.json({
        message: 'Password created successfully',
        user: req.session.user
      })
    })

  } catch (error) {
    logger.error('Create password error', { error: error.message })
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

// Verify user permissions - lightweight check for PWA navigation
// Checks current user status and role against Notion, updates session if changed
router.get('/verify-permissions', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated', action: 'logout' })
  }

  try {
    const user = await findUserByEmail(req.session.user.email)

    if (!user) {
      // User no longer exists in database
      return res.json({
        valid: false,
        action: 'logout',
        message: 'Account not found'
      })
    }

    const status = user.status?.toLowerCase()
    const currentRole = user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee'

    // Check account status
    if (status === 'terminated') {
      return res.json({
        valid: false,
        action: 'logout',
        message: 'Your account has been terminated. Please contact admin.'
      })
    }

    if (status === 'pending') {
      return res.json({
        valid: false,
        action: 'create-password',
        message: 'Please complete your account setup.'
      })
    }

    // Check if role changed (admin demoted to employee)
    const sessionRole = req.session.user.role
    if (sessionRole !== currentRole) {
      // Update session with new role
      req.session.user.role = currentRole
      return res.json({
        valid: true,
        roleChanged: true,
        newRole: currentRole,
        message: currentRole === 'employee'
          ? 'Your access level has changed to Employee.'
          : 'Your access level has changed to Admin.'
      })
    }

    // All checks passed, user is valid
    return res.json({
      valid: true,
      user: req.session.user
    })

  } catch (error) {
    logger.error('Permission verification error', { error: error.message })
    // Return 503 to signal temporary failure - client should retry
    res.status(503).json({ error: 'Permission check failed', retry: true })
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
