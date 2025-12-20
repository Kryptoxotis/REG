import { motion, AnimatePresence } from 'framer-motion'
import PropTypes from 'prop-types'
import DetailRow from './DetailRow'
import { LOAN_STATUS_COLUMNS, colorMap, getAddress, formatCurrency, formatDate } from './pipelineConstants'

function DealDetailModal({
  selectedDeal,
  onClose,
  pipelineTab,
  // Move form props
  moveForm,
  setMoveForm,
  teamMembers,
  // Move to Pending flow props (Submitted → Pending)
  moveToPending,
  isMovingToPending,
  // Status change props (for Pending tab)
  changeStatus,
  isChangingStatus,
  sendBackToProperties,
  isSendingBack
}) {
  if (!selectedDeal) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
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
          {/* Drag handle for mobile - tap to close */}
          <div
            className="sm:hidden flex justify-center py-3 cursor-pointer active:bg-gray-800/50"
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClose()}
            aria-label="Close modal"
          >
            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
          </div>

          <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400" />

          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-3rem)]">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              {getAddress(selectedDeal) || 'Deal Details'}
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

            {/* Move to Pending section - show for Submitted deals in Submitted tab */}
            {pipelineTab === 'submitted' && selectedDeal['Loan Status'] === 'Submitted' && (
              <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-blue-500/30">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">Complete Contract Submission</h3>
                <p className="text-xs text-gray-400 mb-3">Fill out the full contract details. This will lock the address and archive the property.</p>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {/* Contract Info */}
                  <p className="text-xs text-amber-400 font-medium">Contract Information</p>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Who is submitting this contract? *</label>
                    <select
                      value={moveForm.submittedBy || ''}
                      onChange={e => setMoveForm(prev => ({ ...prev, submittedBy: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.Name || member.name}>
                          {member.Name || member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Agent Role</label>
                    <select
                      value={moveForm.agentRole || ''}
                      onChange={e => setMoveForm(prev => ({ ...prev, agentRole: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select Role</option>
                      <option value="Listing Agent">Listing Agent</option>
                      <option value="Buyers Agent">Buyers Agent</option>
                      <option value="Dual Agent">Dual Agent</option>
                    </select>
                  </div>

                  {/* Address Info */}
                  <p className="text-xs text-amber-400 font-medium mt-4 pt-3 border-t border-gray-700">Property Address</p>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Street Address *</label>
                    <input
                      type="text"
                      value={moveForm.streetAddress || ''}
                      onChange={e => setMoveForm(prev => ({ ...prev, streetAddress: e.target.value }))}
                      placeholder="123 Main St"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">City *</label>
                      <select
                        value={moveForm.city || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select City</option>
                        <option value="El Paso">El Paso</option>
                        <option value="Horizon">Horizon</option>
                        <option value="Socorro">Socorro</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">State *</label>
                      <select
                        value={moveForm.state || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, state: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select</option>
                        <option value="TX">TX</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">ZIP Code</label>
                      <input
                        type="text"
                        value={moveForm.zipCode || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, zipCode: e.target.value }))}
                        placeholder="79936"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Lot</label>
                      <input
                        type="text"
                        value={moveForm.lot || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, lot: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Block</label>
                      <input
                        type="text"
                        value={moveForm.block || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, block: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Subdivision</label>
                      <input
                        type="text"
                        value={moveForm.subdivision || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, subdivision: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Floor Plan</label>
                      <input
                        type="text"
                        value={moveForm.floorPlan || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, floorPlan: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Buyer Info */}
                  <p className="text-xs text-amber-400 font-medium mt-4 pt-3 border-t border-gray-700">Buyer Information</p>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Agent *</label>
                    <select
                      value={moveForm.agent}
                      onChange={e => setMoveForm(prev => ({ ...prev, agent: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select Agent</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.Name || member.name}>
                          {member.Name || member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Buyer Name *</label>
                    <input
                      type="text"
                      value={moveForm.buyerName}
                      onChange={e => setMoveForm(prev => ({ ...prev, buyerName: e.target.value }))}
                      placeholder="Full name"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Buyer Email *</label>
                      <input
                        type="email"
                        value={moveForm.buyerEmail}
                        onChange={e => setMoveForm(prev => ({ ...prev, buyerEmail: e.target.value }))}
                        placeholder="buyer@email.com"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Buyer Phone *</label>
                      <input
                        type="tel"
                        value={moveForm.buyerPhone}
                        onChange={e => setMoveForm(prev => ({ ...prev, buyerPhone: e.target.value }))}
                        placeholder="(555) 555-5555"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Optional Fields */}
                  <p className="text-xs text-gray-500 font-medium mt-4 pt-3 border-t border-gray-700">Optional Fields</p>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Assisting Agent</label>
                    <select
                      value={moveForm.assistingAgent}
                      onChange={e => setMoveForm(prev => ({ ...prev, assistingAgent: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">None</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.Name || member.name}>
                          {member.Name || member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Loan Type</label>
                      <select
                        value={moveForm.loanType}
                        onChange={e => setMoveForm(prev => ({ ...prev, loanType: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select Type</option>
                        <option value="Conventional">Conventional</option>
                        <option value="FHA">FHA</option>
                        <option value="VA">VA</option>
                        <option value="USDA">USDA</option>
                        <option value="Cash">Cash</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Loan Amount</label>
                      <input
                        type="number"
                        value={moveForm.loanAmount}
                        onChange={e => setMoveForm(prev => ({ ...prev, loanAmount: e.target.value }))}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Scheduled Closing</label>
                      <input
                        type="date"
                        value={moveForm.closedDate}
                        onChange={e => setMoveForm(prev => ({ ...prev, closedDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Sales Price</label>
                      <input
                        type="number"
                        value={moveForm.salesPrice || ''}
                        onChange={e => setMoveForm(prev => ({ ...prev, salesPrice: e.target.value }))}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Notes</label>
                    <textarea
                      value={moveForm.notes}
                      onChange={e => setMoveForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={moveToPending}
                    disabled={!moveForm.streetAddress || !moveForm.buyerName || !moveForm.buyerEmail || !moveForm.buyerPhone || !moveForm.agent || isMovingToPending}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  >
                    {isMovingToPending && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {isMovingToPending ? 'Processing...' : 'Complete Submission & Lock Address'}
                  </button>
                </div>
              </div>
            )}

            {/* Change Status section - only show on Loan Status tab for non-Submitted deals */}
            {pipelineTab === 'pending' && selectedDeal['Loan Status'] !== 'Submitted' && (
              <div className="mt-4 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Change Status</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {LOAN_STATUS_COLUMNS.map(col => {
                    const isCurrentStatus = selectedDeal['Loan Status'] === col.key
                    const colors = colorMap[col.color]
                    return (
                      <button
                        key={col.key}
                        onClick={() => changeStatus(col.key)}
                        disabled={isCurrentStatus || isChangingStatus}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                          isCurrentStatus
                            ? `${colors.header} text-white ring-2 ring-white/50`
                            : isChangingStatus
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : `${colors.bg} ${colors.border} border ${colors.text} hover:opacity-80`
                        }`}
                      >
                        {isChangingStatus && !isCurrentStatus ? '...' : col.shortLabel}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Tap a status to move this deal
                </p>

                {/* Send back to Properties - Admin only */}
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <button
                    onClick={sendBackToProperties}
                    disabled={isSendingBack}
                    className="w-full py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/50 text-orange-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isSendingBack ? 'Sending...' : '↩ Send Back to Properties'}
                  </button>
                  <p className="text-xs text-gray-600 mt-1 text-center">
                    Returns deal to Presale/Properties
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-6 w-full py-3.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white rounded-xl transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

DealDetailModal.propTypes = {
  selectedDeal: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  pipelineTab: PropTypes.string.isRequired,
  moveForm: PropTypes.shape({
    agent: PropTypes.string,
    loanType: PropTypes.string,
    loName: PropTypes.string,
    mortgageCompany: PropTypes.string,
    realtorPartner: PropTypes.string,
    loanStatus: PropTypes.string,
    assistingAgent: PropTypes.string,
    buyerName: PropTypes.string,
    buyerEmail: PropTypes.string,
    buyerPhone: PropTypes.string,
    submittedBy: PropTypes.string,
    agentRole: PropTypes.string,
    streetAddress: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    zipCode: PropTypes.string,
    lot: PropTypes.string,
    block: PropTypes.string,
    floorPlan: PropTypes.string,
    subdivision: PropTypes.string,
    salesPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    closedDate: PropTypes.string,
    loanAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    notes: PropTypes.string
  }),
  setMoveForm: PropTypes.func,
  teamMembers: PropTypes.array,
  moveToPending: PropTypes.func,
  isMovingToPending: PropTypes.bool,
  changeStatus: PropTypes.func,
  isChangingStatus: PropTypes.bool,
  sendBackToProperties: PropTypes.func,
  isSendingBack: PropTypes.bool
}

export default DealDetailModal
