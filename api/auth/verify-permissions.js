import { verifyRequestToken, handleCors } from '../../config/utils.js'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })
const TEAM_MEMBERS_DB = process.env.NOTION_TEAM_MEMBERS_DB

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = verifyRequestToken(req)

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token', valid: false, action: 'logout' })
  }

  try {
    // Query Notion to get current user status
    const response = await notion.databases.query({
      database_id: TEAM_MEMBERS_DB,
      filter: {
        property: 'Email',
        email: { equals: payload.email }
      }
    })

    if (response.results.length === 0) {
      return res.json({ valid: false, action: 'logout', message: 'Account not found' })
    }

    const member = response.results[0]
    const status = member.properties.Status?.select?.name || ''
    const hasPassword = member.properties['Password Hash']?.rich_text?.[0]?.plain_text

    // Check if terminated
    if (status.toLowerCase() === 'terminated') {
      return res.json({ valid: false, action: 'logout', message: 'Your account has been terminated' })
    }

    // Check if needs password setup
    if (!hasPassword) {
      return res.json({ valid: false, action: 'create-password', message: 'Please complete your account setup' })
    }

    // All good
    return res.json({
      valid: true,
      user: {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        fullName: payload.fullName,
        status
      }
    })
  } catch (error) {
    console.error('Permission check error:', error)
    // On error, allow through but log it
    return res.json({ valid: true })
  }
}
