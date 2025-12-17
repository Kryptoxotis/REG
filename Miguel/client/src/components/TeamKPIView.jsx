import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

function TeamKPIView() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get('/api/databases/team-kpis', { withCredentials: true })
      setData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch team KPIs')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

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
        <p className="text-red-400">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Try Again</button>
      </motion.div>
    )
  }

  // Calculate team totals
  const teamTotals = data.reduce((acc, member) => ({
    totalDeals: acc.totalDeals + member.kpis.totalDeals,
    closedDeals: acc.closedDeals + member.kpis.closedDeals,
    totalVolume: acc.totalVolume + member.kpis.totalVolume,
    closedVolume: acc.closedVolume + member.kpis.closedVolume
  }), { totalDeals: 0, closedDeals: 0, totalVolume: 0, closedVolume: 0 })

  const formatCurrency = (num) => '$' + num.toLocaleString()
  const formatCompact = (num) => {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K'
    return '$' + num
  }

  return (
    <div className="space-y-6">
      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5">
          <p className="text-violet-200 text-sm">Total Team Deals</p>
          <p className="text-3xl font-bold text-white mt-1">{teamTotals.totalDeals}</p>
          <p className="text-violet-300 text-xs mt-1">{teamTotals.closedDeals} closed</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-emerald-600 to-green-700 rounded-2xl p-5">
          <p className="text-emerald-200 text-sm">Total Volume</p>
          <p className="text-3xl font-bold text-white mt-1">{formatCompact(teamTotals.totalVolume)}</p>
          <p className="text-emerald-300 text-xs mt-1">{formatCompact(teamTotals.closedVolume)} closed</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-blue-600 to-cyan-700 rounded-2xl p-5">
          <p className="text-blue-200 text-sm">Active Agents</p>
          <p className="text-3xl font-bold text-white mt-1">{data.filter(m => m.status === 'Active').length}</p>
          <p className="text-blue-300 text-xs mt-1">of {data.length} total</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl p-5">
          <p className="text-amber-200 text-sm">Avg Deal Size</p>
          <p className="text-3xl font-bold text-white mt-1">{formatCompact(teamTotals.totalDeals > 0 ? teamTotals.totalVolume / teamTotals.totalDeals : 0)}</p>
          <p className="text-amber-300 text-xs mt-1">per transaction</p>
        </motion.div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Performance</h2>
          <p className="text-sm text-gray-400">Individual agent KPIs and metrics</p>
        </div>
        <motion.button whileHover={{ scale: 1.1, rotate: 180 }} whileTap={{ scale: 0.9 }} onClick={fetchData} className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white">
          🔄
        </motion.button>
      </div>

      {/* Team Member Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.map((member, idx) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.01, y: -2 }}
            onClick={() => setSelectedMember(member)}
            className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden hover:border-violet-500/50 transition-all cursor-pointer"
          >
            <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-400" />
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-lg font-bold">
                    {member.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{member.name || 'Unknown'}</h3>
                    <p className="text-xs text-gray-500">{member.role || 'Agent'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  member.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-600/30 text-gray-400'
                }`}>
                  {member.status}
                </span>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-900 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{member.kpis.totalDeals}</p>
                  <p className="text-xs text-gray-500">Total Deals</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{member.kpis.closedDeals}</p>
                  <p className="text-xs text-gray-500">Closed</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{member.kpis.pendingDeals}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
              </div>

              {/* Volume & Metrics */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Volume</span>
                  <span className="text-sm font-semibold text-white">{formatCurrency(member.kpis.totalVolume)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Avg Deal Size</span>
                  <span className="text-sm font-semibold text-gray-300">{formatCurrency(member.kpis.avgDealSize)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Closing Rate</span>
                  <span className={`text-sm font-semibold ${member.kpis.closingRate >= 50 ? 'text-emerald-400' : member.kpis.closingRate >= 25 ? 'text-amber-400' : 'text-gray-400'}`}>
                    {member.kpis.closingRate}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {member.kpis.totalDeals > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Pipeline Progress</span>
                    <span>{member.kpis.closedDeals}/{member.kpis.totalDeals}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${member.kpis.closingRate}%` }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              )}

              {/* Recent Activity Badge */}
              {member.kpis.recentDeals > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-emerald-400">{member.kpis.recentDeals} deal{member.kpis.recentDeals > 1 ? 's' : ''} in last 30 days</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMember(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-400" />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                    {selectedMember.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedMember.name}</h2>
                    <p className="text-gray-400">{selectedMember.role || 'Agent'} • {selectedMember.status}</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-6">
                  {selectedMember.phone && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <span>📱</span>
                      <span>{selectedMember.phone}</span>
                    </div>
                  )}
                  {selectedMember.email && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <span>✉️</span>
                      <span>{selectedMember.email}</span>
                    </div>
                  )}
                </div>

                {/* Detailed KPIs */}
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Performance Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-3xl font-bold text-white">{selectedMember.kpis.totalDeals}</p>
                    <p className="text-sm text-gray-400">Total Deals</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-3xl font-bold text-emerald-400">{selectedMember.kpis.closedDeals}</p>
                    <p className="text-sm text-gray-400">Closed Deals</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-3xl font-bold text-blue-400">{selectedMember.kpis.executedDeals}</p>
                    <p className="text-sm text-gray-400">Executed</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-3xl font-bold text-amber-400">{selectedMember.kpis.pendingDeals}</p>
                    <p className="text-sm text-gray-400">Pending</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Total Volume</span>
                    <span className="text-white font-semibold">{formatCurrency(selectedMember.kpis.totalVolume)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Closed Volume</span>
                    <span className="text-emerald-400 font-semibold">{formatCurrency(selectedMember.kpis.closedVolume)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Average Deal Size</span>
                    <span className="text-white font-semibold">{formatCurrency(selectedMember.kpis.avgDealSize)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Closing Rate</span>
                    <span className={`font-semibold ${selectedMember.kpis.closingRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedMember.kpis.closingRate}%
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedMember(null)}
                  className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {data.length === 0 && (
        <div className="bg-gray-800 rounded-2xl p-12 text-center">
          <p className="text-6xl mb-4">👥</p>
          <h3 className="text-lg font-semibold text-gray-200">No Team Members Found</h3>
          <p className="text-gray-500 mt-2">Add team members to see their performance metrics</p>
        </div>
      )}
    </div>
  )
}

export default TeamKPIView
