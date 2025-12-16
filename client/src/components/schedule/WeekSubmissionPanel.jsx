import { motion } from 'framer-motion'

function WeekSubmissionPanel({
  selectedDays,
  setSelectedDays,
  selectedModelHome,
  setSelectedModelHome,
  modelHomes,
  submitting,
  handleSubmitWeek
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-4 bg-gray-800 rounded-xl border border-gray-700"
    >
      <h3 className="text-lg font-semibold text-white mb-4">Submit Your Week</h3>

      {/* Selected Days Summary */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-2">
          Selected Days: <span className={`font-bold ${
            selectedDays.length === 0 ? 'text-gray-500' :
            selectedDays.length < 3 ? 'text-amber-400' :
            selectedDays.length <= 5 ? 'text-emerald-400' :
            'text-red-400'
          }`}>{selectedDays.length}/5</span>
        </p>
        {selectedDays.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedDays.sort().map(dateStr => (
              <span
                key={dateStr}
                onClick={() => setSelectedDays(prev => prev.filter(d => d !== dateStr))}
                className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs rounded cursor-pointer hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400"
              >
                {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ×
              </span>
            ))}
          </div>
        )}
        {selectedDays.length === 0 && (
          <p className="text-xs text-gray-500">Click days on the calendar to select them</p>
        )}
        {selectedDays.length > 0 && selectedDays.length < 3 && (
          <p className="text-xs text-amber-400 mt-2">Warning: Need {3 - selectedDays.length} more day(s) to meet minimum (3 required)</p>
        )}
      </div>

      {/* Model Home Selection */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Select Model Home</label>
        <select
          value={selectedModelHome?.id || ''}
          onChange={(e) => {
            const home = modelHomes.find(h => h.id === e.target.value)
            setSelectedModelHome(home || null)
          }}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Choose a Model Home...</option>
          {modelHomes.map(home => (
            <option key={home.id} value={home.id}>
              {home.Address || home.address || home.Name}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmitWeek}
        disabled={submitting || selectedDays.length === 0 || !selectedModelHome}
        className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
      >
        {submitting ? 'Submitting...' : `Submit Week (${selectedDays.length} days)`}
      </button>

      {/* Clear Selection */}
      {selectedDays.length > 0 && (
        <button
          onClick={() => { setSelectedDays([]); setSelectedModelHome(null) }}
          className="w-full mt-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
        >
          Clear Selection
        </button>
      )}
    </motion.div>
  )
}

export default WeekSubmissionPanel
