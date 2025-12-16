import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import crypto from 'crypto'
import authRoutes from './routes/auth.js'
import databaseRoutes from './routes/databases.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Allowed origins for CORS and CSRF validation
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL
].filter(Boolean)

// Middleware
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // CSRF protection via SameSite cookie
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Generate CSRF token for session
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex')
}

// CSRF token endpoint - GET this to get a token for forms
app.get('/api/csrf-token', (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken()
  }
  res.json({ csrfToken: req.session.csrfToken })
})

// CSRF protection middleware for mutating requests
function csrfProtection(req, res, next) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Skip CSRF for login/check-email (no session yet)
  const skipPaths = ['/api/auth/login', '/api/auth/check-email', '/api/auth/create-password']
  if (skipPaths.includes(req.path)) {
    return next()
  }

  // Validate Origin header
  const origin = req.get('Origin')
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Invalid origin' })
  }

  // Validate CSRF token for authenticated requests
  if (req.session.user) {
    const tokenFromHeader = req.get('X-CSRF-Token')
    const tokenFromBody = req.body?._csrf
    const providedToken = tokenFromHeader || tokenFromBody

    if (!req.session.csrfToken || providedToken !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' })
    }
  }

  next()
}

app.use(csrfProtection)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/databases', databaseRoutes)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
