// Shared utility functions for API endpoints
import crypto from 'crypto'
import axios from 'axios'
import { TOKEN_SECRET, DATABASE_IDS, NOTION_VERSION } from './databases.js'

// Upstash Redis for persistent rate limiting (optional)
let upstashRatelimit = null
let upstashEnabled = false

// Initialize Upstash if credentials are available
async function initUpstash() {
  if (upstashRatelimit !== null) return upstashEnabled

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const { Redis } = await import('@upstash/redis')

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })

      upstashRatelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per 60 seconds
        analytics: true
      })

      upstashEnabled = true
      console.log('Upstash rate limiting enabled')
    } catch (e) {
      console.warn('Upstash initialization failed, using in-memory fallback:', e.message)
      upstashEnabled = false
    }
  } else {
    upstashEnabled = false
  }

  return upstashEnabled
}

// In-memory fallback rate limiter
const rateLimitStore = new Map()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 10 // 10 attempts per minute per IP

function checkRateLimitInMemory(ip) {
  const now = Date.now()

  // Clean old entries
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key)
    }
  }

  const record = rateLimitStore.get(ip)

  if (!record) {
    rateLimitStore.set(ip, { windowStart: now, attempts: 1 })
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 }
  }

  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { windowStart: now, attempts: 1 })
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 }
  }

  record.attempts++

  if (record.attempts > RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - record.attempts }
}

// Main rate limit function - uses Upstash if available, falls back to in-memory
export async function checkRateLimit(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'unknown'

  // Try to use Upstash for persistent rate limiting
  await initUpstash()

  if (upstashEnabled && upstashRatelimit) {
    try {
      const { success, remaining } = await upstashRatelimit.limit(ip)
      return { allowed: success, remaining }
    } catch (e) {
      console.warn('Upstash rate limit failed, using fallback:', e.message)
    }
  }

  // Fallback to in-memory
  return checkRateLimitInMemory(ip)
}

// Token functions
export function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.name,
    tokenVersion: user.tokenVersion || 0,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('hex')
  return `${data}.${signature}`
}

export function verifyToken(token) {
  if (!token) return null
  try {
    const [data, signature] = token.split('.')
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('hex')
    if (signature !== expectedSig) return null
    const payload = JSON.parse(Buffer.from(data, 'base64').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch (e) {
    return null
  }
}

// Extract token from request (Authorization header or HttpOnly cookie)
export function getTokenFromRequest(req) {
  // Check Authorization header first
  const authHeader = req.headers?.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Fall back to HttpOnly cookie
  const cookies = req.headers?.cookie || ''
  const match = cookies.match(/authToken=([^;]+)/)
  return match ? match[1] : null
}

// Verify token from request (combines extraction and verification)
export function verifyRequestToken(req) {
  const token = getTokenFromRequest(req)
  return verifyToken(token)
}

// Notion data extraction helpers
export function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
}

export function formatPage(page) {
  const properties = {}
  for (const [key, value] of Object.entries(page.properties)) {
    switch (value.type) {
      case 'title': properties[key] = extractPlainText(value.title); break
      case 'rich_text': properties[key] = extractPlainText(value.rich_text); break
      case 'select': properties[key] = value.select?.name || null; break
      case 'status': properties[key] = value.status?.name || null; break
      case 'email': properties[key] = value.email; break
      case 'number': properties[key] = value.number; break
      case 'checkbox': properties[key] = value.checkbox; break
      case 'date': properties[key] = value.date?.start || null; break
      case 'phone_number': properties[key] = value.phone_number; break
      case 'url': properties[key] = value.url; break
      case 'multi_select':
        properties[key] = value.multi_select?.map(s => s.name) || [];
        break
      case 'relation':
        properties[key] = value.relation?.map(r => r.id) || [];
        break
      case 'formula':
        properties[key] = value.formula?.string || value.formula?.number || value.formula?.boolean || null;
        break
      default: properties[key] = value
    }
  }
  return { id: page.id, ...properties }
}

// CORS helper - returns configured headers
export function getCorsHeaders(req) {
  // Allow localhost for development, specific origin for production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean)

  const origin = req?.headers?.origin || ''
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')

  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
}

// Apply CORS headers to response
export function setCorsHeaders(req, res) {
  const headers = getCorsHeaders(req)
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
}

// Handle OPTIONS preflight
export function handleCors(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

// Input sanitization
export function sanitizeString(input) {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, 1000) // Limit length
}

export function sanitizeEmail(email) {
  if (typeof email !== 'string') return ''
  return email.toLowerCase().trim().slice(0, 255)
}

// UUID validation (Notion page IDs)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isValidUUID(id) {
  return typeof id === 'string' && UUID_REGEX.test(id)
}

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim())
}

// Phone validation (US format - allows various common formats)
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/
export function isValidPhone(phone) {
  if (typeof phone !== 'string') return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 && PHONE_REGEX.test(phone)
}

// Find user by email in Team Members database
export async function findUserByEmail(email) {
  const NOTION_API_KEY = process.env.NOTION_API_KEY
  const normalizedEmail = email.toLowerCase().trim()

  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${DATABASE_IDS.TEAM_MEMBERS}/query`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )

    // Check for Notion error response
    if (response.data?.object === 'error') {
      console.error('Notion error in findUserByEmail:', response.data.code, response.data.message)
      throw new Error('Database query failed')
    }

    const results = response.data.results || []
    for (const page of results) {
      const formatted = formatPage(page)
      const eraEmail = formatted['Email - ERA']?.toLowerCase().trim()
      const personalEmail = formatted['Email - Personal']?.toLowerCase().trim()

      if (eraEmail === normalizedEmail || personalEmail === normalizedEmail) {
        return {
          id: page.id,
          name: formatted['Name'] || '',
          email: eraEmail || personalEmail,
          status: formatted['Status'] || formatted['Stauts'] || null, // Handle typo in Notion
          password: formatted['Password'] || '',
          role: formatted['View'] || 'Employee',
          tokenVersion: formatted['Token Version'] || 0
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error in findUserByEmail:', error.message)
    throw error // Re-throw to be caught by the calling handler's catch block
  }
}

// Update a Notion page's properties
export async function updateNotionPage(pageId, properties) {
  const NOTION_API_KEY = process.env.NOTION_API_KEY

  await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    { properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )
}

// Verify token version is still valid (for sensitive operations)
// Returns true if valid, false if token has been invalidated
export async function verifyTokenVersion(userId, tokenVersion) {
  const NOTION_API_KEY = process.env.NOTION_API_KEY

  try {
    const response = await axios.get(
      `https://api.notion.com/v1/pages/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION
        }
      }
    )

    const formatted = formatPage(response.data)
    const currentVersion = formatted['Token Version'] || 0

    return tokenVersion >= currentVersion
  } catch (error) {
    console.error('Token version check failed:', error.message)
    return false
  }
}

// Invalidate all tokens for a user by incrementing their token version
export async function invalidateUserTokens(userId) {
  const NOTION_API_KEY = process.env.NOTION_API_KEY

  // First get current version
  const response = await axios.get(
    `https://api.notion.com/v1/pages/${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION
      }
    }
  )

  const formatted = formatPage(response.data)
  const currentVersion = formatted['Token Version'] || 0

  // Increment version
  await updateNotionPage(userId, {
    'Token Version': {
      number: currentVersion + 1
    }
  })

  return currentVersion + 1
}
