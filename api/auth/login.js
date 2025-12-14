import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../config/databases.js'
import { generateToken, verifyToken, formatPage, handleCors, sanitizeEmail } from '../config/utils.js'

// Re-export verifyToken for other files that import from login.js
export { verifyToken }

const NOTION_API_KEY = process.env.NOTION_API_KEY
const TEAM_MEMBERS_DB = DATABASE_IDS.TEAM_MEMBERS

async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim()
  
  const response = await axios.post(
    `https://api.notion.com/v1/databases/${TEAM_MEMBERS_DB}/query`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )
  
  for (const page of response.data.results) {
    const formatted = formatPage(page)
    const eraEmail = formatted['Email - ERA']?.toLowerCase().trim()
    const personalEmail = formatted['Email - Personal']?.toLowerCase().trim()
    
    if (eraEmail === normalizedEmail || personalEmail === normalizedEmail) {
      return {
        id: page.id,
        name: formatted['Name'] || '',
        email: eraEmail || personalEmail,
        status: formatted['Status'] || null,
        password: formatted['Password'] || '',
        role: formatted['View'] || 'Employee'
      }
    }
  }
  
  return null
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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
