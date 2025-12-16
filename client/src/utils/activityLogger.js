import api from '../lib/api'

/**
 * Sanitize user input before sending to API
 * - Removes null bytes
 * - Limits string length to prevent DoS
 * - Trims whitespace
 */
const MAX_STRING_LENGTH = 500

function sanitize(str) {
  if (str === null || str === undefined) return ''
  if (typeof str !== 'string') return String(str).substring(0, MAX_STRING_LENGTH)
  // Remove null bytes and other control characters, limit length, trim
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').substring(0, MAX_STRING_LENGTH).trim()
}

/**
 * Log an activity to the Activity Log database
 * @param {Object} params
 * @param {string} params.action - Description of the action (e.g., "Viewed Property")
 * @param {string} params.entityType - Type of entity (Team Member, Property, Pipeline, Client, Schedule, System)
 * @param {string} params.actionType - Type of action (View, Edit, Create, Delete, Login, Navigate)
 * @param {string} params.entityTitle - Title/name of the entity (optional)
 * @param {string} params.fromValue - Previous value for edits (optional)
 * @param {string} params.toValue - New value for edits (optional)
 */
export async function logActivity({ action, entityType, actionType, entityTitle, fromValue, toValue }) {
  try {
    await api.post('/api/databases/actions', {
      action: 'log-activity',
      logAction: sanitize(action),
      entityType: sanitize(entityType),
      actionType: sanitize(actionType),
      dealAddress: sanitize(entityTitle), // API uses dealAddress for Entity Title
      oldStatus: sanitize(fromValue),
      newStatus: sanitize(toValue)
    })
  } catch (err) {
    // Silently fail - don't break the app if logging fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('Activity logging failed:', err.message)
    }
  }
}

// Convenience methods for common actions
export const ActivityLogger = {
  // Record views
  viewRecord: (entityType, entityTitle) => {
    logActivity({
      action: `Viewed ${entityType}`,
      entityType,
      actionType: 'View',
      entityTitle
    })
  },

  // Record edits
  editRecord: (entityType, entityTitle, fieldName, fromValue, toValue) => {
    logActivity({
      action: `Edited ${entityType}: ${fieldName}`,
      entityType,
      actionType: 'Edit',
      entityTitle,
      fromValue: String(fromValue || ''),
      toValue: String(toValue || '')
    })
  },

  // Record creates
  createRecord: (entityType, entityTitle) => {
    logActivity({
      action: `Created ${entityType}`,
      entityType,
      actionType: 'Create',
      entityTitle
    })
  },

  // Navigation
  navigate: (pageName) => {
    logActivity({
      action: `Navigated to ${pageName}`,
      entityType: 'System',
      actionType: 'Navigate',
      entityTitle: pageName
    })
  },

  // Login
  login: (userName) => {
    logActivity({
      action: `User logged in`,
      entityType: 'System',
      actionType: 'Login',
      entityTitle: userName
    })
  },

  // Logout
  logout: (userName) => {
    logActivity({
      action: `User logged out`,
      entityType: 'System',
      actionType: 'Logout',
      entityTitle: userName
    })
  },

  // Schedule actions
  scheduleRequest: (modelHome, date) => {
    logActivity({
      action: `Requested schedule slot`,
      entityType: 'Schedule',
      actionType: 'Create',
      entityTitle: `${modelHome} on ${date}`
    })
  },

  scheduleApprove: (employeeName, modelHome, date) => {
    logActivity({
      action: `Approved schedule request`,
      entityType: 'Schedule',
      actionType: 'Edit',
      entityTitle: `${employeeName} - ${modelHome} on ${date}`,
      fromValue: 'Pending',
      toValue: 'Approved'
    })
  },

  scheduleDeny: (employeeName, modelHome, date, reason) => {
    logActivity({
      action: `Denied schedule request${reason ? ': ' + reason : ''}`,
      entityType: 'Schedule',
      actionType: 'Edit',
      entityTitle: `${employeeName} - ${modelHome} on ${date}`,
      fromValue: 'Pending',
      toValue: 'Denied'
    })
  }
}

export default ActivityLogger
