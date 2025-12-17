import { motion, AnimatePresence } from 'framer-motion'
import PropTypes from 'prop-types'

function ScheduleEventModal({ selectedEvent, onClose, isAdmin }) {
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
          <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400" />
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-blue-500/20">
                  📅
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {selectedEvent.assignedStaff1 || 'Scheduled'}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {selectedEvent.date
                      ? new Date(selectedEvent.date).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                        })
                      : 'Date not set'}
                  </p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Model Home</p>
                <p className="text-white font-medium">{selectedEvent.modelHomeAddress || 'Not specified'}</p>
              </div>

              {selectedEvent.assignedStaff2 && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Second Staff</p>
                  <p className="text-white font-medium">{selectedEvent.assignedStaff2}</p>
                </div>
              )}

              {selectedEvent.created_time && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Created</p>
                  <p className="text-gray-300">{new Date(selectedEvent.created_time).toLocaleString()}</p>
                </div>
              )}
            </div>

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
    assignedStaff1: PropTypes.string,
    assignedStaff2: PropTypes.string,
    date: PropTypes.string,
    modelHomeAddress: PropTypes.string,
    created_time: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool
}

export default ScheduleEventModal
