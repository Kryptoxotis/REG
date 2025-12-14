import axios from 'axios'
import { NOTION_VERSION } from '../../../config/databases.js'
import { handleCors, verifyToken } from '../../../config/utils.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY

// Field type mappings for new database schema
const SELECT_FIELDS = [
  'Status', 'Loan Type', 'Loan Status', 'Type', 'Source'
]

const DATE_FIELDS = [
  'Date', 'Execution Date', 'Scheduled Closing', 'Closed Date',
  'DOB', 'Start Date', 'Completion'
]

const NUMBER_FIELDS = [
  'Sales Price', 'Loan Amount', 'Sq Ft', 'Commission %', 'Closing Cost %'
]

const CHECKBOX_FIELDS = [
  'Executed', 'Active'
]

const EMAIL_FIELDS = [
  'Email', 'Buyer Email', 'LO Email', 'Realtor Email', 'Personal Email', 'Preferred Email'
]

const PHONE_FIELDS = [
  'Phone', 'Buyer Phone', 'LO Phone', 'Realtor Phone'
]

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check - all database updates require authentication
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const user = verifyToken(token)

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { key, id } = req.query
  const updates = req.body

  if (!id) {
    return res.status(400).json({ error: 'Page ID is required' })
  }

  try {
    const properties = {}

    for (const [fieldKey, value] of Object.entries(updates)) {
      if (value === '' || value === null || value === undefined) continue

      if (SELECT_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { select: { name: value } }
      } else if (DATE_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { date: { start: value } }
      } else if (NUMBER_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { number: parseFloat(value) || null }
      } else if (CHECKBOX_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { checkbox: Boolean(value) }
      } else if (EMAIL_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { email: value }
      } else if (PHONE_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { phone_number: value }
      } else {
        // Default to rich_text
        properties[fieldKey] = {
          rich_text: [{ type: 'text', text: { content: String(value) } }]
        }
      }
    }

    const response = await axios.patch(
      `https://api.notion.com/v1/pages/${id}`,
      { properties },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      }
    )

    res.status(200).json({ success: true, id: response.data.id })
  } catch (error) {
    console.error('Update error:', error.response?.data || error.message)
    res.status(500).json({
      error: 'Failed to update',
      details: error.response?.data?.message || error.message
    })
  }
}
