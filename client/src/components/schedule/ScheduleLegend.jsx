import PropTypes from 'prop-types'

function ScheduleLegend({ isAdmin }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded bg-emerald-500/50"></span>
        <span>Approved (Taken)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded bg-amber-500/50"></span>
        <span>Pending</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded bg-red-500/50"></span>
        <span>Denied</span>
      </div>
      {!isAdmin && (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-gray-700"></span>
          <span>Click to Request</span>
        </div>
      )}
    </div>
  )
}

ScheduleLegend.propTypes = {
  isAdmin: PropTypes.bool
}

export default ScheduleLegend
