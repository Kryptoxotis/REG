import { useState, useEffect } from 'react'
import axios from 'axios'

function DatabaseViewer({ databaseKey, databaseName }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { fetchData() }, [databaseKey])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get("/api/databases/" + databaseKey, { withCredentials: true })
      setData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data')
    } finally { setLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading {databaseName}...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-400 font-medium">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Try Again
        </button>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-lg font-semibold text-gray-200">No Records Found</h3>
        <p className="text-gray-500 mt-2">This database is currently empty</p>
      </div>
    )
  }

  // Filter data based on search
  const filteredData = data.filter(item =>
    Object.values(item).some(val =>
      String(formatValue(val)).toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{databaseName}</h2>
          <p className="text-gray-400">{data.length} {data.length === 1 ? 'record' : 'records'} total</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl w-full md:w-64 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          </div>
          <button onClick={fetchData} className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
            🔄
          </button>
        </div>
      </div>

      {/* Smart Card View */}
      <SmartCardView data={filteredData} databaseKey={databaseKey} />

      {/* Footer */}
      {filteredData.length === 0 && searchTerm && (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center">
          <p className="text-gray-400">No records match your search</p>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500">
        <p>Showing {filteredData.length} of {data.length} records</p>
      </div>
    </div>
  )
}

// Smart view that adapts to any Notion database structure
function SmartCardView({ data, databaseKey }) {
  if (!data || data.length === 0) return null

  // Get all field names from the first item (excluding meta fields)
  const metaFields = ['id', 'created_time', 'last_edited_time']
  const sampleItem = data[0]
  const fields = Object.keys(sampleItem).filter(k => !metaFields.includes(k))

  // Try to identify the primary/title field (usually first non-empty string field)
  const getPrimaryField = (item) => {
    for (const field of fields) {
      const val = item[field]
      if (typeof val === 'string' && val.trim() !== '') {
        return { key: field, value: val }
      }
    }
    return { key: fields[0], value: formatValue(item[fields[0]]) }
  }

  // Find status-like field
  const getStatusField = (item) => {
    const statusKeys = fields.filter(k =>
      k.toLowerCase().includes('status') ||
      k.toLowerCase().includes('state') ||
      k.toLowerCase().includes('type')
    )
    if (statusKeys.length > 0) {
      return { key: statusKeys[0], value: item[statusKeys[0]] }
    }
    return null
  }

  // Get icon based on database type
  const getIcon = () => {
    const icons = {
      'AVAILABILITY': '📅',
      'DIRECTORY': '👤',
      'SCOREBOARD': '🏆',
      'MODEL_HOMES': '🏠',
      'SELLER_INQUIRY': '💼',
      'MORTGAGE_CALC': '💰',
      'STATUS_REPORT': '📊',
      'MASTER_CALENDAR': '📆'
    }
    return icons[databaseKey] || '📋'
  }

  // Get gradient based on database type
  const getGradient = () => {
    const gradients = {
      'AVAILABILITY': 'from-blue-500 to-cyan-400',
      'DIRECTORY': 'from-violet-500 to-purple-400',
      'SCOREBOARD': 'from-amber-500 to-orange-400',
      'MODEL_HOMES': 'from-emerald-500 to-green-400',
      'SELLER_INQUIRY': 'from-pink-500 to-rose-400',
      'MORTGAGE_CALC': 'from-indigo-500 to-blue-400',
      'STATUS_REPORT': 'from-red-500 to-pink-400',
      'MASTER_CALENDAR': 'from-teal-500 to-cyan-400'
    }
    return gradients[databaseKey] || 'from-gray-500 to-gray-400'
  }

  const iconBg = {
    'AVAILABILITY': 'bg-blue-500/20',
    'DIRECTORY': 'bg-violet-500/20',
    'SCOREBOARD': 'bg-amber-500/20',
    'MODEL_HOMES': 'bg-emerald-500/20',
    'SELLER_INQUIRY': 'bg-pink-500/20',
    'MORTGAGE_CALC': 'bg-indigo-500/20',
    'STATUS_REPORT': 'bg-red-500/20',
    'MASTER_CALENDAR': 'bg-teal-500/20'
  }[databaseKey] || 'bg-gray-500/20'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((item, idx) => {
        const primary = getPrimaryField(item)
        const status = getStatusField(item)
        const otherFields = fields.filter(f => f !== primary.key && f !== status?.key).slice(0, 4)

        return (
          <div key={item.id || idx} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all group">
            {/* Gradient accent bar */}
            <div className={`h-1.5 bg-gradient-to-r ${getGradient()}`}></div>

            <div className="p-5">
              {/* Header row with icon and status */}
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <span className="text-xl">{getIcon()}</span>
                </div>
                {status && status.value && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status.value)}`}>
                    {formatValue(status.value)}
                  </span>
                )}
              </div>

              {/* Primary field as title */}
              <h4 className="font-semibold text-white mb-1 text-lg">
                {primary.value || 'Untitled'}
              </h4>

              {/* Other fields */}
              <div className="space-y-2 mt-3">
                {otherFields.map(field => {
                  const val = item[field]
                  if (val === null || val === undefined || val === '') return null
                  return (
                    <div key={field} className="flex justify-between text-sm">
                      <span className="text-gray-500 capitalize">{field.replace(/_/g, ' ')}</span>
                      <span className="text-gray-300 font-medium truncate ml-2 max-w-[60%] text-right">
                        {formatValue(val)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Show all fields count if there are more */}
              {fields.length > 5 && (
                <p className="text-xs text-gray-600 mt-3">+ {fields.length - 5} more fields</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatValue(value) {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') {
    // Handle Notion date objects
    if (value.start) return value.start
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') return value ? '✓ Yes' : '✗ No'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function getStatusColor(status) {
  if (!status) return 'bg-gray-600/30 text-gray-400'
  const s = String(status).toLowerCase()
  if (s.includes('active') || s.includes('available') || s.includes('complete') || s.includes('done') || s.includes('approved') || s.includes('yes') || s.includes('confirmed')) return 'bg-emerald-500/20 text-emerald-400'
  if (s.includes('pending') || s.includes('waiting') || s.includes('review') || s.includes('progress')) return 'bg-amber-500/20 text-amber-400'
  if (s.includes('inactive') || s.includes('unavailable') || s.includes('cancelled') || s.includes('rejected') || s.includes('no')) return 'bg-red-500/20 text-red-400'
  if (s.includes('new') || s.includes('open')) return 'bg-blue-500/20 text-blue-400'
  return 'bg-gray-600/30 text-gray-400'
}

export default DatabaseViewer
