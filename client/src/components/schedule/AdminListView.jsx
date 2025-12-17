import { memo } from 'react'
import PropTypes from 'prop-types'

const AdminListView = memo(function AdminListView({
  filteredSchedule,
  setSelectedEvent
}) {
  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Staff</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Model Home</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Second Staff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredSchedule.map(item => (
              <tr
                key={item.id}
                onClick={() => setSelectedEvent(item)}
                className="hover:bg-gray-700/30 cursor-pointer"
              >
                <td className="px-4 py-3 text-white">{item.assignedStaff1 || 'Not assigned'}</td>
                <td className="px-4 py-3 text-gray-300">
                  {item.date ? new Date(item.date).toLocaleDateString() : 'No date'}
                </td>
                <td className="px-4 py-3 text-gray-300">{item.modelHomeAddress || '-'}</td>
                <td className="px-4 py-3 text-gray-400">{item.assignedStaff2 || '-'}</td>
              </tr>
            ))}
            {filteredSchedule.length === 0 && (
              <tr>
                <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                  No schedule entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
})

AdminListView.propTypes = {
  filteredSchedule: PropTypes.array.isRequired,
  setSelectedEvent: PropTypes.func.isRequired
}

export default AdminListView
