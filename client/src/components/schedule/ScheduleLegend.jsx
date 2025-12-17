import PropTypes from 'prop-types'

function ScheduleLegend({ isAdmin }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded bg-blue-500/50"></span>
        <span>Scheduled</span>
      </div>
      {!isAdmin && (
        <>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-amber-500/50"></span>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-gray-700"></span>
            <span>Click to Select</span>
          </div>
        </>
      )}
    </div>
  )
}

ScheduleLegend.propTypes = {
  isAdmin: PropTypes.bool
}

export default ScheduleLegend
