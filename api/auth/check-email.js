import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../../config/databases.js'
import { formatPage, handleCors, sanitizeEmail } from '../../config/utils.js'

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
    const { email } = req.body

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
    
  } catch (error) {
    console.error('Check email error:', error.message)
    res.status(500).json({ error: 'Failed to check email' })
  }
}
