import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.js'
import databaseRoutes from './routes/databases.js'
import discordRoutes from './routes/discord.js'
import logger from './utils/logger.js'

dotenv.config()

// #16 - Validate required environment variables on startup
const REQUIRED_ENV_VARS = ['SESSION_SECRET', 'NOTION_API_KEY']
const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key])
if (missing.length > 0) {
  logger.error('Missing required environment variables', { missing })
  logger.error('Please set these in your .env file')
  process.exit(1)
}

// Warn about recommended env vars that have defaults
if (!process.env.FRONTEND_URL) {
  logger.warn('FRONTEND_URL not set, using default localhost URL')
}

const app = express()
const PORT = process.env.PORT || 3000

// #18 - Rate limiting to prevent brute force attacks
// PRODUCTION WARNING: Uses in-memory store which resets on restart.
// For production with multiple instances, use Redis store:
// npm install rate-limit-redis && store: new RedisStore({ client: redisClient })
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window for auth
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
})

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for general API
  message: { error: 'Too many requests. Please slow down.' }
})

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
// PRODUCTION WARNING: Uses in-memory session store which loses sessions on restart.
// For production, use Redis or database-backed store:
// npm install connect-redis && store: new RedisStore({ client: redisClient })
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

// #1 - CSRF protection middleware for mutating requests
function csrfProtection(req, res, next) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Validate Origin header for ALL POST requests (including login)
  const origin = req.get('Origin')
  const referer = req.get('Referer')

  // If Origin header is present, validate it
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    logger.warn('CSRF: Invalid origin', { origin, path: req.path })
    return res.status(403).json({ error: 'Invalid origin' })
  }

  // If Origin is missing, fall back to Referer header validation
  // This provides defense in depth for browsers that don't send Origin
  if (!origin && referer) {
    const refererUrl = new URL(referer)
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`
    if (!ALLOWED_ORIGINS.includes(refererOrigin)) {
      logger.warn('CSRF: Invalid referer', { referer: refererOrigin, path: req.path })
      return res.status(403).json({ error: 'Invalid referer' })
    }
  }

  // Only skip CSRF token check for initial email check (truly no session needed)
  // Login and create-password still validate origin above
  // Discord OAuth callback is handled specially (state parameter provides CSRF protection)
  const skipCsrfToken = ['/api/auth/check-email', '/api/discord/auth/callback']
  if (skipCsrfToken.includes(req.path)) {
    return next()
  }

  // For login/create-password, we can't require CSRF token (no session yet)
  // But origin/referer is already validated above, which provides protection
  const preAuthPaths = ['/api/auth/login', '/api/auth/create-password']
  if (preAuthPaths.includes(req.path)) {
    return next()
  }

  // Validate CSRF token for authenticated requests
  if (req.session.user) {
    const tokenFromHeader = req.get('X-CSRF-Token')
    const tokenFromBody = req.body?._csrf
    const providedToken = tokenFromHeader || tokenFromBody

    if (!req.session.csrfToken || providedToken !== req.session.csrfToken) {
      logger.warn('CSRF: Invalid token', { path: req.path, userId: req.session.user.id })
      return res.status(403).json({ error: 'Invalid CSRF token' })
    }
  }

  next()
}

app.use(csrfProtection)

// Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/databases', apiLimiter, databaseRoutes)
app.use('/api/discord', apiLimiter, discordRoutes)

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, url: `http://localhost:${PORT}` })
})
