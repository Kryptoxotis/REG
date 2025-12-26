import { memo } from 'react'
import { motion } from 'framer-motion'
import PropTypes from 'prop-types'
import { getCloseDateUrgency } from './pipelineConstants'

// Mobile-optimized deal card
const MobileDealCard = memo(function MobileDealCard({ deal, onSelect, formatCurrency, formatDate }) {
  const address = deal.Address || 'No Address'
  const buyer = deal['Buyer Name'] || ''
  const price = deal['Sales Price']
  const scheduledClosing = deal['Scheduled Closing']
  const closedDate = deal['Closed Date']
  const executed = deal.Executed
  const urgency = getCloseDateUrgency(deal)

  // Card background based on close date urgency
  const cardBg = urgency === 'overdue'
    ? 'bg-red-900/40 border-red-500/50 active:bg-red-900/60'
    : urgency === 'soon'
      ? 'bg-yellow-900/30 border-yellow-500/50 active:bg-yellow-900/50'
      : 'bg-gray-800 border-gray-700 active:bg-gray-700'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(deal)}
      className={`${cardBg} rounded-2xl p-5 border cursor-pointer min-h-[80px] shadow-sm`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-base leading-tight">{address}</p>
          {buyer && <p className="text-gray-400 text-sm mt-1.5 truncate">{buyer}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-emerald-400 font-bold text-lg">{formatCurrency(price)}</p>
          {closedDate && (
            <p className="text-blue-400 text-sm mt-1">Closed: {formatDate(closedDate)}</p>
          )}
          {!closedDate && scheduledClosing && (
            <p className="text-gray-500 text-sm mt-1">{formatDate(scheduledClosing)}</p>
          )}
        </div>
      </div>
      {executed && (
        <div className="mt-3">
          <span className="bg-emerald-500/20 text-emerald-400 text-sm px-3 py-1 rounded-full font-medium">
            Executed
          </span>
        </div>
      )}
    </motion.div>
  )
})

MobileDealCard.propTypes = {
  deal: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired,
  formatCurrency: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired
}

export default MobileDealCard
