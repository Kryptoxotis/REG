import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, TrendingUp, DollarSign, Target, Award, ChevronDown, ChevronUp, X, Eye, EyeOff, ArrowLeft, ExternalLink } from 'lucide-react'
import axios from 'axios'

const formatCurrency = (value) => {
  if (!value || value === 0) return '$0'
  return '$' + value.toLocaleString()
}

function TeamKPIView({ onNavigate }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedDealType, setSelectedDealType] = useState(null) // 'all' | 'closed' | 'pending' | 'executed'
  const [showTerminated, setShowTerminated] = useState(false)
  const [showAllFields, setShowAllFields] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/databases/team-kpis', { withCredentials: true })
      setData(response.data || [])
    } catch (error) {
      console.error('Failed to fetch team KPIs:', error)
    } finally {
      setLoading(false)
    }
  }

  const terminatedCount = useMemo(() => data.filter(m => m.status?.toLowerCase() === 'terminated').length, [data])
  const filteredData = useMemo(() => showTerminated ? data : data.filter(m => m.status?.toLowerCase() !== 'terminated'), [data, showTerminated])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 bg-gray-800 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getDealsForType = (member, type) => {
    if (!member?.deals) return []
    switch (type) {
      case 'all': return member.deals.all || []
      case 'closed': return member.deals.closed || []
      case 'pending': return member.deals.pending || []
      case 'executed': return member.deals.executed || []
      default: return []
    }
  }

  const getDealTypeLabel = (type) => {
    switch (type) {
      case 'all': return 'All Deals'
      case 'closed': return 'Closed Deals'
      case 'pending': return 'Pending Deals'
      case 'executed': return 'Executed Deals'
      default: return 'Deals'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate?.('dashboard')}
              className="p-2 hover:bg-gray-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Team Performance</h1>
              <p className="text-gray-400 mt-1">Individual KPIs and deal tracking</p>
            </div>
          </div>
          {terminatedCount > 0 && (
            <button
              onClick={() => setShowTerminated(!showTerminated)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                showTerminated ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {showTerminated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTerminated ? 'Hide' : 'Show'} Terminated ({terminatedCount})
            </button>
          )}
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((member, idx) => (
            <motion.div
              key={member.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-gray-800 rounded-2xl border overflow-hidden ${
                member.status?.toLowerCase() === 'terminated'
                  ? 'border-red-500/30 opacity-60'
                  : 'border-gray-700 hover:border-violet-500/50'
              } transition-all`}
            >
            {/* Card Header */}
            <div className="p-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {member.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{member.name}</h3>
                    <p className="text-sm text-gray-400">{member.role}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  member.status?.toLowerCase() === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                  member.status?.toLowerCase() === 'terminated' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {member.status}
                </span>
              </div>

              {/* KPI Grid - Clickable */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); setSelectedMember(member); setSelectedDealType('all'); }}
                  className="bg-gray-900 hover:bg-violet-900/30 rounded-xl p-3 text-center transition-colors border border-transparent hover:border-violet-500/50 cursor-pointer"
                >
                  <p className="text-2xl font-bold text-white">{member.kpis.totalDeals}</p>
                  <p className="text-xs text-gray-500">Total Deals</p>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); setSelectedMember(member); setSelectedDealType('closed'); }}
                  className="bg-gray-900 hover:bg-emerald-900/30 rounded-xl p-3 text-center transition-colors border border-transparent hover:border-emerald-500/50 cursor-pointer"
                >
                  <p className="text-2xl font-bold text-emerald-400">{member.kpis.closedDeals}</p>
                  <p className="text-xs text-gray-500">Closed</p>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); setSelectedMember(member); setSelectedDealType('pending'); }}
                  className="bg-gray-900 hover:bg-amber-900/30 rounded-xl p-3 text-center transition-colors border border-transparent hover:border-amber-500/50 cursor-pointer"
                >
                  <p className="text-2xl font-bold text-amber-400">{member.kpis.pendingDeals}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </motion.button>
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
                  <span className="text-sm font-semibold text-violet-400">{member.kpis.closingRate}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              {member.kpis.totalDeals > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Deal Progress</span>
                    <span>{member.kpis.closedDeals}/{member.kpis.totalDeals}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${(member.kpis.closedDeals / member.kpis.totalDeals) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

          </motion.div>
        ))}
      </div>

      {/* Deal Detail Modal */}
      <AnimatePresence>
        {selectedMember && selectedDealType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelectedMember(null); setSelectedDealType(null); setShowAllFields(false) }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedMember.name}</h3>
                  <p className="text-sm text-gray-400">{getDealTypeLabel(selectedDealType)}</p>
                </div>
                <button
                  onClick={() => { setSelectedMember(null); setSelectedDealType(null); setShowAllFields(false) }}
                  className="p-2 hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* KPI Summary in Modal */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'All', value: selectedMember.kpis.totalDeals, type: 'all', color: 'text-white' },
                    { label: 'Closed', value: selectedMember.kpis.closedDeals, type: 'closed', color: 'text-emerald-400' },
                    { label: 'Pending', value: selectedMember.kpis.pendingDeals, type: 'pending', color: 'text-amber-400' },
                    { label: 'Executed', value: selectedMember.kpis.executedDeals, type: 'executed', color: 'text-blue-400' }
                  ].map(kpi => (
                    <button
                      key={kpi.type}
                      onClick={() => setSelectedDealType(kpi.type)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        selectedDealType === kpi.type
                          ? 'bg-violet-600 ring-2 ring-violet-400'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <p className={`text-xl font-bold ${selectedDealType === kpi.type ? 'text-white' : kpi.color}`}>
                        {kpi.value}
                      </p>
                      <p className="text-xs text-gray-400">{kpi.label}</p>
                    </button>
                  ))}
                </div>

                {/* Deal List */}
                <div className="space-y-3">
                  {getDealsForType(selectedMember, selectedDealType).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p>No {getDealTypeLabel(selectedDealType).toLowerCase()} found</p>
                    </div>
                  ) : (
                    getDealsForType(selectedMember, selectedDealType).map((deal, idx) => (
                      <motion.div
                        key={deal.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-white">{deal.address}</h4>
                            {deal.buyerName && (
                              <p className="text-sm text-gray-400">Buyer: {deal.buyerName}</p>
                            )}
                          </div>
                          <span className="text-emerald-400 font-semibold">
                            {formatCurrency(deal.salesPrice)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {deal.status && (
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              deal.status.toLowerCase().includes('closed') ? 'bg-emerald-500/20 text-emerald-400' :
                              deal.status.toLowerCase().includes('pending') ? 'bg-amber-500/20 text-amber-400' :
                              deal.status.toLowerCase().includes('executed') ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {deal.status}
                            </span>
                          )}
                          {deal.loanStatus && (
                            <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full">
                              Loan: {deal.loanStatus}
                            </span>
                          )}
                          {deal.scheduledClosing && (
                            <span className="px-2 py-1 text-xs bg-violet-500/20 text-violet-400 rounded-full">
                              Closing: {new Date(deal.scheduledClosing).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
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
                                // Skip already displayed fields and system fields
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

                <button
                  onClick={() => { setSelectedMember(null); setSelectedDealType(null); setShowAllFields(false) }}
                  className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

export default TeamKPIView
