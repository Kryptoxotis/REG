import { memo } from 'react'
import PropTypes from 'prop-types'
import { getStatusColor } from './scheduleConstants'

const AdminListView = memo(function AdminListView({
  filteredSchedule,
  handleApprove,
  setSelectedEvent,
  actionLoading
}) {
  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Model Home</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredSchedule.map(item => (
              <tr key={item.id} className="hover:bg-gray-700/30">
                <td className="px-4 py-3 text-white">{item.employeeName || 'Unknown'}</td>
                <td className="px-4 py-3 text-gray-300">{new Date(item.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-300">{item.modelHome}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {item.status === 'Pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(item.id)}
                        disabled={actionLoading === item.id}
                        className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setSelectedEvent(item)}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})

AdminListView.propTypes = {
  filteredSchedule: PropTypes.array.isRequired,
  handleApprove: PropTypes.func.isRequired,
  setSelectedEvent: PropTypes.func.isRequired,
  actionLoading: PropTypes.string
}

export default AdminListView
