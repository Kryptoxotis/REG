import { motion } from 'framer-motion'
import OfficeOverview from './OfficeOverview'

function StatsOverview({ stats, onNavigate }) {
  // Validate that stats is a proper object with expected structure (not an error object)
  const isValidStats = stats && typeof stats === 'object' && !stats.code && !stats.error && !stats.message

  if (!stats || !isValidStats) {
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
  const totalRecords = statsList.reduce((sum, [_, data]) => sum + (data?.count || 0), 0)

  // Map stats keys to navigation views
  const navMap = {
    'TEAM_MEMBERS': 'TEAM_MEMBERS',
    'PROPERTIES': 'PROPERTIES',
    'PIPELINE': 'PIPELINE',
    'CLIENTS': 'CLIENTS',
    'SCHEDULE': 'SCHEDULE'
  }

  const handleCardClick = (key) => {
    const view = navMap[key]
    if (view && onNavigate) {
      onNavigate(view)
    }
  }

  const formatCurrency = (num) => {
    if (!num) return '$0'
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`
    return `$${num}`
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
              onClick={() => handleCardClick(key)}
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
                    {data?.count || 0}
                  </motion.span>
                </div>
                <h3 className="mt-3 font-semibold text-gray-200 capitalize text-sm sm:text-base">{data.name.replace(/_/g, ' ')}</h3>
                <p className="text-xs text-indigo-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to view →</p>
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

      {/* Office Overview Section */}
      <motion.div variants={itemVariants} className="mt-8">
        <OfficeOverview onNavigate={onNavigate} />
      </motion.div>
    </motion.div>
  )
}

export default StatsOverview
