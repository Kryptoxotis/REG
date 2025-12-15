import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

function StatsOverview({ stats }) {
  const [cityData, setCityData] = useState(null)
  const [expandedCities, setExpandedCities] = useState({})
  const [loadingCities, setLoadingCities] = useState(true)

  useEffect(() => {
    fetchCityStats()
  }, [])

  const fetchCityStats = async () => {
    try {
      const response = await axios.get('/api/databases/stats/cities', { withCredentials: true })
      setCityData(response.data)
    } catch (error) {
      console.error('Failed to fetch city stats:', error)
    } finally {
      setLoadingCities(false)
    }
  }

  const toggleCity = (cityName) => {
    setExpandedCities(prev => ({
      ...prev,
      [cityName]: !prev[cityName]
    }))
  }

  if (!stats) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-6xl mb-4"
        >
          📊
        </motion.div>
        <p className="text-gray-400">No statistics available</p>
      </motion.div>
    )
  }

  const cardData = {
    team_members: { icon: '👥', gradient: 'from-violet-500 to-purple-400', bg: 'bg-violet-500/20' },
    properties: { icon: '🏘️', gradient: 'from-emerald-500 to-green-400', bg: 'bg-emerald-500/20' },
    pipeline: { icon: '📊', gradient: 'from-blue-500 to-cyan-400', bg: 'bg-blue-500/20' },
    clients: { icon: '💼', gradient: 'from-pink-500 to-rose-400', bg: 'bg-pink-500/20' },
    schedule: { icon: '📅', gradient: 'from-amber-500 to-orange-400', bg: 'bg-amber-500/20' }
  }

  const statsList = Object.entries(stats)
  const totalRecords = statsList.reduce((sum, [_, data]) => sum + data.count, 0)

  const formatCurrency = (num) => {
    if (!num) return '$0'
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`
    return `$${num.toLocaleString()}`
  }

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A'
    // Handle Notion date object format
    const dateStr = typeof dateValue === 'object' ? dateValue.start : dateValue
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const getStatusBadgeColor = (status) => {
    if (!status) return 'bg-gray-600/30 text-gray-400'
    const s = String(status).toLowerCase()
    if (s.includes('closed') || s.includes('funded') || s.includes('clear') || s.includes('done')) {
      return 'bg-emerald-500/20 text-emerald-400'
    }
    if (s.includes('pending') || s.includes('processing') || s.includes('progress') || s.includes('conditions') || s.includes('submitted')) {
      return 'bg-amber-500/20 text-amber-400'
    }
    if (s.includes('cancelled') || s.includes('denied') || s.includes('failed') || s.includes('back on market')) {
      return 'bg-red-500/20 text-red-400'
    }
    if (s.includes('new') || s.includes('application') || s.includes('disclosures') || s.includes('appraisal')) {
      return 'bg-blue-500/20 text-blue-400'
    }
    return 'bg-gray-600/30 text-gray-400'
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 sm:space-y-8"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Overview</h2>
          <p className="text-sm sm:text-base text-gray-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <motion.div whileHover={{ scale: 1.05 }} className="bg-gray-800 rounded-xl px-3 sm:px-4 py-2 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Databases</p>
            <p className="text-lg sm:text-xl font-bold text-white">{statsList.length}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} className="bg-gray-800 rounded-xl px-3 sm:px-4 py-2 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Records</p>
            <p className="text-lg sm:text-xl font-bold text-indigo-400">{totalRecords.toLocaleString()}</p>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
        {statsList.map(([key, data], idx) => {
          const card = cardData[key.toLowerCase()] || { icon: '📋', gradient: 'from-gray-500 to-gray-400', bg: 'bg-gray-500/20' }
          return (
            <motion.div
              key={key}
              variants={itemVariants}
              custom={idx}
              whileHover={{ scale: 1.03, y: -4 }}
              className="bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors group cursor-pointer"
            >
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: idx * 0.1 + 0.3 }}
                className={`h-1 sm:h-1.5 bg-gradient-to-r ${card.gradient} origin-left`}
              />
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    className={`${card.bg} w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center text-xl sm:text-2xl`}
                  >
                    {card.icon}
                  </motion.div>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1 + 0.4, type: 'spring' }}
                    className="text-2xl sm:text-3xl font-bold text-white"
                  >
                    {data.count}
                  </motion.span>
                </div>
                <h3 className="mt-3 font-semibold text-gray-200 capitalize text-sm sm:text-base">{data.name.replace(/_/g, ' ')}</h3>
                {/* Breakdown stats */}
                <div className="mt-2 space-y-1 text-xs text-gray-500">
                  {key === 'TEAM_MEMBERS' && data.active !== undefined && (
                    <p><span className="text-emerald-400">{data.active}</span> active</p>
                  )}
                  {key === 'PROPERTIES' && (
                    <>
                      {data.modelHomes !== undefined && <p><span className="text-teal-400">{data.modelHomes}</span> model homes</p>}
                      {data.inventory !== undefined && <p><span className="text-blue-400">{data.inventory}</span> inventory</p>}
                    </>
                  )}
                  {key === 'PIPELINE' && (
                    <>
                      {data.executed !== undefined && <p><span className="text-emerald-400">{data.executed}</span> executed</p>}
                      {data.pending !== undefined && <p><span className="text-amber-400">{data.pending}</span> pending</p>}
                    </>
                  )}
                  {key === 'SCHEDULE' && data.upcoming !== undefined && (
                    <p><span className="text-amber-400">{data.upcoming}</span> upcoming</p>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Stats - Pipeline Volume & Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-blue-600 to-cyan-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center"
            >
              <span className="text-xl sm:text-2xl">💰</span>
            </motion.div>
            <div>
              <p className="text-white/80 text-xs sm:text-sm">Pipeline Volume</p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl sm:text-3xl font-bold">
                {formatCurrency(stats.PIPELINE?.totalVolume)}
              </motion.p>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center"
            >
              <span className="text-xl sm:text-2xl">👥</span>
            </motion.div>
            <div>
              <p className="text-white/80 text-xs sm:text-sm">Active Agents</p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl sm:text-3xl font-bold">
                {stats.TEAM_MEMBERS?.active || 0}
              </motion.p>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center"
            >
              <span className="text-xl sm:text-2xl">⚡</span>
            </motion.div>
            <div>
              <p className="text-white/80 text-xs sm:text-sm">System Status</p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl sm:text-3xl font-bold">
                Online
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* City Deals Section */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-bold text-white">Deals by City</h3>
          {cityData && (
            <span className="text-sm text-gray-400">{cityData.totalDeals} total deals</span>
          )}
        </div>

        {loadingCities ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
            />
          </div>
        ) : cityData?.cities?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {cityData.cities.map((city, idx) => {
              const isExpanded = expandedCities[city.name]
              const cityGradients = [
                'from-indigo-500 to-purple-500',
                'from-cyan-500 to-blue-500',
                'from-emerald-500 to-teal-500',
                'from-orange-500 to-red-500',
                'from-pink-500 to-rose-500',
                'from-violet-500 to-indigo-500',
                'from-blue-500 to-cyan-500',
                'from-teal-500 to-green-500',
                'from-amber-500 to-orange-500',
                'from-rose-500 to-pink-500'
              ]
              const gradient = cityGradients[idx % cityGradients.length]

              return (
                <motion.div
                  key={city.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                >
                  {/* City Header - Clickable */}
                  <motion.button
                    onClick={() => toggleCity(city.name)}
                    whileHover={{ backgroundColor: 'rgba(55, 65, 81, 1)' }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full p-4 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                        <span className="text-white text-lg">🏙️</span>
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-white">{city.name}</h4>
                        <p className="text-xs text-gray-400">
                          {city.dealCount} {city.dealCount === 1 ? 'deal' : 'deals'} • {formatCurrency(city.totalVolume)}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gray-400"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </motion.button>

                  {/* Expandable Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-gray-700">
                          {/* Status Summary */}
                          <div className="flex flex-wrap gap-2 py-3">
                            {Object.entries(city.statuses).map(([status, count]) => (
                              <span
                                key={status}
                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(status)}`}
                              >
                                {status}: {count}
                              </span>
                            ))}
                          </div>

                          {/* Deal List */}
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {city.deals.map((deal, dealIdx) => (
                              <motion.div
                                key={deal.id || dealIdx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: dealIdx * 0.05 }}
                                className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-white truncate">{deal.address}</p>
                                    <p className="text-xs text-gray-400 truncate">{deal.buyerName}</p>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStatusBadgeColor(deal.status)}`}>
                                    {deal.status}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  <span>Agent: <span className="text-gray-300">{deal.agent}</span></span>
                                  <span>Price: <span className="text-emerald-400">{formatCurrency(deal.salesPrice)}</span></span>
                                  {deal.scheduledClosing && (
                                    <span>Closing: <span className="text-amber-400">{formatDate(deal.scheduledClosing)}</span></span>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>

                          {city.deals.length >= 20 && (
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              Showing first 20 deals
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <span className="text-4xl mb-2 block">🏙️</span>
            <p className="text-gray-400">No city data available</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default StatsOverview
