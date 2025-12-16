import { memo } from 'react'
import { motion } from 'framer-motion'
import PropTypes from 'prop-types'

const AdminPendingPanel = memo(function AdminPendingPanel({
  pendingCount,
  scheduleData,
  setSelectedEvent
}) {
  if (pendingCount === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
    >
      <h3 className="text-amber-400 font-semibold mb-3">Pending Requests ({pendingCount})</h3>
      <div className="grid gap-2 max-h-40 overflow-y-auto">
        {scheduleData.filter(s => s.status === 'Pending').slice(0, 5).map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedEvent(item)}
            className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-700/50"
          >
            <div>
              <p className="text-white text-sm font-medium">{item.employeeName || 'Unknown'}</p>
              <p className="text-gray-400 text-xs">{item.modelHome} - {new Date(item.date).toLocaleDateString()}</p>
            </div>
            <span className="text-amber-400 text-xs">Review</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
})

AdminPendingPanel.propTypes = {
  pendingCount: PropTypes.number.isRequired,
  scheduleData: PropTypes.array.isRequired,
  setSelectedEvent: PropTypes.func.isRequired
}

export default AdminPendingPanel
