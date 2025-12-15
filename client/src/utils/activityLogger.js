import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

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
    const token = localStorage.getItem('auth_token')
    if (!token) return // Don't log if not authenticated

    await axios.post(`${API_BASE}/api/databases/actions`, {
      action: 'log-activity',
      logAction: action,
      entityType,
      actionType,
      dealAddress: entityTitle, // API uses dealAddress for Entity Title
      oldStatus: fromValue,
      newStatus: toValue
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch (err) {
    // Silently fail - don't break the app if logging fails
    console.warn('Activity logging failed:', err.message)
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
