/**
 * Action Handlers Index
 *
 * Each handler is a separate module for maintainability.
 * The handler map allows easy dispatch based on action type.
 */

import { moveToPipeline } from './moveToPipeline.js'
import { updateStatus } from './updateStatus.js'
import { logActivity } from './logActivity.js'
import { moveToClosed } from './moveToClosed.js'
import { sendBackToProperties } from './sendBackToProperties.js'
import { moveToSubmitted } from './moveToSubmitted.js'
import { moveToPending } from './moveToPending.js'

// Handler map for action dispatch
export const actionHandlers = {
  'move-to-pipeline': moveToPipeline,
  'update-status': updateStatus,
  'log-activity': logActivity,
  'move-to-closed': moveToClosed,
  'send-back-to-properties': sendBackToProperties,
  'move-to-submitted': moveToSubmitted,
  'move-to-pending': moveToPending
}

export {
  moveToPipeline,
  updateStatus,
  logActivity,
  moveToClosed,
  sendBackToProperties,
  moveToSubmitted,
  moveToPending
}
