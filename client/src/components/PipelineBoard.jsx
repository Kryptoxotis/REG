import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'

const LOAN_STATUS_COLUMNS = [
  { key: 'Loan Application Received', label: 'Application', color: 'gray' },
  { key: 'Disclosures Sent', label: 'Disclosures', color: 'blue' },
  { key: 'File in Processing', label: 'Processing', color: 'yellow' },
  { key: 'Conditions Submitted', label: 'Conditions', color: 'orange' },
  { key: 'Funded', label: 'Funded', color: 'green' },
  { key: 'Closed', label: 'Closed', color: 'emerald' },
  { key: 'CASH', label: 'Cash', color: 'purple' },
  { key: 'Back On Market', label: 'BOM', color: 'red' }
]

const colorMap = {
  gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', header: 'bg-gray-600' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', header: 'bg-blue-600' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', header: 'bg-yellow-600' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', header: 'bg-orange-600' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', header: 'bg-green-600' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', header: 'bg-emerald-600' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', header: 'bg-purple-600' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', header: 'bg-red-600' }
}

function PipelineBoard() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)

  useEffect(() => { fetchDeals() }, [])

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

  // Group deals by loan status
  // API formats data flat: deal['Loan Status'] instead of deal.properties['Loan Status'].select.name
  const groupedDeals = LOAN_STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = deals.filter(deal => {
      const status = deal['Loan Status'] || ''
      return status === col.key
    })
    return acc
  }, {})

  // Count deals without status
  const unassigned = deals.filter(deal => !deal['Loan Status'])

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Pipeline Board</h2>
          <p className="text-sm text-gray-400">{deals.length} total deals in pipeline</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={fetchDeals}
          className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white"
        >
          🔄
        </motion.button>
      </div>

      {/* Pipeline Board */}
      <div className="overflow-x-auto pb-4">
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
                      // API returns flat structure
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
                          {/* Address */}
                          <p className="font-medium text-white text-sm truncate">{address || 'No Address'}</p>

                          {/* Buyer */}
                          {buyer && <p className="text-gray-400 text-xs mt-1 truncate">{buyer}</p>}

                          {/* Price & Date Row */}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-emerald-400 text-sm font-semibold">{formatCurrency(price)}</span>
                            {closingDate && (
                              <span className="text-gray-500 text-xs">{formatDate(closingDate)}</span>
                            )}
                          </div>

                          {/* Agent & Status Row */}
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

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedDeal(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {selectedDeal.Address || 'Deal Details'}
              </h2>

              <div className="space-y-3">
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
                className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  if (!value || value === '-') return null
  return (
    <div className="flex justify-between py-2 border-b border-gray-800">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}

export default PipelineBoard
