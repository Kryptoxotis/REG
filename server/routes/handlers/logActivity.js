import { createPage, formatPage, DATABASE_IDS } from '../../utils/notion.js'

// Server-side validation for entity and action types
const ALLOWED_ENTITY_TYPES = ['Team Member', 'Property', 'Pipeline', 'Client', 'Schedule', 'System', 'Deal']
const ALLOWED_ACTION_TYPES = ['View', 'Edit', 'Create', 'Delete', 'Login', 'Logout', 'Navigate', 'Move to Submitted', 'Move to Pending', 'Moved Stage', 'Sent Back to Properties']

export async function logActivity(req, res) {
  const { logAction, dealAddress, oldStatus, newStatus, entityType, actionType } = req.body
  const user = req.session.user?.fullName || req.session.user?.email || 'Unknown'

  if (!logAction) {
    return res.status(400).json({ error: 'logAction required' })
  }

  if (entityType && !ALLOWED_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entity type' })
  }
  if (actionType && !ALLOWED_ACTION_TYPES.includes(actionType)) {
    return res.status(400).json({ error: 'Invalid action type' })
  }

  // Sanitize and limit string lengths
  const sanitize = (str, maxLen = 500) => {
    if (!str) return str
    return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').substring(0, maxLen).trim()
  }

  const properties = {
    'Action': { title: [{ text: { content: sanitize(logAction) } }] },
    'User': { rich_text: [{ text: { content: sanitize(user) } }] },
    'Deal Address': dealAddress ? { rich_text: [{ text: { content: sanitize(dealAddress) } }] } : undefined,
    'Old Status': oldStatus ? { rich_text: [{ text: { content: sanitize(oldStatus) } }] } : undefined,
    'New Status': newStatus ? { rich_text: [{ text: { content: sanitize(newStatus) } }] } : undefined,
    'Entity Type': entityType ? { rich_text: [{ text: { content: entityType } }] } : undefined,
    'Action Type': actionType ? { rich_text: [{ text: { content: actionType } }] } : undefined,
    'Date': { date: { start: new Date().toISOString() } }
  }

  Object.keys(properties).forEach(key =>
    properties[key] === undefined && delete properties[key]
  )

  const result = await createPage(DATABASE_IDS.ACTIVITY_LOG, properties)
  return res.json({ success: true, data: formatPage(result) })
}
