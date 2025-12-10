import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import DetailModal from './DetailModal'

function DatabaseViewer({ databaseKey, databaseName, highlightedId, onClearHighlight }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => { fetchData() }, [databaseKey])

  // Auto-select item when highlightedId changes
  useEffect(() => {
    if (highlightedId && data.length > 0) {
      const item = data.find(d => d.id === highlightedId)
      if (item) {
        setSelectedItem(item)
        if (onClearHighlight) onClearHighlight()
      }
    }
  }, [highlightedId, data, onClearHighlight])

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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 text-gray-400">Loading {databaseName}...</motion.p>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-4xl mb-3">⚠️</motion.div>
        <p className="text-red-400 font-medium">{error}</p>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Try Again</motion.button>
      </motion.div>
    )
  }

  if (data.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-4">📭</motion.div>
        <h3 className="text-lg font-semibold text-gray-200">No Records Found</h3>
        <p className="text-gray-500 mt-2">This database is currently empty</p>
      </motion.div>
    )
  }

  const filteredData = data.filter(item =>
    Object.values(item).some(val => String(formatValue(val)).toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">{databaseName}</h2>
          <p className="text-sm text-gray-400">{data.length} {data.length === 1 ? 'record' : 'records'} total</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.div className="relative flex-1 sm:flex-none" whileFocus={{ scale: 1.02 }}>
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 bg-gray-800 border border-gray-700 rounded-xl w-full sm:w-64 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          </motion.div>
          <motion.button whileHover={{ scale: 1.1, rotate: 180 }} whileTap={{ scale: 0.9 }} onClick={fetchData} className="p-2 sm:p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-colors flex-shrink-0">🔄</motion.button>
        </div>
      </motion.div>

      <SmartCardView data={filteredData} databaseKey={databaseKey} onItemClick={setSelectedItem} />

      <AnimatePresence>
        {selectedItem && (
          <DetailModal item={selectedItem} databaseKey={databaseKey} onClose={() => setSelectedItem(null)} onUpdate={fetchData} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {filteredData.length === 0 && searchTerm && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center">
            <p className="text-gray-400">No records match your search</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-between text-xs sm:text-sm text-gray-500">
        <p>Showing {filteredData.length} of {data.length} records</p>
      </motion.div>
    </div>
  )
}

function SmartCardView({ data, databaseKey, onItemClick }) {
  if (!data || data.length === 0) return null

  const metaFields = ['id', 'created_time', 'last_edited_time']
  const sampleItem = data[0]
  const fields = Object.keys(sampleItem).filter(k => !metaFields.includes(k))

  // Database-specific field configs (matched to actual Notion field names)
  const dbConfig = {
    TEAM_MEMBERS: {
      icon: '👥', gradient: 'from-violet-500 to-purple-400', iconBg: 'bg-violet-500/20',
      titleField: 'Name', subtitleField: 'Phone', statusField: 'Status',
      showFields: ['Email - ERA', 'Role', 'License Number']
    },
    PROPERTIES: {
      icon: '🏘️', gradient: 'from-emerald-500 to-green-400', iconBg: 'bg-emerald-500/20',
      titleField: 'Address', subtitleField: 'Subdivision', statusField: 'Status',
      showFields: ['SqFt', 'Sales Price', 'Floorplan']
    },
    MODEL_HOMES: {
      icon: '🏠', gradient: 'from-teal-500 to-cyan-400', iconBg: 'bg-teal-500/20',
      titleField: 'Address', subtitleField: 'Subdivision', statusField: 'Status',
      showFields: ['SqFt', 'Sales Price', 'Floorplan']
    },
    PIPELINE: {
      icon: '📊', gradient: 'from-blue-500 to-cyan-400', iconBg: 'bg-blue-500/20',
      titleField: 'Address', subtitleField: 'Buyer Name', statusField: 'Loan Status',
      showFields: ['Sales Price', 'Agent', 'Scheduled Closing', 'Executed']
    },
    CLIENTS: {
      icon: '💼', gradient: 'from-pink-500 to-rose-400', iconBg: 'bg-pink-500/20',
      titleField: 'Property Address', subtitleField: 'Full Name', statusField: 'Status',
      showFields: ['Phone', 'Email', 'Timeline']
    },
    SCHEDULE: {
      icon: '📅', gradient: 'from-amber-500 to-orange-400', iconBg: 'bg-amber-500/20',
      titleField: 'Date', subtitleField: 'Model Home Address', statusField: null,
      showFields: ['Assigned Staff 1', 'Assigned Staff 2']
    },
    SCOREBOARD: {
      icon: '🏆', gradient: 'from-indigo-500 to-purple-400', iconBg: 'bg-indigo-500/20',
      titleField: 'Address', subtitleField: 'Agent', statusField: 'Loan Status',
      showFields: ['Sales Price', 'Closed Date', 'Loan Amount']
    }
  }

  const config = dbConfig[databaseKey] || { icon: '📋', gradient: 'from-gray-500 to-gray-400', iconBg: 'bg-gray-500/20', titleField: fields[0], showFields: fields.slice(1, 4) }

  const getPrimaryField = (item) => {
    const val = item[config.titleField]
    if (val) return { key: config.titleField, value: val }
    for (const field of fields) {
      const v = item[field]
      if (typeof v === 'string' && v.trim() !== '') return { key: field, value: v }
    }
    return { key: fields[0], value: formatValue(item[fields[0]]) }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' } })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {data.map((item, idx) => {
        const primary = getPrimaryField(item)
        const status = config.statusField ? item[config.statusField] : null
        const subtitle = config.subtitleField ? item[config.subtitleField] : null
        const displayFields = config.showFields.filter(f => item[f] !== null && item[f] !== undefined && item[f] !== '')

        return (
          <motion.div
            key={item.id || idx}
            custom={idx}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            onClick={() => onItemClick && onItemClick(item)}
            className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors group cursor-pointer"
          >
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: idx * 0.05 + 0.2 }} className={`h-1 sm:h-1.5 bg-gradient-to-r ${config.gradient} origin-left`} />

            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <motion.div whileHover={{ scale: 1.2, rotate: 10 }} className={`w-8 h-8 sm:w-10 sm:h-10 ${config.iconBg} rounded-lg flex items-center justify-center`}>
                  <span className="text-lg sm:text-xl">{config.icon}</span>
                </motion.div>
                {status && (
                  <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                    {formatValue(status)}
                  </motion.span>
                )}
              </div>

              <h4 className="font-semibold text-white mb-1 text-base sm:text-lg line-clamp-2">{primary.value || 'Untitled'}</h4>
              {subtitle && <p className="text-xs text-gray-500">{formatValue(subtitle)}</p>}

              <div className="space-y-1.5 sm:space-y-2 mt-2 sm:mt-3">
                {displayFields.slice(0, 4).map(field => (
                  <div key={field} className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-500 truncate flex-shrink-0 max-w-[40%]">{field}</span>
                    <span className="text-gray-300 font-medium truncate ml-2 max-w-[55%] text-right">{formatValue(item[field])}</span>
                  </div>
                ))}
              </div>

              {fields.length > 5 && <p className="text-xs text-gray-600 mt-2 sm:mt-3">+ {fields.length - 5} more fields</p>}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function formatValue(value) {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') {
    if (value.start) return value.start
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') return value ? '✓ Yes' : '✗ No'
  if (typeof value === 'number') {
    if (value > 10000) return '$' + value.toLocaleString()
    return value.toLocaleString()
  }
  return String(value)
}

function getStatusColor(status) {
  if (!status) return 'bg-gray-600/30 text-gray-400'
  const s = String(status).toLowerCase()
  if (s.includes('active') || s.includes('model home') || s.includes('closed') || s.includes('funded') || s.includes('done') || s.includes('yes')) return 'bg-emerald-500/20 text-emerald-400'
  if (s.includes('pending') || s.includes('processing') || s.includes('progress') || s.includes('conditions')) return 'bg-amber-500/20 text-amber-400'
  if (s.includes('inactive') || s.includes('cancelled') || s.includes('back on market') || s.includes('no')) return 'bg-red-500/20 text-red-400'
  if (s.includes('inventory') || s.includes('new') || s.includes('application') || s.includes('disclosures')) return 'bg-blue-500/20 text-blue-400'
  return 'bg-gray-600/30 text-gray-400'
}

export default DatabaseViewer
