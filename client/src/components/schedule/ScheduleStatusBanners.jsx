import { MONTH_NAMES } from './scheduleConstants'

function ScheduleStatusBanners({
  scheduleIsOpen,
  scheduleOpenDay,
  isCurrentMonth,
  isNextMonth,
  isFutureMonth,
  nextMonthIndex,
  nextMonthYear
}) {
  return (
    <div className="space-y-3">
      {/* Schedule Open/Closed Banner */}
      {!scheduleIsOpen ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400 flex items-center gap-2">
            <span className="text-lg">Locked</span>
            <span>
              <strong>Schedule Locked</strong> - Opens on the {scheduleOpenDay}th of each month.
              You can view the calendar but cannot submit requests until then.
            </span>
          </p>
        </div>
      ) : isCurrentMonth ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <span className="text-lg">Calendar</span>
            <span><strong>Current Month (View Only)</strong> - Navigate to next month to submit your schedule requests.</span>
          </p>
        </div>
      ) : isNextMonth ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <span className="text-lg">Open</span>
            <span><strong>Schedule Open</strong> - Click days to select them, then submit your week below.</span>
          </p>
        </div>
      ) : isFutureMonth ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <span className="text-lg">Locked</span>
            <span><strong>Future Month</strong> - You can only submit schedules for next month. Navigate back to {MONTH_NAMES[nextMonthIndex]} {nextMonthYear}.</span>
          </p>
        </div>
      ) : (
        <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4">
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <span className="text-lg">Archive</span>
            <span><strong>Past Month</strong> - View only.</span>
          </p>
        </div>
      )}

      {/* Rules */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <p className="text-sm text-gray-300">
          <span className="text-amber-400 font-medium">Rules:</span> You must schedule at least 3 days per week (minimum) and no more than 5 days per week (maximum).
        </p>
      </div>
    </div>
  )
}

export default ScheduleStatusBanners
