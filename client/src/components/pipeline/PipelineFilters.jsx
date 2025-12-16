import { motion, AnimatePresence } from 'framer-motion'
import { LOAN_STATUS_COLUMNS } from './pipelineConstants'

function PipelineFilters({
  showFilters,
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  hasActiveFilters,
  clearFilters,
  // Unique values for dropdowns
  uniqueAgents,
  uniqueLoanTypes,
  uniqueAssistingAgents,
  uniqueLONames,
  uniqueMortgageCompanies,
  uniqueRealtorPartners
}) {
  const uniqueLoanStatuses = LOAN_STATUS_COLUMNS.map(c => c.key)

  return (
    <AnimatePresence>
      {showFilters && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search address, buyer, agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <select
                value={filters.agent}
                onChange={(e) => setFilters(f => ({ ...f, agent: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Agents</option>
                {uniqueAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>

              <select
                value={filters.loanStatus}
                onChange={(e) => setFilters(f => ({ ...f, loanStatus: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {uniqueLoanStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <select
                value={filters.loanType}
                onChange={(e) => setFilters(f => ({ ...f, loanType: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Loan Types</option>
                {uniqueLoanTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select
                value={filters.executed}
                onChange={(e) => setFilters(f => ({ ...f, executed: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Executed?</option>
                <option value="Yes">Executed</option>
                <option value="No">Not Executed</option>
              </select>

              <select
                value={filters.assistingAgent}
                onChange={(e) => setFilters(f => ({ ...f, assistingAgent: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Assisting Agents</option>
                {uniqueAssistingAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>

              <select
                value={filters.loName}
                onChange={(e) => setFilters(f => ({ ...f, loName: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All LO Names</option>
                {uniqueLONames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                value={filters.mortgageCompany}
                onChange={(e) => setFilters(f => ({ ...f, mortgageCompany: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Mortgage Co.</option>
                {uniqueMortgageCompanies.map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>

              <select
                value={filters.realtorPartner}
                onChange={(e) => setFilters(f => ({ ...f, realtorPartner: e.target.value }))}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Realtor Partners</option>
                {uniqueRealtorPartners.map(partner => (
                  <option key={partner} value={partner}>{partner}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={clearFilters}
                className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                ✕ Clear all filters
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PipelineFilters
