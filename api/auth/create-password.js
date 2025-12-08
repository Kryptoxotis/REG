import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'
const TEAM_MEMBERS_DB = '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5'

function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
}

function formatPage(page) {
  const properties = {}
  for (const [key, value] of Object.entries(page.properties)) {
    switch (value.type) {
      case 'title': properties[key] = extractPlainText(value.title); break
      case 'rich_text': properties[key] = extractPlainText(value.rich_text); break
      case 'select': properties[key] = value.select?.name || null; break
      case 'status': properties[key] = value.status?.name || null; break
      case 'email': properties[key] = value.email; break
      default: properties[key] = value
    }
  }
  return { id: page.id, ...properties }
}

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
        status: formatted['Stauts'] || null,
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
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
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
    
    return res.json({
      message: 'Password created successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'employee',
        fullName: user.name
      }
    })
    
  } catch (error) {
    console.error('Create password error:', error.message)
    res.status(500).json({ error: 'Failed to create password' })
  }
}
