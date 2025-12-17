import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../../config/databases.js'
import { handleCors, verifyRequestToken, extractPlainText, isValidUUID } from '../../config/utils.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY

// Format schedule page to match actual Notion schema
function formatSchedulePage(page) {
  const props = page.properties
  return {
    id: page.id,
    // Title field contains formatted string "MM/DD/YYYY - Address"
    dateTitle: props.Date?.title?.[0]?.plain_text || '',
    // Date 1 - actual date value
    date: props['Date 1']?.date?.start || null,
    // Model Home Address - text
    modelHomeAddress: extractPlainText(props['Model Home Address']?.rich_text) || '',
    // Assigned Staff 1 - text name
    assignedStaff1: extractPlainText(props['Assigned Staff 1']?.rich_text) || '',
    // Assigned Staff 2 - text name
    assignedStaff2: extractPlainText(props['Assigned Staff 2']?.rich_text) || '',
    // Staff 1 Relation - relation to Team Members
    staff1RelationId: props['Staff 1 Relation']?.relation?.[0]?.id || null,
    // Staff 2 Relation - relation to Team Members
    staff2RelationId: props['Staff 2 Relation']?.relation?.[0]?.id || null,
    // Property Relation - relation to Properties
    propertyRelationId: props['Property Relation']?.relation?.[0]?.id || null,
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
          'Action Type': { select: { name: 'Create' } }
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

// Create a new schedule entry directly (no approval workflow)
async function createScheduleEntry(data, user) {
  const { date, modelHomeAddress, assignedStaff1, assignedStaff2, staff1RelationId, staff2RelationId, propertyRelationId } = data

  if (!date) throw new Error('Date is required')
  if (!modelHomeAddress) throw new Error('Model Home Address is required')

  // Format date for title
  const dateObj = new Date(date)
  const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`
  const title = `${dateFormatted} - ${modelHomeAddress}`

  const properties = {
    // Date is the title field
    Date: { title: [{ type: 'text', text: { content: title } }] },
    // Date 1 is the actual date property
    'Date 1': { date: { start: date } },
    // Model Home Address as text
    'Model Home Address': { rich_text: [{ type: 'text', text: { content: modelHomeAddress } }] }
  }

  // Add staff assignments if provided
  if (assignedStaff1) {
    properties['Assigned Staff 1'] = { rich_text: [{ type: 'text', text: { content: assignedStaff1 } }] }
  }
  if (assignedStaff2) {
    properties['Assigned Staff 2'] = { rich_text: [{ type: 'text', text: { content: assignedStaff2 } }] }
  }

  // Add relations if IDs provided
  if (staff1RelationId && isValidUUID(staff1RelationId)) {
    properties['Staff 1 Relation'] = { relation: [{ id: staff1RelationId }] }
  }
  if (staff2RelationId && isValidUUID(staff2RelationId)) {
    properties['Staff 2 Relation'] = { relation: [{ id: staff2RelationId }] }
  }
  if (propertyRelationId && isValidUUID(propertyRelationId)) {
    properties['Property Relation'] = { relation: [{ id: propertyRelationId }] }
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
  logActivity('created schedule', `${modelHomeAddress} on ${dateFormatted}`, userName)

  return { success: true, id: response.data.id }
}

// Update an existing schedule entry
async function updateScheduleEntry(scheduleId, data, user) {
  const { date, modelHomeAddress, assignedStaff1, assignedStaff2, staff1RelationId, staff2RelationId, propertyRelationId } = data

  const properties = {}

  // Update title and date if provided
  if (date && modelHomeAddress) {
    const dateObj = new Date(date)
    const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`
    properties.Date = { title: [{ type: 'text', text: { content: `${dateFormatted} - ${modelHomeAddress}` } }] }
    properties['Date 1'] = { date: { start: date } }
  } else if (date) {
    properties['Date 1'] = { date: { start: date } }
  }

  if (modelHomeAddress !== undefined) {
    properties['Model Home Address'] = { rich_text: [{ type: 'text', text: { content: modelHomeAddress } }] }
  }

  if (assignedStaff1 !== undefined) {
    properties['Assigned Staff 1'] = { rich_text: [{ type: 'text', text: { content: assignedStaff1 || '' } }] }
  }
  if (assignedStaff2 !== undefined) {
    properties['Assigned Staff 2'] = { rich_text: [{ type: 'text', text: { content: assignedStaff2 || '' } }] }
  }

  if (staff1RelationId !== undefined) {
    properties['Staff 1 Relation'] = staff1RelationId && isValidUUID(staff1RelationId)
      ? { relation: [{ id: staff1RelationId }] }
      : { relation: [] }
  }
  if (staff2RelationId !== undefined) {
    properties['Staff 2 Relation'] = staff2RelationId && isValidUUID(staff2RelationId)
      ? { relation: [{ id: staff2RelationId }] }
      : { relation: [] }
  }
  if (propertyRelationId !== undefined) {
    properties['Property Relation'] = propertyRelationId && isValidUUID(propertyRelationId)
      ? { relation: [{ id: propertyRelationId }] }
      : { relation: [] }
  }

  if (Object.keys(properties).length === 0) {
    throw new Error('No fields to update')
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

  const userName = user.name || user.fullName || user.email || 'User'
  logActivity('updated schedule', modelHomeAddress || 'entry', userName)

  return { success: true }
}

// Delete a schedule entry
async function deleteScheduleEntry(scheduleId) {
  await axios.patch(
    `https://api.notion.com/v1/pages/${scheduleId}`,
    { archived: true },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  )
  return { success: true }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  // Auth check
  const user = verifyRequestToken(req)

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    // GET - Fetch all schedule entries
    if (req.method === 'GET') {
      const schedule = await getSchedule()
      return res.status(200).json(schedule)
    }

    // POST - Create a new schedule entry
    if (req.method === 'POST') {
      const result = await createScheduleEntry(req.body, user)
      return res.status(201).json(result)
    }

    // PATCH - Update an existing schedule entry
    if (req.method === 'PATCH') {
      const { scheduleId } = req.body

      if (!scheduleId) {
        return res.status(400).json({ error: 'Schedule ID is required' })
      }

      if (!isValidUUID(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID format' })
      }

      const result = await updateScheduleEntry(scheduleId, req.body, user)
      return res.status(200).json(result)
    }

    // DELETE - Remove a schedule entry
    if (req.method === 'DELETE') {
      const { scheduleId } = req.body

      if (!scheduleId) {
        return res.status(400).json({ error: 'Schedule ID is required' })
      }

      if (!isValidUUID(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID format' })
      }

      // Admin check for delete
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required to delete entries' })
      }

      const result = await deleteScheduleEntry(scheduleId)
      return res.status(200).json(result)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Schedule API error:', error.response?.data || error.message)
    res.status(500).json({ error: error.message || 'Failed to process schedule request' })
  }
}
