import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'
import { Eye, EyeOff, Search, X, Maximize2, Minimize2, Edit3, Save, XCircle, LayoutGrid, List, Filter } from 'lucide-react'
import { getFieldPreferences } from './FieldSettings'

// #10 - Extract magic numbers to named constants
const CLOSING_RATE_THRESHOLDS = {
  HIGH: 50,    // >= 50% is green/excellent
  MEDIUM: 25   // >= 25% is amber/good, < 25% is gray/needs improvement
}

function TeamKPIView({ onNavigate }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedDealType, setSelectedDealType] = useState(null) // 'all' | 'closed' | 'pending' | 'executed'
  const [showTerminated, setShowTerminated] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedFields, setEditedFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [prefVersion, setPrefVersion] = useState(0)
  const [layoutMode, setLayoutMode] = useState('row') // 'card' or 'row'
  const [showFilters, setShowFilters] = useState(false)
  const [dynamicFilters, setDynamicFilters] = useState({})

  // Get field preferences for Team Members
  const fieldPrefs = useMemo(() => getFieldPreferences('TEAM_MEMBERS'), [prefVersion])

  // Check if user has explicitly set preferences (array exists, even if empty)
  const hasListPrefs = Array.isArray(fieldPrefs.list)
  const hasCardPrefs = Array.isArray(fieldPrefs.card)
  const hasExpandedPrefs = Array.isArray(fieldPrefs.expanded)
  const hasFiltersPrefs = Array.isArray(fieldPrefs.filters)

  // Get the fields to display based on preferences
  const listFields = hasListPrefs ? fieldPrefs.list : ['Name', 'Role', 'Status', 'Total', 'Closed', 'Pending', 'Volume', 'Close Rate']
  const cardFields = hasCardPrefs ? fieldPrefs.card : ['Name', 'Role', 'Status', 'Total', 'Closed', 'Pending', 'Volume', 'Close Rate']
  const expandedFields = hasExpandedPrefs ? fieldPrefs.expanded : []
  const filterFields = hasFiltersPrefs ? fieldPrefs.filters : ['Status', 'Role', 'City']

  // Listen for preference changes
  useEffect(() => {
    const handlePrefsChanged = () => setPrefVersion(v => v + 1)
    window.addEventListener('fieldPreferencesChanged', handlePrefsChanged)
    return () => window.removeEventListener('fieldPreferencesChanged', handlePrefsChanged)
  }, [])

  // Fetch data function - accessible for retry buttons
  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      // HttpOnly cookies handle auth automatically via withCredentials
      const response = await api.get('/api/databases/team-kpis')
      // Handle paginated response format { data: [...], pagination: {...} }
      const teamData = response.data?.data || response.data
      setData(Array.isArray(teamData) ? teamData : [])
    } catch (err) {
      // Ignore aborted requests (component unmounted)
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return
      }
      setError(err.response?.data?.error || 'Failed to fetch team KPIs')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch on mount
  useEffect(() => {
    fetchData()
  }, [])

  // Handle starting edit mode
  const handleStartEdit = () => {
    setEditedFields({ ...selectedMember.allFields })
    setIsEditing(true)
  }

  // Handle field change in edit mode
  const handleFieldChange = (key, value) => {
    setEditedFields(prev => ({ ...prev, [key]: value }))
  }

  // Handle save with field whitelist validation
  const EDITABLE_FIELDS = ['Phone', 'Email', 'Address', 'Notes', 'Name', 'Role', 'Status']

  const handleSave = async () => {
    setSaving(true)
    try {
      // Whitelist validation - only allow specific fields to be edited
      const sanitizedFields = {}
      for (const [key, value] of Object.entries(editedFields)) {
        if (EDITABLE_FIELDS.includes(key)) {
          sanitizedFields[key] = value
        }
      }

      // HttpOnly cookies handle auth automatically via withCredentials
      await api.patch(`/api/databases/team-members/${selectedMember.id}`, sanitizedFields)

      // Update local data
      setData(prev => prev.map(m =>
        m.id === selectedMember.id
          ? { ...m, allFields: { ...m.allFields, ...sanitizedFields } }
          : m
      ))
      setSelectedMember(prev => ({ ...prev, allFields: { ...prev.allFields, ...sanitizedFields } }))
      setIsEditing(false)
    } catch (err) {
      alert('Failed to save: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedFields({})
  }

  // Reset state when closing modal
  const handleCloseModal = () => {
    setSelectedMember(null)
    setSelectedDealType(null)
    setIsExpanded(false)
    setIsEditing(false)
    setEditedFields({})
  }

  const terminatedCount = useMemo(() => data.filter(m => m.status?.toLowerCase() === 'terminated').length, [data])

  // Extract unique filter options dynamically from filterFields
  const filterOptions = useMemo(() => {
    const options = {}

    filterFields.forEach(fieldName => {
      // Map field name to data property
      let values = []
      if (fieldName === 'Status') {
        values = [...new Set(data.map(m => m.status).filter(Boolean))]
      } else if (fieldName === 'Role') {
        values = [...new Set(data.map(m => m.role).filter(Boolean))]
      } else if (fieldName === 'City') {
        values = [...new Set(data.map(m => m.allFields?.City).filter(Boolean))]
      } else {
        // Try to get from allFields
        values = [...new Set(data.map(m => m.allFields?.[fieldName]).filter(v => v !== null && v !== undefined && v !== ''))]
      }
      values.sort((a, b) => String(a).localeCompare(String(b)))
      if (values.length > 0) {
        options[fieldName] = values
      }
    })

    return options
  }, [data, filterFields])

  const hasActiveFilters = Object.values(dynamicFilters).some(v => v !== '' && v !== null && v !== undefined)

  const filteredData = useMemo(() => {
    let result = showTerminated ? data : data.filter(m => m.status?.toLowerCase() !== 'terminated')
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(m =>
        m.name?.toLowerCase().includes(query) ||
        m.role?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        m.phone?.toLowerCase().includes(query)
      )
    }

    // Apply dynamic filters
    Object.entries(dynamicFilters).forEach(([fieldName, filterValue]) => {
      if (filterValue === '' || filterValue === null || filterValue === undefined) return

      result = result.filter(m => {
        let itemValue
        if (fieldName === 'Status') {
          itemValue = m.status
        } else if (fieldName === 'Role') {
          itemValue = m.role
        } else if (fieldName === 'City') {
          itemValue = m.allFields?.City
        } else {
          itemValue = m.allFields?.[fieldName]
        }
        return String(itemValue) === String(filterValue)
      })
    })

    return result
  }, [data, showTerminated, searchQuery, dynamicFilters])

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-400">Loading team performance...</p>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400">{typeof error === 'object' ? (error?.message || 'An error occurred') : error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Try Again</button>
      </motion.div>
    )
  }

  // Calculate team totals from filtered data
  const teamTotals = filteredData.reduce((acc, member) => ({
    totalDeals: acc.totalDeals + (member.kpis?.totalDeals || 0),
    closedDeals: acc.closedDeals + (member.kpis?.closedDeals || 0),
    totalVolume: acc.totalVolume + (member.kpis?.totalVolume || 0),
    closedVolume: acc.closedVolume + (member.kpis?.closedVolume || 0)
  }), { totalDeals: 0, closedDeals: 0, totalVolume: 0, closedVolume: 0 })

  const formatCurrency = (num) => '$' + num.toLocaleString()
  const formatCompact = (num) => {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K'
    return '$' + num
  }

  return (
    <div className="space-y-6">
      {/* Team Summary Cards - Monthly */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5">
          <p className="text-violet-200 text-sm">Monthly Deals</p>
          <p className="text-3xl font-bold text-white mt-1">{teamTotals.totalDeals}</p>
          <p className="text-violet-300 text-xs mt-1">{teamTotals.closedDeals} closed this month</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-emerald-600 to-green-700 rounded-2xl p-5">
          <p className="text-emerald-200 text-sm">Monthly Volume</p>
          <p className="text-3xl font-bold text-white mt-1">{formatCompact(teamTotals.totalVolume)}</p>
          <p className="text-emerald-300 text-xs mt-1">{formatCompact(teamTotals.closedVolume)} closed</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-blue-600 to-cyan-700 rounded-2xl p-5">
          <p className="text-blue-200 text-sm">Active Agents</p>
          <p className="text-3xl font-bold text-white mt-1">{filteredData.filter(m => m.status === 'Active').length}</p>
          <p className="text-blue-300 text-xs mt-1">of {filteredData.length} shown</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl p-5">
          <p className="text-amber-200 text-sm">Avg Deal Size</p>
          <p className="text-3xl font-bold text-white mt-1">{formatCompact(teamTotals.totalDeals > 0 ? teamTotals.totalVolume / teamTotals.totalDeals : 0)}</p>
          <p className="text-amber-300 text-xs mt-1">this month</p>
        </motion.div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Performance</h2>
          <p className="text-sm text-gray-400">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} stats · {filteredData.length} members
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members..."
              className="pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 w-48 sm:w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Card/Row Toggle */}
          <div className="flex items-center bg-gray-800 border border-gray-700 rounded-xl p-1">
            <button
              onClick={() => setLayoutMode('card')}
              className={`p-2 rounded-lg transition-colors ${layoutMode === 'card' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode('row')}
              className={`p-2 rounded-lg transition-colors ${layoutMode === 'row' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title="Row View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {/* Filters Button - only show if filters are configured */}
          {filterFields.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border transition-colors ${showFilters || hasActiveFilters ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
              title="Toggle Filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
          {terminatedCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowTerminated(!showTerminated)}
              className={(showTerminated ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700') + " flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border border-gray-700"}
            >
              {showTerminated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTerminated ? 'Hide' : 'Show'} Terminated ({terminatedCount})
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.1, rotate: 180 }} whileTap={{ scale: 0.9 }} onClick={fetchData} className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white">
            🔄
          </motion.button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && Object.keys(filterOptions).length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={() => setDynamicFilters({})}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(filterOptions).map(([fieldName, values]) => (
              <div key={fieldName}>
                <label className="block text-xs text-gray-500 mb-1">{fieldName}</label>
                <select
                  value={dynamicFilters[fieldName] || ''}
                  onChange={(e) => setDynamicFilters(prev => ({ ...prev, [fieldName]: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-violet-500 focus:outline-none"
                >
                  <option value="">All</option>
                  {values.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members - Card or Row View */}
      {layoutMode === 'card' ? (
        cardFields.length === 0 ? (
          <div className="rounded-xl border border-gray-700 p-8 text-center bg-gray-800">
            <p className="text-gray-500 italic">No fields configured for card view</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredData.map((member, idx) => {
              // Helper to get field value
              const getFieldValue = (field) => {
                if (field === 'Name') return member.name
                if (field === 'Role') return member.role
                if (field === 'Status') return member.status
                if (field === 'Total') return member.kpis?.totalDeals
                if (field === 'Closed') return member.kpis?.closedDeals
                if (field === 'Pending') return member.kpis?.pendingDeals
                if (field === 'Volume') return formatCompact(member.kpis?.totalVolume || 0)
                if (field === 'Close Rate') return `${member.kpis?.closingRate || 0}%`
                return member.allFields?.[field] || null
              }

              const showName = cardFields.includes('Name')
              const showRole = cardFields.includes('Role')
              const showStatus = cardFields.includes('Status')
              const showKPIs = cardFields.some(f => ['Total', 'Closed', 'Pending', 'Volume', 'Close Rate'].includes(f))
              const otherFields = cardFields.filter(f => !['Name', 'Role', 'Status', 'Total', 'Closed', 'Pending', 'Volume', 'Close Rate'].includes(f))

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  onClick={() => setSelectedMember(member)}
                  tabIndex={0}
                  role="button"
                  className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden hover:border-violet-500/50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-400" />
                  <div className="p-5">
                    {(showName || showRole || showStatus) && (
                      <div className="flex items-start justify-between mb-4">
                        {showName && (
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-lg font-bold">
                              {member.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white text-lg">{member.name || 'Unknown'}</h3>
                              {showRole && <p className="text-xs text-gray-500">{member.role || 'Agent'}</p>}
                            </div>
                          </div>
                        )}
                        {showStatus && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-600/30 text-gray-400'}`}>
                            {member.status}
                          </span>
                        )}
                      </div>
                    )}
                    {showKPIs && (
                      <>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {cardFields.includes('Total') && (
                            <div className="bg-gray-900 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-white">{member.kpis?.totalDeals || 0}</p>
                              <p className="text-xs text-gray-500">Total</p>
                            </div>
                          )}
                          {cardFields.includes('Closed') && (
                            <div className="bg-gray-900 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-emerald-400">{member.kpis?.closedDeals || 0}</p>
                              <p className="text-xs text-gray-500">Closed</p>
                            </div>
                          )}
                          {cardFields.includes('Pending') && (
                            <div className="bg-gray-900 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-amber-400">{member.kpis?.pendingDeals || 0}</p>
                              <p className="text-xs text-gray-500">Pending</p>
                            </div>
                          )}
                        </div>
                        {(cardFields.includes('Volume') || cardFields.includes('Close Rate')) && (
                          <div className="flex justify-between items-center text-sm">
                            {cardFields.includes('Volume') && <span className="text-gray-400">Volume: <span className="text-white font-semibold">{formatCompact(member.kpis?.totalVolume || 0)}</span></span>}
                            {cardFields.includes('Close Rate') && <span className={`font-semibold ${(member.kpis?.closingRate || 0) >= CLOSING_RATE_THRESHOLDS.HIGH ? 'text-emerald-400' : (member.kpis?.closingRate || 0) >= CLOSING_RATE_THRESHOLDS.MEDIUM ? 'text-amber-400' : 'text-gray-400'}`}>{member.kpis?.closingRate || 0}% closing</span>}
                          </div>
                        )}
                      </>
                    )}
                    {otherFields.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {otherFields.map(field => {
                          const value = getFieldValue(field)
                          if (!value) return null
                          return <p key={field} className="text-sm text-gray-400"><span className="text-gray-500">{field}:</span> {value}</p>
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )
      ) : listFields.length === 0 ? (
        <div className="rounded-xl border border-gray-700 p-8 text-center bg-gray-800">
          <p className="text-gray-500 italic">No columns configured for list view</p>
        </div>
      ) : (
        /* Row/Table View */
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-700">
                <tr>
                  {listFields.map(field => (
                    <th key={field} className={`px-4 py-3 text-xs font-medium text-gray-400 uppercase ${['Total', 'Closed', 'Pending'].includes(field) ? 'text-center' : ['Volume', 'Close Rate'].includes(field) ? 'text-right' : 'text-left'}`}>
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredData.map((member) => {
                  // Helper to render a cell based on field name
                  const renderCell = (field) => {
                    if (field === 'Name') {
                      return (
                        <td key={field} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                              {member.name?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-white">{member.name || 'Unknown'}</span>
                          </div>
                        </td>
                      )
                    }
                    if (field === 'Role') {
                      return <td key={field} className="px-4 py-3 text-gray-400 text-sm">{member.role || 'Agent'}</td>
                    }
                    if (field === 'Status') {
                      return (
                        <td key={field} className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-600/30 text-gray-400'}`}>
                            {member.status}
                          </span>
                        </td>
                      )
                    }
                    if (field === 'Total') {
                      return <td key={field} className="px-4 py-3 text-center text-white font-semibold">{member.kpis?.totalDeals || 0}</td>
                    }
                    if (field === 'Closed') {
                      return <td key={field} className="px-4 py-3 text-center text-emerald-400 font-semibold">{member.kpis?.closedDeals || 0}</td>
                    }
                    if (field === 'Pending') {
                      return <td key={field} className="px-4 py-3 text-center text-amber-400 font-semibold">{member.kpis?.pendingDeals || 0}</td>
                    }
                    if (field === 'Volume') {
                      return <td key={field} className="px-4 py-3 text-right text-white font-semibold">{formatCompact(member.kpis?.totalVolume || 0)}</td>
                    }
                    if (field === 'Close Rate') {
                      const rate = member.kpis?.closingRate || 0
                      return (
                        <td key={field} className="px-4 py-3 text-right">
                          <span className={`font-semibold ${rate >= CLOSING_RATE_THRESHOLDS.HIGH ? 'text-emerald-400' : rate >= CLOSING_RATE_THRESHOLDS.MEDIUM ? 'text-amber-400' : 'text-gray-400'}`}>
                            {rate}%
                          </span>
                        </td>
                      )
                    }
                    // Generic field from allFields
                    const value = member.allFields?.[field]
                    return <td key={field} className="px-4 py-3 text-gray-400 text-sm">{value ?? '-'}</td>
                  }

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className="hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      {listFields.map(field => renderCell(field))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`bg-gray-900 rounded-2xl border border-gray-700 w-full max-h-[90vh] overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-w-4xl' : 'max-w-lg'}`}
            >
              <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-400" />
              <div className="p-6 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                      {selectedMember.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedMember.name}</h2>
                      <p className="text-gray-400">{selectedMember.role || 'Agent'} • {selectedMember.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded && !isEditing && (
                      <button
                        onClick={handleStartEdit}
                        className="flex items-center gap-1 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    >
                      {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>

                {/* Editing Mode Actions */}
                {isEditing && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                    <span className="text-violet-300 text-sm flex-1">Editing mode - make changes and save</span>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}

                {/* Expanded View - Fields based on preferences or all fields */}
                {isExpanded ? (
                  hasExpandedPrefs && expandedFields.length === 0 ? (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">All Fields</h3>
                      <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-gray-500 italic">No fields configured for expanded view</p>
                      </div>
                    </div>
                  ) : (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">All Fields</h3>
                    <div className="bg-gray-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedMember.allFields && Object.entries(isEditing ? editedFields : selectedMember.allFields)
                        .filter(([key]) => {
                          // If user explicitly set expanded fields (even empty), respect that; otherwise show all
                          if (hasExpandedPrefs && expandedFields.length > 0) {
                            return expandedFields.includes(key)
                          }
                          // If hasExpandedPrefs is true but length is 0, we handled it above with empty message
                          // If hasExpandedPrefs is false (undefined), show all fields
                          return !hasExpandedPrefs
                        })
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <div key={key} className="flex flex-col p-3 bg-gray-900 rounded-lg">
                            <span className="text-gray-400 text-xs uppercase tracking-wide mb-1">{key}</span>
                            {isEditing ? (
                              Array.isArray(value) ? (
                                <input
                                  type="text"
                                  value={value.join(', ')}
                                  onChange={(e) => handleFieldChange(key, e.target.value.split(',').map(s => s.trim()))}
                                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-violet-500"
                                />
                              ) : typeof value === 'boolean' ? (
                                <select
                                  value={value ? 'true' : 'false'}
                                  onChange={(e) => handleFieldChange(key, e.target.value === 'true')}
                                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-violet-500"
                                >
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={value ?? ''}
                                  onChange={(e) => handleFieldChange(key, e.target.value)}
                                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-violet-500"
                                />
                              )
                            ) : (
                              <span className="text-gray-200 text-sm">
                                {Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '-')}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                  )
                ) : (
                  /* Collapsed View - Show fields from card preferences */
                  hasCardPrefs && cardFields.length === 0 ? (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Member Details</h3>
                      <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-gray-500 italic">No fields configured for card view</p>
                      </div>
                    </div>
                  ) : selectedMember.allFields && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Member Details</h3>
                      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                        {Object.entries(selectedMember.allFields)
                          .filter(([key, value]) => {
                            if (['id', 'created_time', 'last_edited_time'].includes(key)) return false
                            if (value === null || value === undefined || value === '') return false
                            // Use card preferences if available
                            if (hasCardPrefs && cardFields.length > 0) {
                              return cardFields.includes(key)
                            }
                            return !hasCardPrefs // If prefs undefined, show fields; if empty array we handled above
                          })
                          .slice(0, hasCardPrefs && cardFields.length > 0 ? cardFields.length : 6)
                          .map(([key, value]) => (
                            <div key={key} className="flex justify-between items-start py-2 border-b border-gray-700 last:border-0">
                              <span className="text-gray-400 text-sm">{key}</span>
                              <span className="text-gray-200 text-sm text-right max-w-[60%]">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </span>
                            </div>
                          ))}
                        {(() => {
                          const allKeys = Object.keys(selectedMember.allFields).filter(k =>
                            !['id', 'created_time', 'last_edited_time'].includes(k) &&
                            selectedMember.allFields[k] !== null && selectedMember.allFields[k] !== undefined && selectedMember.allFields[k] !== ''
                          )
                          const shownCount = hasCardPrefs && cardFields.length > 0 ? cardFields.filter(f => allKeys.includes(f)).length : Math.min(6, allKeys.length)
                          const hiddenCount = allKeys.length - shownCount
                          return hiddenCount > 0 ? (
                            <p className="text-violet-400 text-xs text-center pt-2">
                              + {hiddenCount} more fields - click Expand to see all
                            </p>
                          ) : null
                        })()}
                      </div>
                    </div>
                  )
                )}

                {/* Performance KPIs - Clickable to view deals (only show when not editing) */}
                {!isEditing && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Performance (click to view deals)</h3>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedDealType('all')}
                        className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 text-center transition-colors"
                      >
                        <p className="text-2xl font-bold text-white">{selectedMember.kpis.totalDeals}</p>
                        <p className="text-xs text-gray-400">Total</p>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedDealType('closed')}
                        className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 text-center transition-colors"
                      >
                        <p className="text-2xl font-bold text-emerald-400">{selectedMember.kpis.closedDeals}</p>
                        <p className="text-xs text-gray-400">Closed</p>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedDealType('executed')}
                        className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 text-center transition-colors"
                      >
                        <p className="text-2xl font-bold text-blue-400">{selectedMember.kpis.executedDeals}</p>
                        <p className="text-xs text-gray-400">Executed</p>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedDealType('pending')}
                        className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 text-center transition-colors"
                      >
                        <p className="text-2xl font-bold text-amber-400">{selectedMember.kpis.pendingDeals}</p>
                        <p className="text-xs text-gray-400">Pending</p>
                      </motion.button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-400">Total Volume</p>
                        <p className="text-lg font-semibold text-white">{formatCompact(selectedMember.kpis.totalVolume)}</p>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3">
                        <p className="text-gray-400">Closing Rate</p>
                        <p className={`text-lg font-semibold ${selectedMember.kpis.closingRate >= CLOSING_RATE_THRESHOLDS.HIGH ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {selectedMember.kpis.closingRate}%
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={handleCloseModal}
                  className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Deal List Modal */}
        {selectedMember && selectedDealType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDealType(null)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className={`h-2 ${
                selectedDealType === 'closed' ? 'bg-emerald-500' :
                selectedDealType === 'executed' ? 'bg-blue-500' :
                selectedDealType === 'pending' ? 'bg-amber-500' : 'bg-violet-500'
              }`} />
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    {selectedMember.name}'s {selectedDealType === 'all' ? 'All' : selectedDealType.charAt(0).toUpperCase() + selectedDealType.slice(1)} Deals
                  </h2>
                  <button onClick={() => setSelectedDealType(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                {selectedMember.deals?.[selectedDealType]?.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No deals in this category</p>
                ) : (
                  <div className="space-y-3">
                    {selectedMember.deals?.[selectedDealType]?.map((deal) => (
                      <motion.button
                        key={deal.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          // Navigate to Pipeline if deal has loan status, otherwise Properties
                          const targetView = deal.loanStatus ? 'PIPELINE' : 'PROPERTIES'
                          if (onNavigate) {
                            onNavigate(targetView, deal.id)
                          }
                          setSelectedDealType(null)
                          setSelectedMember(null)
                        }}
                        className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-xl p-4 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-white">{deal.address || 'No Address'}</p>
                            {deal.buyerName && <p className="text-sm text-gray-400 mt-1">{deal.buyerName}</p>}
                          </div>
                          <span className="text-emerald-400 font-semibold">{formatCurrency(deal.salesPrice)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-sm">
                          {deal.loanStatus && (
                            <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">{deal.loanStatus}</span>
                          )}
                          {deal.scheduledClosing && (
                            <span className="text-gray-500">Closing: {new Date(deal.scheduledClosing).toLocaleDateString()}</span>
                          )}
                          {deal.executed && (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">Executed</span>
                          )}
                        </div>
                        <p className="text-xs text-violet-400 mt-2">Click to view in {deal.loanStatus ? 'Pipeline' : 'Properties'} →</p>
                      </motion.button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setSelectedDealType(null)}
                  className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                >
                  Back to Member Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredData.length === 0 && (
        <div className="bg-gray-800 rounded-2xl p-12 text-center">
          <p className="text-6xl mb-4">👥</p>
          <h3 className="text-lg font-semibold text-gray-200">
            {searchQuery ? 'No Matching Members' : data.length === 0 ? 'No Team Members Found' : 'No Active Members'}
          </h3>
          <p className="text-gray-500 mt-2">
            {searchQuery
              ? `No team members match "${searchQuery}". Try a different search.`
              : data.length === 0
                ? 'Add team members to see their performance metrics'
                : 'All members are terminated. Click "Show Terminated" to see them.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm"
            >
              Clear Search
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default TeamKPIView
