import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../../config/databases.js'
import { handleCors, verifyToken } from '../../config/utils.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY

function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
}

function formatSchedulePage(page) {
  const props = page.properties
  return {
    id: page.id,
    date: props.Date?.date?.start || null,
    modelHome: extractPlainText(props['Model Home']?.rich_text) || props['Model Home']?.title?.[0]?.plain_text || '',
    modelHomeId: props['Model Home']?.relation?.[0]?.id || null,
    employeeId: props.Employee?.relation?.[0]?.id || null,
    employeeName: extractPlainText(props['Employee Name']?.rich_text) || '',
    status: props.Status?.select?.name || props.Status?.status?.name || 'Pending',
    submittedAt: props['Submitted At']?.date?.start || page.created_time,
    reviewedById: props['Reviewed By']?.relation?.[0]?.id || null,
    reviewedAt: props['Reviewed At']?.date?.start || null,
    notes: extractPlainText(props.Notes?.rich_text) || '',
    created_time: page.created_time
  }
}

// Log activity to Notion
async function logActivity(action, entityTitle, userName, details = {}) {
  try {
    const detailStr = Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(', ')
    const actionText = `${userName} ${action}${entityTitle ? `: ${entityTitle}` : ''}${detailStr ? ` (${detailStr})` : ''}`

    await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: DATABASE_IDS.ACTIVITY_LOG },
        properties: {
          Action: { title: [{ type: 'text', text: { content: actionText } }] },
          Timestamp: { date: { start: new Date().toISOString() } },
          'Entity Title': { rich_text: [{ type: 'text', text: { content: entityTitle || 'Schedule' } }] },
          'Entity Type': { select: { name: 'Schedule' } },
          'Action Type': { select: { name: action.includes('approved') ? 'Approve' : action.includes('denied') ? 'Deny' : 'Create' } }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    )
  } catch (err) {
    console.error('Activity log error (non-fatal):', err.message)
  }
}

