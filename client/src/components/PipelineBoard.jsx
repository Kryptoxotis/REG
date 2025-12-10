import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

const LOAN_STATUS_COLUMNS = [
  { key: 'Loan Application Received', label: 'Application', shortLabel: 'App', color: 'gray' },
  { key: 'Disclosures Sent', label: 'Disclosures', shortLabel: 'Disc', color: 'blue' },
  { key: 'File in Processing', label: 'Processing', shortLabel: 'Proc', color: 'yellow' },
  { key: 'Conditions Submitted', label: 'Conditions', shortLabel: 'Cond', color: 'orange' },
  { key: 'Funded', label: 'Funded', shortLabel: 'Fund', color: 'green' },
  { key: 'Closed', label: 'Closed', shortLabel: 'Close', color: 'emerald' },
  { key: 'CASH', label: 'Cash', shortLabel: 'Cash', color: 'purple' },
  { key: 'Back On Market', label: 'BOM', shortLabel: 'BOM', color: 'red' }
]

const colorMap = {
  gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', header: 'bg-gray-600', dot: 'bg-gray-500' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', header: 'bg-blue-600', dot: 'bg-blue-500' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', header: 'bg-yellow-600', dot: 'bg-yellow-500' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', header: 'bg-orange-600', dot: 'bg-orange-500' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', header: 'bg-green-600', dot: 'bg-green-500' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', header: 'bg-emerald-600', dot: 'bg-emerald-500' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', header: 'bg-purple-600', dot: 'bg-purple-500' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', header: 'bg-red-600', dot: 'bg-red-500' }
}

