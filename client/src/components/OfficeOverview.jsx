import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'

function OfficeOverview({ onNavigate, onCitySelect, readOnly = false }) {
  const [officeData, setOfficeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedOffice, setExpandedOffice] = useState(null)
  const [expandedDeals, setExpandedDeals] = useState([]) // Deals for expanded office

  useEffect(() => {
    fetchOfficeStats()
  }, [])

  const fetchOfficeStats = async () => {
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

  // Fetch deals for expanded office (admin only)
  const fetchDealsForOffice = async (officeName) => {
    try {
      // HttpOnly cookies handle auth automatically via withCredentials
      const response = await api.get('/api/databases/PIPELINE', {
        timeout: 15000
      })
      const deals = Array.isArray(response.data) ? response.data : []

      // Filter by office - match Edwards Co. field
      const officeMap = {
        'El Paso': ["Edward's LLC.", "Edwards LLC", "El Paso"],
        'Las Cruces': ["Edward's NM.", "Edwards NM", "Las Cruces", "New Mexico"],
        'McAllen': ["Edward's RGV", "Edwards RGV", "McAllen"],
        'San Antonio': ["San Antonio"]
      }
      const matchTerms = officeMap[officeName] || [officeName]

      const filteredDeals = deals.filter(deal => {
        const officeField = deal['Edwards Co.'] || deal['Edwards Co'] || deal.Office || ''
        const address = deal.Address || deal['Property Address'] || ''
        return matchTerms.some(term =>
          officeField.toLowerCase().includes(term.toLowerCase()) ||
          address.toLowerCase().includes(term.toLowerCase())
        )
      })

      setExpandedDeals(filteredDeals)
    } catch (err) {
      console.error('Error fetching deals:', err)
      setExpandedDeals([])
    }
  }

  // Handle office card click
  const handleOfficeClick = (officeName) => {
    if (readOnly) return // No interaction for read-only mode

    if (onCitySelect) {
      onCitySelect(officeName)
    } else {
      // Toggle expand
      if (expandedOffice === officeName) {
        setExpandedOffice(null)
        setExpandedDeals([])
      } else {
        setExpandedOffice(officeName)
        fetchDealsForOffice(officeName)
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
          <p className="text-sm text-gray-400">Pipeline metrics by office location</p>
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
                        {stats.active + stats.pending + stats.sold + stats.executed} total deals
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

                {/* Expandable Details - Property List */}
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
                        {/* Property List */}
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                            Properties in Pipeline ({expandedDeals.length})
                          </p>
                          {expandedDeals.length === 0 ? (
                            <p className="text-gray-500 text-sm py-4 text-center">Loading...</p>
                          ) : (
                            expandedDeals.map(deal => (
                              <div
                                key={deal.id}
                                className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50"
                              >
                                <p className="text-white text-sm font-medium truncate">
                                  {deal.Address || deal['Property Address'] || 'No Address'}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-gray-400">
                                    {deal['Loan Status'] || 'No Status'}
                                  </span>
                                  <span className="text-xs text-emerald-400 font-medium">
                                    {deal['Sales Price'] ? formatCurrency(deal['Sales Price']) : '-'}
                                  </span>
                                </div>
                                {deal.Agent && (
                                  <p className="text-xs text-gray-500 mt-1">{deal.Agent}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* View Pipeline Button */}
                        {onNavigate && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onNavigate('PIPELINE')}
                            className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            View Full Pipeline →
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
                  Deals not matched to primary offices
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