// Fetch all schedule entries
async function getSchedule() {
  let allResults = []
  let hasMore = true
  let startCursor = undefined

  while (hasMore) {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${DATABASE_IDS.SCHEDULE}/query`,
      { start_cursor: startCursor, page_size: 100 },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )
    allResults = allResults.concat(response.data.results)
    hasMore = response.data.has_more
    startCursor = response.data.next_cursor
  }

  return allResults.map(formatSchedulePage)
}

// Create a new schedule request
async function createScheduleRequest(data, user) {
  const { date, modelHome, modelHomeId, employeeId, employeeName } = data

  if (!date) throw new Error('Date is required')
  if (!modelHome) throw new Error('Model Home is required')

  const properties = {
    Date: { date: { start: date } },
    'Model Home': { rich_text: [{ type: 'text', text: { content: modelHome } }] },
    Status: { select: { name: 'Pending' } },
    'Submitted At': { date: { start: new Date().toISOString() } }
  }

  // Add employee name for display
  if (employeeName) {
    properties['Employee Name'] = { rich_text: [{ type: 'text', text: { content: employeeName } }] }
  }

  // Add relation to Employee if we have their Team Member ID
  if (employeeId) {
    properties.Employee = { relation: [{ id: employeeId }] }
  }

  // Add relation to Model Home property if provided
  if (modelHomeId) {
    properties['Model Home Relation'] = { relation: [{ id: modelHomeId }] }
  }

  const response = await axios.post(
    'https://api.notion.com/v1/pages',
    { parent: { database_id: DATABASE_IDS.SCHEDULE }, properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  )

  // Log activity
  const userName = user.name || user.fullName || user.email || 'User'
  logActivity('requested schedule', `${modelHome} on ${date}`, userName)

  return { success: true, id: response.data.id }
}

// Approve a schedule request and auto-deny conflicts
async function approveRequest(scheduleId, reviewerId, reviewerName) {
  // First, get the request details
  const pageResponse = await axios.get(
    `https://api.notion.com/v1/pages/${scheduleId}`,
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION
      },
      timeout: 15000
    }
  )

  const page = pageResponse.data
  const date = page.properties.Date?.date?.start
  const modelHome = extractPlainText(page.properties['Model Home']?.rich_text)

  // Update this request to Approved
  await axios.patch(
    `https://api.notion.com/v1/pages/${scheduleId}`,
    {
      properties: {
        Status: { select: { name: 'Approved' } },
        'Reviewed At': { date: { start: new Date().toISOString() } },
        'Reviewed By Name': { rich_text: [{ type: 'text', text: { content: reviewerName || 'Admin' } }] }
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  )

  // Add relation to reviewer if we have their ID
  if (reviewerId) {
    try {
      await axios.patch(
        `https://api.notion.com/v1/pages/${scheduleId}`,
        {
          properties: {
            'Reviewed By': { relation: [{ id: reviewerId }] }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )
    } catch (e) {
      // Relation field might not exist, ignore
    }
  }

  // Auto-deny other pending requests for same date + model home
  if (date && modelHome) {
    const conflictsResponse = await axios.post(
      `https://api.notion.com/v1/databases/${DATABASE_IDS.SCHEDULE}/query`,
      {
        filter: {
          and: [
            { property: 'Date', date: { equals: date } },
            { property: 'Status', select: { equals: 'Pending' } }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )

    const conflicts = conflictsResponse.data.results.filter(p => {
      const pModelHome = extractPlainText(p.properties['Model Home']?.rich_text)
      return pModelHome === modelHome && p.id !== scheduleId
    })

    // Auto-deny each conflict
    for (const conflict of conflicts) {
      await axios.patch(
        `https://api.notion.com/v1/pages/${conflict.id}`,
        {
          properties: {
            Status: { select: { name: 'Denied' } },
            Notes: { rich_text: [{ type: 'text', text: { content: 'Auto-denied: Slot taken by another employee' } }] },
            'Reviewed At': { date: { start: new Date().toISOString() } },
            'Reviewed By Name': { rich_text: [{ type: 'text', text: { content: reviewerName || 'System' } }] }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )
    }

    // Log activity
    logActivity('approved schedule', `${modelHome} on ${date}`, reviewerName,
      conflicts.length > 0 ? { 'auto-denied conflicts': conflicts.length } : {})

    return { success: true, conflictsDenied: conflicts.length }
  }

  logActivity('approved schedule', `${modelHome} on ${date}`, reviewerName)
  return { success: true, conflictsDenied: 0 }
}

// Deny a schedule request
async function denyRequest(scheduleId, reviewerId, reviewerName, notes) {
  // Get request details for logging
  const pageResponse = await axios.get(
    `https://api.notion.com/v1/pages/${scheduleId}`,
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION
      },
      timeout: 15000
    }
  )

  const page = pageResponse.data
  const date = page.properties.Date?.date?.start
  const modelHome = extractPlainText(page.properties['Model Home']?.rich_text)

  const properties = {
    Status: { select: { name: 'Denied' } },
    'Reviewed At': { date: { start: new Date().toISOString() } },
    'Reviewed By Name': { rich_text: [{ type: 'text', text: { content: reviewerName || 'Admin' } }] }
  }

  if (notes) {
    properties.Notes = { rich_text: [{ type: 'text', text: { content: notes } }] }
  }

  await axios.patch(
    `https://api.notion.com/v1/pages/${scheduleId}`,
    { properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  )

  // Add relation to reviewer if we have their ID
  if (reviewerId) {
    try {
      await axios.patch(
        `https://api.notion.com/v1/pages/${scheduleId}`,
        {
          properties: {
            'Reviewed By': { relation: [{ id: reviewerId }] }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )
    } catch (e) {
      // Relation field might not exist, ignore
    }
  }

  logActivity('denied schedule', `${modelHome} on ${date}`, reviewerName, notes ? { reason: notes } : {})
  return { success: true }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  // Auth check
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const user = verifyToken(token)

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    // GET - Fetch all schedule entries
    if (req.method === 'GET') {
      const schedule = await getSchedule()
      return res.status(200).json(schedule)
    }

    // POST - Create a new schedule request
    if (req.method === 'POST') {
      const result = await createScheduleRequest(req.body, user)
      return res.status(201).json(result)
    }

    // PATCH - Approve or Deny a request
    if (req.method === 'PATCH') {
      const { action, scheduleId, notes } = req.body

      if (!scheduleId) {
        return res.status(400).json({ error: 'Schedule ID is required' })
      }

      // Admin check for approve/deny
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      const reviewerName = user.name || user.fullName || user.email || 'Admin'
      const reviewerId = user.teamMemberId || null

      if (action === 'approve') {
        const result = await approveRequest(scheduleId, reviewerId, reviewerName)
        return res.status(200).json(result)
      }

      if (action === 'deny') {
        const result = await denyRequest(scheduleId, reviewerId, reviewerName, notes)
        return res.status(200).json(result)
      }

      return res.status(400).json({ error: 'Invalid action. Use "approve" or "deny"' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Schedule API error:', error.response?.data || error.message)
    res.status(500).json({ error: error.message || 'Failed to process schedule request' })
  }
}
