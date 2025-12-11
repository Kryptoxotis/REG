import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, TrendingUp, DollarSign, Target, Award, Phone, Mail, X, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import axios from 'axios'

function formatCurrency(value) {
  if (!value || value === 0) return '$0'
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M'
  if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K'
  return '$' + value.toLocaleString()
}

function getStatusColor(status) {
  if (!status) return 'bg-gray-700 text-gray-300'
  const s = status.toLowerCase()
  if (s.includes('active')) return 'bg-emerald-500/20 text-emerald-400'
  if (s.includes('inactive') || s.includes('terminated')) return 'bg-red-500/20 text-red-400'
  if (s.includes('pending') || s.includes('probation')) return 'bg-amber-500/20 text-amber-400'
  return 'bg-gray-700 text-gray-300'
}

function KPIBadge({ label, value, icon: Icon, color = 'violet' }) {
  const colors = {
    violet: 'bg-violet-500/20 text-violet-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    blue: 'bg-blue-500/20 text-blue-400',
    rose: 'bg-rose-500/20 text-rose-400'
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors[color]}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span className="text-xs font-medium">{label}:</span>
      <span className="text-xs font-bold">{value}</span>
    </div>
  )
}

function TeamMemberCard({ member, onClick }) {
  const { kpis } = member

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all cursor-pointer group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate group-hover:text-violet-400 transition-colors">
              {member.name}
            </h3>
            <p className="text-sm text-gray-400">{member.role}</p>
          </div>
          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(member.status)}`}>
            {member.status}
          </span>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-900/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">{kpis.totalDeals}</p>
            <p className="text-xs text-gray-500">Total Deals</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-emerald-400">{kpis.closedDeals}</p>
            <p className="text-xs text-gray-500">Closed</p>
          </div>
        </div>

        {/* Volume */}
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg p-3 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Total Volume</span>
            <span className="text-lg font-bold text-violet-400">{formatCurrency(kpis.totalVolume)}</span>
          </div>
        </div>

        {/* KPI Badges */}
        <div className="flex flex-wrap gap-2">
          <KPIBadge label="Rate" value={`${kpis.closingRate}%`} icon={Target} color="emerald" />
          <KPIBadge label="Avg" value={formatCurrency(kpis.avgDealSize)} icon={DollarSign} color="violet" />
          {kpis.recentDeals > 0 && (
            <KPIBadge label="30d" value={kpis.recentDeals} icon={TrendingUp} color="blue" />
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function TeamKPIView() {
  const [teamData, setTeamData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showTerminated, setShowTerminated] = useState(false)
  const [showAllFields, setShowAllFields] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get('/api/databases/team-kpis', { withCredentials: true })
        setTeamData(response.data || [])
      } catch (error) {
        console.error('Failed to fetch team KPIs:', error)
        setTeamData([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Count terminated members
  const terminatedCount = useMemo(() => {
    return teamData.filter(m => m.status && m.status.toLowerCase().includes('terminated')).length
  }, [teamData])

  // Filter out terminated members unless toggle is on
  const filteredData = useMemo(() => {
    if (showTerminated) return teamData
    return teamData.filter(m => !m.status || !m.status.toLowerCase().includes('terminated'))
  }, [teamData, showTerminated])

  // Calculate team totals
  const teamTotals = useMemo(() => {
    return filteredData.reduce((acc, member) => ({
      totalDeals: acc.totalDeals + member.kpis.totalDeals,
      closedDeals: acc.closedDeals + member.kpis.closedDeals,
      totalVolume: acc.totalVolume + member.kpis.totalVolume,
      closedVolume: acc.closedVolume + member.kpis.closedVolume
    }), { totalDeals: 0, closedDeals: 0, totalVolume: 0, closedVolume: 0 })
  }, [filteredData])

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-700 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-xl">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Team Performance</h2>
              <p className="text-sm text-gray-400">{filteredData.length} members</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Terminated toggle */}
            {terminatedCount > 0 && (
              <button
                onClick={() => setShowTerminated(!showTerminated)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  showTerminated
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {showTerminated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showTerminated ? 'Hide' : 'Show'} Terminated ({terminatedCount})
              </button>
            )}

            {/* Team Summary Stats */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="text-gray-400">
                <span className="text-white font-semibold">{teamTotals.totalDeals}</span> deals
              </div>
              <div className="text-gray-400">
                <span className="text-emerald-400 font-semibold">{formatCurrency(teamTotals.totalVolume)}</span> volume
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p>No team members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredData.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                onClick={() => setSelectedMember(member)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => { setSelectedMember(null); setShowAllFields(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
                <div>
                  <h3 className="font-semibold text-lg text-white">{selectedMember.name}</h3>
                  <p className="text-sm text-gray-400">{selectedMember.role}</p>
                </div>
                <button
                  onClick={() => { setSelectedMember(null); setShowAllFields(false); }}
                  className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 space-y-4">
                {/* Contact Info */}
                <div className="flex flex-wrap gap-3">
                  {selectedMember.phone && (
                    <a
                      href={`tel:${selectedMember.phone}`}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Phone className="w-4 h-4 text-violet-400" />
                      <span className="text-sm text-gray-300">{selectedMember.phone}</span>
                    </a>
                  )}
                  {selectedMember.email && (
                    <a
                      href={`mailto:${selectedMember.email}`}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-violet-400" />
                      <span className="text-sm text-gray-300">{selectedMember.email}</span>
                    </a>
                  )}
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{selectedMember.kpis.totalDeals}</p>
                    <p className="text-sm text-gray-500">Total Deals</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{selectedMember.kpis.closedDeals}</p>
                    <p className="text-sm text-gray-500">Closed Deals</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-violet-400">{formatCurrency(selectedMember.kpis.totalVolume)}</p>
                    <p className="text-sm text-gray-500">Total Volume</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-400">{selectedMember.kpis.closingRate}%</p>
                    <p className="text-sm text-gray-500">Closing Rate</p>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Executed Deals</span>
                    <span className="text-white font-medium">{selectedMember.kpis.executedDeals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pending Deals</span>
                    <span className="text-white font-medium">{selectedMember.kpis.pendingDeals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Deal Size</span>
                    <span className="text-white font-medium">{formatCurrency(selectedMember.kpis.avgDealSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Deals (Last 30 Days)</span>
                    <span className="text-white font-medium">{selectedMember.kpis.recentDeals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Closed Volume</span>
                    <span className="text-emerald-400 font-medium">{formatCurrency(selectedMember.kpis.closedVolume)}</span>
                  </div>
                </div>

                {/* Show More Details - All Notion Fields */}
                {selectedMember.allFields && (
                  <div className="mt-6">
                    <button
                      onClick={() => setShowAllFields(!showAllFields)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
                    >
                      {showAllFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showAllFields ? 'Hide Details' : 'Show More Details'}
                    </button>
                    <AnimatePresence>
                      {showAllFields && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 bg-gray-800 rounded-xl p-4 space-y-3">
                            {Object.entries(selectedMember.allFields)
                              .filter(([key, value]) =>
                                !['id', 'created_time', 'last_edited_time', 'Name', 'name', 'Role', 'role', 'Position', 'Status', 'status', 'Phone', 'phone', 'Phone Number', 'Email', 'email'].includes(key) &&
                                value !== null && value !== undefined && value !== ''
                              )
                              .map(([key, value]) => (
                                <div key={key} className="flex justify-between items-start py-2 border-b border-gray-700 last:border-0">
                                  <span className="text-gray-400 text-sm">{key}</span>
                                  <span className="text-gray-200 text-sm text-right max-w-[60%]">
                                    {Array.isArray(value) ? value.join(', ') : String(value)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
