import { motion, AnimatePresence } from 'framer-motion'
import PropTypes from 'prop-types'
import { getStatusColor } from './scheduleConstants'

function ScheduleEventModal({
  selectedEvent,
  onClose,
  isAdmin,
  denyNotes,
  setDenyNotes,
  handleApprove,
  handleDeny,
  actionLoading
}) {
  if (!selectedEvent) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md overflow-hidden"
        >
          <div className={`h-2 ${
            selectedEvent.status === 'Approved' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
            selectedEvent.status === 'Denied' ? 'bg-gradient-to-r from-red-500 to-rose-400' :
            'bg-gradient-to-r from-amber-500 to-orange-400'
          }`} />
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  selectedEvent.status === 'Approved' ? 'bg-emerald-500/20' :
                  selectedEvent.status === 'Denied' ? 'bg-red-500/20' :
                  'bg-amber-500/20'
                }`}>
                  {selectedEvent.status === 'Approved' ? '✓' : selectedEvent.status === 'Denied' ? '✗' : '⏳'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedEvent.employeeName || 'Unknown'}</h2>
                  <p className="text-gray-400 text-sm">
                    {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEvent.status)}`}>
                {selectedEvent.status}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Model Home</p>
                <p className="text-white font-medium">{selectedEvent.modelHome || 'Not specified'}</p>
              </div>

              {selectedEvent.submittedAt && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Submitted</p>
                  <p className="text-gray-300">{new Date(selectedEvent.submittedAt).toLocaleString()}</p>
                </div>
              )}

              {selectedEvent.reviewedAt && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Reviewed</p>
                  <p className="text-gray-300">{new Date(selectedEvent.reviewedAt).toLocaleString()}</p>
                </div>
              )}

              {selectedEvent.notes && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-xs text-red-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-red-300">{selectedEvent.notes}</p>
                </div>
              )}
            </div>

            {/* Admin Actions */}
            {isAdmin && selectedEvent.status === 'Pending' && (
              <div className="mt-6 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Denial Notes (optional)</label>
                  <input
                    type="text"
                    value={denyNotes}
                    onChange={(e) => setDenyNotes(e.target.value)}
                    placeholder="Reason for denial..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(selectedEvent.id)}
                    disabled={actionLoading === selectedEvent.id}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                  >
                    {actionLoading === selectedEvent.id ? '...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleDeny(selectedEvent.id)}
                    disabled={actionLoading === selectedEvent.id}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                  >
                    {actionLoading === selectedEvent.id ? '...' : '✗ Deny'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

ScheduleEventModal.propTypes = {
  selectedEvent: PropTypes.shape({
    id: PropTypes.string,
    employeeName: PropTypes.string,
    date: PropTypes.string,
    modelHome: PropTypes.string,
    status: PropTypes.string,
    submittedAt: PropTypes.string,
    reviewedAt: PropTypes.string,
    notes: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool,
  denyNotes: PropTypes.string,
  setDenyNotes: PropTypes.func,
  handleApprove: PropTypes.func,
  handleDeny: PropTypes.func,
  actionLoading: PropTypes.string
}

export default ScheduleEventModal
