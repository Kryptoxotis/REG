import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../config/databases.js'
import { generateToken, formatPage, handleCors, sanitizeEmail, sanitizeString } from '../config/utils.js'

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

async function updatePage(pageId, properties) {
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

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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

    // Update password and status in Notion
    await updatePage(user.id, {
      'Password': {
        rich_text: [{ text: { content: sanitizedPassword } }]
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
