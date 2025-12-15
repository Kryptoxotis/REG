import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings as SettingsIcon, Activity, ChevronDown, ChevronUp, RefreshCw, Clock, User, Database, Filter, X } from 'lucide-react'
import CSVSync from './CSVSync'
import FieldSettings from './FieldSettings'
import { useDatabase } from '../hooks/useApi'

function Settings() {
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false)
  const [activityExpanded, setActivityExpanded] = useState(false)

  // Activity Log Filters
  const [filterUser, setFilterUser] = useState('')
  const [filterActionType, setFilterActionType] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterDateRange, setFilterDateRange] = useState('all') // all, today, week, month
  const [showFilters, setShowFilters] = useState(false)

  // Fetch activity log data
  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useDatabase('ACTIVITY_LOG')

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!activityData) return { users: [], actionTypes: [], entityTypes: [] }

    const users = new Set()
    const actionTypes = new Set()
    const entityTypes = new Set()

    activityData.forEach(item => {
      if (item['User'] || item['User Name']) users.add(item['User'] || item['User Name'])
      if (item['Action Type']) actionTypes.add(item['Action Type'])
      if (item['Entity Type']) entityTypes.add(item['Entity Type'])
    })

    return {
      users: Array.from(users).filter(Boolean).sort(),
      actionTypes: Array.from(actionTypes).filter(Boolean).sort(),
      entityTypes: Array.from(entityTypes).filter(Boolean).sort()
    }
  }, [activityData])

  // Filter and sort activity data
  const filteredActivity = useMemo(() => {
    if (!activityData) return []

    let filtered = [...activityData]

    // Filter by user
    if (filterUser) {
      filtered = filtered.filter(item =>
        (item['User'] || item['User Name'] || '').toLowerCase().includes(filterUser.toLowerCase())
      )
    }

    // Filter by action type
    if (filterActionType) {
      filtered = filtered.filter(item => item['Action Type'] === filterActionType)
    }

    // Filter by entity type
    if (filterEntityType) {
      filtered = filtered.filter(item => item['Entity Type'] === filterEntityType)
    }

    // Filter by date range
    if (filterDateRange !== 'all') {
      const now = new Date()
      const cutoff = new Date()

      switch (filterDateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0)
          break
        case 'week':
          cutoff.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoff.setMonth(now.getMonth() - 1)
          break
      }

      filtered = filtered.filter(item => {
        const itemDate = new Date(item.Timestamp || item.created_time || 0)
        return itemDate >= cutoff
      })
    }

    // Sort by most recent
    return filtered
      .sort((a, b) => {
        const dateA = new Date(a.Timestamp || a.created_time || 0)
        const dateB = new Date(b.Timestamp || b.created_time || 0)
        return dateB - dateA
      })
      .slice(0, 100) // Show up to 100 with filters
  }, [activityData, filterUser, filterActionType, filterEntityType, filterDateRange])

  // Count active filters
  const activeFilterCount = [filterUser, filterActionType, filterEntityType, filterDateRange !== 'all' ? filterDateRange : ''].filter(Boolean).length

  // Clear all filters
  const clearFilters = () => {
    setFilterUser('')
    setFilterActionType('')
    setFilterEntityType('')
    setFilterDateRange('all')
  }

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get entity type color
  const getEntityColor = (entityType) => {
    const type = (entityType || '').toLowerCase()
    if (type.includes('team') || type.includes('member')) return 'bg-blue-500/20 text-blue-400'
    if (type.includes('property') || type.includes('properties')) return 'bg-emerald-500/20 text-emerald-400'
    if (type.includes('pipeline') || type.includes('deal')) return 'bg-violet-500/20 text-violet-400'
    if (type.includes('client')) return 'bg-amber-500/20 text-amber-400'
    if (type.includes('schedule')) return 'bg-pink-500/20 text-pink-400'
    return 'bg-gray-500/20 text-gray-400'
  }

  return (
    <div className="space-y-6">
      {/* CSV Sync Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CSVSync />
      </motion.div>

      {/* Field Display Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800 rounded-2xl border border-gray-700 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-xl">
              <SettingsIcon className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Field Display Settings</h2>
              <p className="text-sm text-gray-400">Configure which fields show in each database view</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFieldSettingsOpen(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
          >
            Configure Fields
          </motion.button>
        </div>
      </motion.div>

      {/* Activity Log Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden"
      >
        <button
          onClick={() => setActivityExpanded(!activityExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <Activity className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-white">Activity Log</h2>
              <p className="text-sm text-gray-400">View recent changes across all databases</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activityData && (
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded-lg text-sm">
                {activityData.length} entries
              </span>
            )}
            {activityExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {activityExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 border-t border-gray-700">
                {/* Filter Controls */}
                <div className="flex items-center justify-between pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        showFilters || activeFilterCount > 0
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">{activeFilterCount}</span>
                      )}
                    </button>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-2 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                    <span className="text-sm text-gray-400 ml-2">
                      {filteredActivity.length} {filteredActivity.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <button
                    onClick={() => refetchActivity()}
                    disabled={activityLoading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${activityLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {/* Filter Panel */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4">
                        {/* User Filter */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">User</label>
                          <input
                            type="text"
                            value={filterUser}
                            onChange={(e) => setFilterUser(e.target.value)}
                            placeholder="Search user..."
                            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        {/* Action Type Filter */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Action Type</label>
                          <select
                            value={filterActionType}
                            onChange={(e) => setFilterActionType(e.target.value)}
                            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
                          >
                            <option value="">All Actions</option>
                            {filterOptions.actionTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        {/* Entity Type Filter */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Entity Type</label>
                          <select
                            value={filterEntityType}
                            onChange={(e) => setFilterEntityType(e.target.value)}
                            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
                          >
                            <option value="">All Types</option>
                            {filterOptions.entityTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Date Range</label>
                          <select
                            value={filterDateRange}
                            onChange={(e) => setFilterDateRange(e.target.value)}
                            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
                          >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {activityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                  </div>
                ) : filteredActivity.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {activeFilterCount > 0 ? 'No activity matches your filters' : 'No activity recorded yet'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredActivity.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 bg-gray-900 rounded-lg flex items-start gap-3"
                      >
                        <div className={`px-2 py-1 rounded text-xs font-medium ${getEntityColor(item['Entity Type'])}`}>
                          {item['Entity Type'] || 'Unknown'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-gray-200 text-sm truncate">
                              {item.Action || 'Activity logged'}
                            </p>
                            {item['Action Type'] && (
                              <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                                {item['Action Type']}
                              </span>
                            )}
                          </div>
                          {item['Entity Title'] && (
                            <p className="text-gray-500 text-xs truncate mt-0.5">
                              {item['Entity Title']}
                            </p>
                          )}
                          {(item['From Value'] || item['To Value']) && (
                            <p className="text-gray-600 text-xs mt-0.5">
                              {item['From Value'] && <span className="text-red-400">{item['From Value']}</span>}
                              {item['From Value'] && item['To Value'] && ' → '}
                              {item['To Value'] && <span className="text-emerald-400">{item['To Value']}</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-xs whitespace-nowrap">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(item.Timestamp || item.created_time)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Field Settings Modal */}
      <FieldSettings
        isOpen={fieldSettingsOpen}
        onClose={() => setFieldSettingsOpen(false)}
      />
    </div>
  )
}

export default Settings
