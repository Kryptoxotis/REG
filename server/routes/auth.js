import express from 'express'

const router = express.Router()

// TEMPORARY: Hardcoded admin credentials (will implement Notion-based auth later)
const ADMIN_CREDENTIALS = {
  email: 'admin@reg.com',
  password: 'admin123',
  fullName: 'Admin User',
  role: 'admin'
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // Simple hardcoded check for admin
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      // Store user in session
      req.session.user = {
        id: 'admin-1',
        email: ADMIN_CREDENTIALS.email,
        role: ADMIN_CREDENTIALS.role,
        fullName: ADMIN_CREDENTIALS.fullName
      }

      return res.json({
        user: req.session.user
      })
    }

    // Invalid credentials
    return res.status(401).json({ error: 'Invalid credentials' })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
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
