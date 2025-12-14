// Shared utility functions for API endpoints
import crypto from 'crypto'
import { TOKEN_SECRET } from './databases.js'

// Token functions
export function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.name,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
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
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0] || '*',
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