function PipelineBoard({ highlightedDealId, onClearHighlight }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [viewMode, setViewMode] = useState('monthly') // 'monthly' or 'all'
  const [expandedColumns, setExpandedColumns] = useState({}) // For mobile accordion

  useEffect(() => { fetchDeals() }, [])

  // Auto-select deal when highlightedDealId changes
  useEffect(() => {
    if (highlightedDealId && deals.length > 0) {
      const deal = deals.find(d => d.id === highlightedDealId)
      if (deal) {
        setSelectedDeal(deal)
        if (onClearHighlight) onClearHighlight()
      }
    }
  }, [highlightedDealId, deals, onClearHighlight])

  const fetchDeals = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/databases/PIPELINE', { withCredentials: true })
      // API returns array directly, not { results: [...] }
      setDeals(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch pipeline')
    } finally { setLoading(false) }
  }

  const formatCurrency = (num) => num ? '$' + num.toLocaleString() : '-'
  const formatDate = (dateObj) => {
    if (!dateObj?.start) return '-'
    return new Date(dateObj.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Filter deals by time period
  const isThisMonth = (deal) => {
    // Check Executed date, Scheduled Closing, or Created date
    const dateFields = [deal['Scheduled Closing'], deal['Closed Date'], deal.Executed]
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    for (const dateObj of dateFields) {
      if (dateObj?.start) {
        const d = new Date(dateObj.start)
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          return true
        }
      }
    }
    // Also include deals without dates (new deals)
    return !dateFields.some(d => d?.start)
  }

  const filteredDeals = viewMode === 'monthly'
    ? deals.filter(isThisMonth)
    : deals

  // Group deals by loan status
  const groupedDeals = LOAN_STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = filteredDeals.filter(deal => {
      const status = deal['Loan Status'] || ''
      return status === col.key
    })
    return acc
  }, {})

  // Count deals without status
  const unassigned = filteredDeals.filter(deal => !deal['Loan Status'])

  // Toggle column expand on mobile
  const toggleColumn = (key) => {
    setExpandedColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-400">Loading pipeline...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchDeals} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Try Again</button>
      </div>
    )
  }

  // Get current month name
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' })

  return (
    <div className="space-y-4">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Pipeline</h2>
          <p className="text-sm text-gray-400">
            {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
            {viewMode === 'monthly' ? ` in ${currentMonthName}` : ' total'}
          </p>
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-2">
          {/* Monthly/All Toggle */}
          <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                viewMode === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                viewMode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Refresh */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={fetchDeals}
            className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white"
          >
            🔄
          </motion.button>
        </div>
      </div>

      {/* Quick Stats - Mobile Summary */}
      <div className="grid grid-cols-4 sm:hidden gap-2">
        {LOAN_STATUS_COLUMNS.slice(0, 4).map(col => {
          const colors = colorMap[col.color]
          const count = (groupedDeals[col.key] || []).length
          return (
            <div
              key={col.key}
              onClick={() => toggleColumn(col.key)}
              className={`${colors.bg} ${colors.border} border rounded-xl p-2 text-center cursor-pointer`}
            >
              <div className={`text-lg font-bold ${colors.text}`}>{count}</div>
              <div className="text-xs text-gray-400 truncate">{col.shortLabel}</div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-4 sm:hidden gap-2">
        {LOAN_STATUS_COLUMNS.slice(4).map(col => {
          const colors = colorMap[col.color]
          const count = (groupedDeals[col.key] || []).length
          return (
            <div
              key={col.key}
              onClick={() => toggleColumn(col.key)}
              className={`${colors.bg} ${colors.border} border rounded-xl p-2 text-center cursor-pointer`}
            >
              <div className={`text-lg font-bold ${colors.text}`}>{count}</div>
              <div className="text-xs text-gray-400 truncate">{col.shortLabel}</div>
            </div>
          )
        })}
      </div>

      {/* Mobile Accordion View */}
      <div className="sm:hidden space-y-2">
        {LOAN_STATUS_COLUMNS.map((col) => {
          const colors = colorMap[col.color]
          const columnDeals = groupedDeals[col.key] || []
          const isExpanded = expandedColumns[col.key]

          if (columnDeals.length === 0) return null

          return (
            <div key={col.key} className="rounded-xl overflow-hidden">
              {/* Accordion Header */}
              <button
                onClick={() => toggleColumn(col.key)}
                className={`${colors.header} w-full px-4 py-3 flex items-center justify-between`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{col.label}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm text-white">
                    {columnDeals.length}
                  </span>
                </div>
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  className="text-white/70"
                >
                  ▼
                </motion.span>
              </button>

              {/* Accordion Body */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`${colors.bg} ${colors.border} border border-t-0`}
                  >
                    <div className="p-3 space-y-2">
                      {columnDeals.map((deal) => (
                        <MobileDealCard
                          key={deal.id}
                          deal={deal}
                          onSelect={setSelectedDeal}
                          formatCurrency={formatCurrency}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Desktop Kanban View */}
      <div className="hidden sm:block overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {LOAN_STATUS_COLUMNS.map((col) => {
            const colors = colorMap[col.color]
            const columnDeals = groupedDeals[col.key] || []

            return (
              <div key={col.key} className="w-72 flex-shrink-0">
                {/* Column Header */}
                <div className={`${colors.header} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                  <span className="font-semibold text-white">{col.label}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm text-white">
                    {columnDeals.length}
                  </span>
                </div>

                {/* Column Body */}
                <div className={`${colors.bg} ${colors.border} border border-t-0 rounded-b-xl p-3 min-h-[400px] space-y-3`}>
                  {columnDeals.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-8">No deals</p>
                  ) : (
                    columnDeals.map((deal, idx) => {
                      const address = deal.Address || ''
                      const buyer = deal['Buyer Name'] || ''
                      const agent = deal.Agent || ''
                      const price = deal['Sales Price']
                      const closingDate = deal['Scheduled Closing']
                      const executed = deal.Executed

                      return (
                        <motion.div
                          key={deal.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          onClick={() => setSelectedDeal(deal)}
                          className="bg-gray-800 rounded-xl p-3 border border-gray-700 hover:border-gray-500 cursor-pointer transition-all"
                        >
                          <p className="font-medium text-white text-sm truncate">{address || 'No Address'}</p>
                          {buyer && <p className="text-gray-400 text-xs mt-1 truncate">{buyer}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-emerald-400 text-sm font-semibold">{formatCurrency(price)}</span>
                            {closingDate && (
                              <span className="text-gray-500 text-xs">{formatDate(closingDate)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            {agent && (
                              <span className="text-xs text-gray-500 truncate max-w-[120px]">{agent}</span>
                            )}
                            {executed && (
                              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                                Executed
                              </span>
                            )}
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Unassigned Deals Warning */}
      {unassigned.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-400 text-sm">
            ⚠️ {unassigned.length} deal{unassigned.length > 1 ? 's' : ''} without Loan Status assigned
          </p>
        </div>
      )}

      {/* Deal Detail Modal - Mobile Optimized */}
      <AnimatePresence>
        {selectedDeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDeal(null)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-gray-700 w-full sm:max-w-lg max-h-[85vh] overflow-hidden"
            >
              {/* Drag handle for mobile */}
              <div className="sm:hidden flex justify-center py-2">
                <div className="w-12 h-1 bg-gray-600 rounded-full" />
              </div>

              <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400" />

              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-3rem)]">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
                  {selectedDeal.Address || 'Deal Details'}
                </h2>

                <div className="space-y-2">
                  <DetailRow label="Buyer" value={selectedDeal['Buyer Name']} />
                  <DetailRow label="Agent" value={selectedDeal.Agent} />
                  <DetailRow label="Sales Price" value={formatCurrency(selectedDeal['Sales Price'])} />
                  <DetailRow label="Loan Status" value={selectedDeal['Loan Status']} />
                  <DetailRow label="Loan Type" value={selectedDeal['Loan Type']} />
                  <DetailRow label="Scheduled Closing" value={formatDate(selectedDeal['Scheduled Closing'])} />
                  <DetailRow label="Closed Date" value={formatDate(selectedDeal['Closed Date'])} />
                  <DetailRow label="Executed" value={selectedDeal.Executed ? 'Yes' : 'No'} />
                  <DetailRow label="LO Name" value={selectedDeal['LO Name']} />
                  <DetailRow label="Mortgage Company" value={selectedDeal['Mortgage Company']} />
                </div>

                <button
                  onClick={() => setSelectedDeal(null)}
                  className="mt-6 w-full py-3.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white rounded-xl transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailRow({ label, value }) {
  if (!value || value === '-') return null
  return (
    <div className="flex justify-between py-2 border-b border-gray-800">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  )
}

// Mobile-optimized deal card
function MobileDealCard({ deal, onSelect, formatCurrency, formatDate }) {
  const address = deal.Address || 'No Address'
  const buyer = deal['Buyer Name'] || ''
  const price = deal['Sales Price']
  const closingDate = deal['Scheduled Closing']
  const executed = deal.Executed

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(deal)}
      className="bg-gray-800 rounded-xl p-4 border border-gray-700 active:bg-gray-700 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{address}</p>
          {buyer && <p className="text-gray-400 text-sm mt-0.5 truncate">{buyer}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-emerald-400 font-semibold">{formatCurrency(price)}</p>
          {closingDate && (
            <p className="text-gray-500 text-xs mt-0.5">{formatDate(closingDate)}</p>
          )}
        </div>
      </div>
      {executed && (
        <div className="mt-2">
          <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
            Executed
          </span>
        </div>
      )}
    </motion.div>
  )
}

export default PipelineBoard
