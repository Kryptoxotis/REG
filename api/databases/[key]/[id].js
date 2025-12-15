import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../../../config/databases.js'
import { handleCors, verifyToken } from '../../../config/utils.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY

// Map database keys to human-readable entity types
const DB_KEY_TO_ENTITY = {
  'TEAM_MEMBERS': 'Team Member',
  'PROPERTIES': 'Property',
  'PIPELINE': 'Pipeline Deal',
  'CLIENTS': 'Client',
  'SCHEDULE': 'Schedule',
  'CLOSED_DEALS': 'Closed Deal'
}

// Log activity to Notion
async function logActivity(entityType, entityTitle, action, changedFields, userName) {
  try {
    const fieldList = Object.keys(changedFields).slice(0, 5).join(', ')
    const actionText = `${userName || 'User'} updated ${entityType}: ${action}${fieldList ? ` (${fieldList})` : ''}`

    const properties = {
      Action: { title: [{ type: 'text', text: { content: actionText } }] },
      Timestamp: { date: { start: new Date().toISOString() } },
      'Entity Title': { rich_text: [{ type: 'text', text: { content: entityTitle || 'Unknown' } }] },
      'Entity Type': { select: { name: entityType } },
      'Action Type': { select: { name: 'Update' } }
    }

    await axios.post(
      'https://api.notion.com/v1/pages',
      { parent: { database_id: DATABASE_IDS.ACTIVITY_LOG }, properties },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // Don't wait too long for logging
      }
    )
  } catch (err) {
    console.error('Activity log error (non-fatal):', err.message)
    // Don't throw - activity logging failure shouldn't block the main operation
  }
}

// Field type mappings for Notion property types
const SELECT_FIELDS = [
  'Loan Type', 'Loan Status', 'Type', 'Source', 'Role', 'Floorplan', 'Edwards Co',
  'Entity Type', 'Action Type'
]

const STATUS_FIELDS = [
  'Status' // Status type is different from Select in Notion
]

const DATE_FIELDS = [
  'Date', 'Execution Date', 'Scheduled Closing', 'Closed Date',
  'DOB', 'Start Date', 'Completion', 'Timestamp'
]

const NUMBER_FIELDS = [
  'Sales Price', 'Loan Amount', 'Sq Ft', 'Commission %', 'Closing Cost %',
  'Beds', 'Baths', 'Price', 'Commission'
]

const CHECKBOX_FIELDS = [
  'Executed', 'Active'
]

const EMAIL_FIELDS = [
  'Email', 'Buyer Email', 'LO Email', 'Realtor Email', 'Personal Email', 'Preferred Email',
  'Email - ERA'
]

const PHONE_FIELDS = [
  'Phone', 'Buyer Phone', 'LO Phone', 'Realtor Phone'
]

const URL_FIELDS = [
  'Website', 'Link', 'URL'
]

// Title fields (primary field in each database)
const TITLE_FIELDS = [
  'Name', 'Address', 'Deal Name', 'Action', 'Client Name'
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

      if (TITLE_FIELDS.includes(fieldKey)) {
        // Title fields need title type
        properties[fieldKey] = {
          title: [{ type: 'text', text: { content: String(value) } }]
        }
      } else if (SELECT_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { select: { name: value } }
      } else if (STATUS_FIELDS.includes(fieldKey)) {
        // Status type is different from Select
        properties[fieldKey] = { status: { name: value } }
      } else if (DATE_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { date: { start: value } }
      } else if (NUMBER_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { number: parseFloat(value) || null }
      } else if (CHECKBOX_FIELDS.includes(fieldKey)) {
        // Handle string "true"/"false" from form inputs
        const boolValue = value === 'true' || value === true
        properties[fieldKey] = { checkbox: boolValue }
      } else if (EMAIL_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { email: value || null }
      } else if (PHONE_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { phone_number: value || null }
      } else if (URL_FIELDS.includes(fieldKey)) {
        properties[fieldKey] = { url: value || null }
      } else if (Array.isArray(value)) {
        // Multi-select for array values
        properties[fieldKey] = {
          multi_select: value.map(v => ({ name: String(v) }))
        }
      } else {
        // Default to rich_text for everything else
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

    // Log the activity (non-blocking, failures won't affect the main response)
    const entityType = DB_KEY_TO_ENTITY[key] || key
    const entityTitle = updates.Name || updates.Address || updates['Deal Name'] || 'Record'
    const userName = user.name || user.email || 'User'
    logActivity(entityType, entityTitle, 'fields updated', updates, userName)

    res.status(200).json({ success: true, id: response.data.id })
  } catch (error) {
    console.error('Update error:', error.response?.data || error.message)
    res.status(500).json({ error: 'Failed to update' })
  }
}
