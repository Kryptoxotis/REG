import { motion, AnimatePresence } from 'framer-motion'
import { MONTH_NAMES, getISODate } from './scheduleConstants'

function DaySelectionModal({
  selectedDay,
  setSelectedDay,
  selectedModelHome,
  setSelectedModelHome,
  modelHomes,
  month,
  year,
  getUserWeekRequests,
  isSlotTaken,
  getUserPendingForSlot,
  handleSubmitRequest,
  submitting
}) {
  if (!selectedDay) return null

  const dateStr = getISODate(year, month, selectedDay)
  const weekRequests = getUserWeekRequests(dateStr)
  const count = weekRequests.length
  const isAtMax = count >= 5
  const isUnderMin = count < 3

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { setSelectedDay(null); setSelectedModelHome(null) }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[80vh] overflow-hidden"
        >
          <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-400" />
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-1">
              {MONTH_NAMES[month]} {selectedDay}, {year}
            </h2>
            <p className="text-gray-400 text-sm mb-6">Select a Model Home to request this shift</p>

            {/* Week status - prominent display */}
            <div className={`mb-4 p-4 rounded-xl border ${
              isAtMax ? 'bg-red-500/10 border-red-500/30' :
              isUnderMin ? 'bg-amber-500/10 border-amber-500/30' :
              'bg-emerald-500/10 border-emerald-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">This Week's Schedule</span>
                <span className={`text-lg font-bold ${
                  isAtMax ? 'text-red-400' :
                  isUnderMin ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>{count}/5 days</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${
                    isAtMax ? 'bg-red-500' :
                    count >= 3 ? 'bg-emerald-500' :
                    'bg-amber-500'
                  }`}
                  style={{ width: `${(count / 5) * 100}%` }}
                />
                {/* Minimum marker at 3/5 = 60% */}
                <div className="relative -mt-2 h-2">
                  <div className="absolute left-[60%] w-0.5 h-2 bg-white/50" title="Minimum: 3 days" />
                </div>
              </div>

              {/* Status message */}
              {isAtMax ? (
                <p className="text-xs text-red-400 font-medium">
                  Maximum reached - Cannot add more shifts this week
                </p>
              ) : isUnderMin ? (
                <p className="text-xs text-amber-400">
                  Warning: Need {3 - count} more day(s) to meet minimum (3 required)
                </p>
              ) : (
                <p className="text-xs text-emerald-400">
                  Minimum met - Can add {5 - count} more day(s)
                </p>
              )}
            </div>

            {/* Model Homes List */}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {modelHomes.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No model homes available</p>
              ) : (
                modelHomes.map(home => {
                  const address = home.Address || home.address || home.Name || 'Unknown'
                  const taken = isSlotTaken(dateStr, address)
                  const userPending = getUserPendingForSlot(dateStr, address)
                  const isSelected = selectedModelHome?.id === home.id

                  return (
                    <div
                      key={home.id}
                      onClick={() => {
                        if (!taken && !userPending) setSelectedModelHome(home)
                      }}
                      className={`p-4 rounded-xl border transition-all ${
                        taken
                          ? 'bg-gray-800/30 border-gray-700 opacity-50 cursor-not-allowed'
                          : userPending
                            ? 'bg-amber-500/10 border-amber-500/30 cursor-not-allowed'
                            : isSelected
                              ? 'bg-amber-500/20 border-amber-500 cursor-pointer'
                              : 'bg-gray-800 border-gray-700 hover:border-gray-600 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{address}</p>
                          <p className="text-gray-400 text-xs mt-1">
                            {home.Subdivision || home.City || ''}
                          </p>
                        </div>
                        {taken && (
                          <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                            Taken by {taken.employeeName?.split(' ')[0] || 'Someone'}
                          </span>
                        )}
                        {userPending && (
                          <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded">
                            You: Pending
                          </span>
                        )}
                        {isSelected && !taken && !userPending && (
                          <span className="text-amber-400">Selected</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitRequest}
                disabled={!selectedModelHome || submitting || isAtMax}
                className={`flex-1 py-3 font-medium rounded-xl transition-colors ${
                  isAtMax
                    ? 'bg-red-900/50 text-red-400 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white'
                }`}
              >
                {submitting ? 'Submitting...' : isAtMax ? 'Max 5 Days Reached' : 'Submit Request'}
              </button>
              <button
                onClick={() => { setSelectedDay(null); setSelectedModelHome(null) }}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default DaySelectionModal
