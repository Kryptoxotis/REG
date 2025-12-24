import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Home, Building2 } from 'lucide-react'
import api from '../lib/api'

function OfficeOverview({ onNavigate, onCitySelect, readOnly = false }) {
  const [officeData, setOfficeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedOffice, setExpandedOffice] = useState(null)
  const [properties, setProperties] = useState([]) // All properties for subdivision stats
  const [loadingProperties, setLoadingProperties] = useState(false)

  useEffect(() => {
    fetchOfficeStats()
  }, [])

  async function fetchOfficeStats() {
    try {
      setLoading(true)
      setError(null)
      // HttpOnly cookies handle auth automatically via withCredentials
      const response = await api.get('/api/databases/stats?type=by-office', {
        timeout: 20000
      })
      // Validate response has expected structure before setting
      const data = response.data
      if (data && data.offices && data.totals && data.officeList) {
        setOfficeData(data)
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error('[OfficeOverview] Invalid data format:', data)
        }
        setError('Invalid data format received')
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[OfficeOverview] Error:', err.message, err.response?.status)
      }
      setError(err.response?.data?.error || 'Failed to load office data')
    } finally {
      setLoading(false)
    }
  }

  // City to office matching terms
  const officeMap = {
    'El Paso': ["Edward's LLC.", "Edwards LLC", "El Paso"],
    'Las Cruces': ["Edward's NM.", "Edwards NM", "Las Cruces", "New Mexico"],
    'McAllen': ["Edward's RGV", "Edwards RGV", "McAllen"],
    'San Antonio': ["San Antonio"]
  }

  // Fetch inventory properties for expanded office
  const fetchInventoryForOffice = async (officeName) => {
    setLoadingProperties(true)
    try {
      // Fetch inventory (PROPERTIES) only
      const response = await api.get('/api/databases/PROPERTIES', { timeout: 15000 })
      const props = Array.isArray(response.data) ? response.data : []

      const matchTerms = officeMap[officeName] || [officeName]

      // Filter properties by office/city
      const filteredProps = props.filter(prop => {
        const officeField = prop['Edwards Co.'] || prop['Edwards Co'] || prop.Office || ''
        const address = prop.FullAddress || prop.Address || ''
        const city = prop.City || ''
        return matchTerms.some(term =>
          officeField.toLowerCase().includes(term.toLowerCase()) ||
          address.toLowerCase().includes(term.toLowerCase()) ||
          city.toLowerCase().includes(term.toLowerCase())
        )
      })

      setProperties(filteredProps)
    } catch (err) {
      console.error('Error fetching inventory:', err)
      setProperties([])
    } finally {
      setLoadingProperties(false)
    }
  }

  // Group properties by subdivision for the expanded city
  const subdivisionStats = useMemo(() => {
    if (properties.length === 0) return []

    const stats = {}
    properties.forEach(prop => {
      const subdivision = prop.Subdivision || prop.subdivision || 'Unknown'
      const status = prop.Status || prop['Sold/Available'] || ''

      if (!stats[subdivision]) {
        stats[subdivision] = {
          name: subdivision,
          modelHomes: 0,
          activeHomes: 0,
          soldHomes: 0,
          availableHomes: 0,
          total: 0
        }
      }

      stats[subdivision].total++

      const statusLower = status.toLowerCase()
      if (statusLower.includes('model')) {
        stats[subdivision].modelHomes++
      } else if (statusLower === 'available' || statusLower === 'inventory') {
        stats[subdivision].availableHomes++
        stats[subdivision].activeHomes++
      } else if (statusLower === 'sold') {
        stats[subdivision].soldHomes++
      } else if (!statusLower.includes('sold')) {
        stats[subdivision].activeHomes++
      }
    })

    // Convert to array and sort by total descending
    return Object.values(stats).sort((a, b) => b.total - a.total)
  }, [properties])

  // Handle office card click
  const handleOfficeClick = (officeName) => {
    if (readOnly) return // No interaction for read-only mode

    if (onCitySelect) {
      onCitySelect(officeName)
    } else {
      // Toggle expand
      if (expandedOffice === officeName) {
        setExpandedOffice(null)
        setProperties([])
      } else {
        setExpandedOffice(officeName)
        fetchInventoryForOffice(officeName)
      }
    }
  }

  const formatCurrency = (num) => {
    if (!num) return '$0'
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`
    return `$${num.toLocaleString()}`
  }

  const officeColors = {
    'El Paso': { gradient: 'from-violet-600 to-purple-500', bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
    'Las Cruces': { gradient: 'from-emerald-600 to-teal-500', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    'McAllen': { gradient: 'from-blue-600 to-cyan-500', bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
    'San Antonio': { gradient: 'from-amber-600 to-orange-500', bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400' },
    'Other': { gradient: 'from-gray-600 to-gray-500', bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400' }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center py-20"
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"
          />
          <p className="mt-4 text-gray-400">Loading office data...</p>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20"
      >
        <p className="text-6xl mb-4">⚠️</p>
        <p className="text-gray-400">{typeof error === 'object' ? (error?.message || 'An error occurred') : error}</p>
        <button
          onClick={fetchOfficeStats}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
        >
          Retry
        </button>
      </motion.div>
    )
  }

  // Null check for officeData structure
  if (!officeData || !officeData.offices || !officeData.totals || !officeData.officeList) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-64 text-gray-400"
      >
        <p>No data available</p>
        <button
          onClick={fetchOfficeStats}
          className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          Refresh
        </button>
      </motion.div>
    )
  }

  const { offices, totals, officeList } = officeData

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Office Overview</h2>
          <p className="text-sm text-gray-400">Inventory metrics by office location</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={fetchOfficeStats}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center gap-2"
        >
          <span>🔄</span> Refresh
        </motion.button>
      </motion.div>

      {/* Totals Summary */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active</p>
          <p className="text-2xl font-bold text-emerald-400">{totals.active}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{totals.pending}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sold</p>
          <p className="text-2xl font-bold text-blue-400">{totals.sold}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Executed</p>
          <p className="text-2xl font-bold text-violet-400">{totals.executed}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Closes</p>
          <p className="text-2xl font-bold text-pink-400">{totals.closes}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Volume</p>
          <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totals.volume)}</p>
        </div>
      </motion.div>

      {/* Office Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {officeList.map((officeName, idx) => {
          const stats = offices[officeName]
          const colors = officeColors[officeName] || officeColors['Other']
          const isExpanded = expandedOffice === officeName

          return (
            <motion.div
              key={officeName}
              variants={itemVariants}
              custom={idx}
              whileHover={{ scale: 1.01 }}
              className={`bg-gray-800 rounded-2xl border ${colors.border} overflow-hidden`}
            >
              {/* Office Header */}
              <div
                className={`bg-gradient-to-r ${colors.gradient} p-4 ${readOnly ? '' : 'cursor-pointer'}`}
                onClick={() => handleOfficeClick(officeName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏢</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">{officeName}</h3>
                      <p className="text-sm text-white/80">
                        {stats.active + stats.pending + stats.sold + stats.executed} total properties
                      </p>
                    </div>
                  </div>
                  {!readOnly && (
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      className="text-white/80"
                    >
                      ▼
                    </motion.span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="p-4">
                <div className="grid grid-cols-5 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-400">{stats.active}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-400">{stats.pending}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-400">{stats.sold}</p>
                    <p className="text-xs text-gray-500">Sold</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-violet-400">{stats.closes}</p>
                    <p className="text-xs text-gray-500">Closes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-cyan-400">{formatCurrency(stats.volume)}</p>
                    <p className="text-xs text-gray-500">Volume</p>
                  </div>
                </div>

                {/* Expandable Details - Subdivisions */}
                <AnimatePresence>
                  {isExpanded && !readOnly && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        {/* Subdivisions Section */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                              Subdivisions ({subdivisionStats.length})
                            </p>
                          </div>

                          {loadingProperties ? (
                            <div className="flex items-center justify-center py-4">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full"
                              />
                            </div>
                          ) : subdivisionStats.length === 0 ? (
                            <p className="text-gray-500 text-sm py-2 text-center">No subdivisions found</p>
                          ) : (
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {subdivisionStats.map(sub => (
                                <div
                                  key={sub.name}
                                  className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-white text-sm font-medium">{sub.name}</p>
                                    <span className="text-xs text-gray-500">{sub.total} homes</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2 text-xs">
                                    <span className="flex items-center gap-1 text-emerald-400">
                                      <Home className="w-3 h-3" /> {sub.modelHomes} model
                                    </span>
                                    <span className="text-blue-400">{sub.activeHomes} active</span>
                                    <span className="text-violet-400">{sub.soldHomes} sold</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* View Divisions Button */}
                        {onNavigate && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onNavigate('DIVISIONS', { city: officeName })}
                            className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            View Divisions →
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Show "Other" office if it has deals */}
      {offices['Other'] && (offices['Other'].active + offices['Other'].pending + offices['Other'].sold + offices['Other'].executed) > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">📍</span>
              <div>
                <h3 className="font-semibold text-gray-300">Other Locations</h3>
                <p className="text-xs text-gray-500">
                  Properties not matched to primary offices
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-gray-400">Active: <span className="text-emerald-400">{offices['Other'].active}</span></span>
              <span className="text-gray-400">Pending: <span className="text-amber-400">{offices['Other'].pending}</span></span>
              <span className="text-gray-400">Sold: <span className="text-blue-400">{offices['Other'].sold}</span></span>
              <span className="text-gray-400">Volume: <span className="text-cyan-400">{formatCurrency(offices['Other'].volume)}</span></span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default OfficeOverview
