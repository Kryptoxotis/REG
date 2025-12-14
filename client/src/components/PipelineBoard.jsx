import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import axios from 'axios'

const LOAN_STATUS_COLUMNS = [
  { key: 'Loan Application Received', label: 'Application Received', shortLabel: 'App', color: 'slate' },
  { key: 'Disclosures Sent', label: 'Disclosures Sent', shortLabel: 'Disc Sent', color: 'gray' },
  { key: 'Disclosures Signed', label: 'Disclosures Signed', shortLabel: 'Disc Sign', color: 'zinc' },
  { key: 'Loan Documents Collected', label: 'Docs Collected', shortLabel: 'Docs', color: 'blue' },
  { key: 'File in Processing', label: 'In Processing', shortLabel: 'Process', color: 'indigo' },
  { key: 'Appraisal Ordered', label: 'Appraisal Ordered', shortLabel: 'Appr Ord', color: 'violet' },
  { key: 'Appraisal Received', label: 'Appraisal Received', shortLabel: 'Appr Rec', color: 'purple' },
  { key: 'Initial Underwriting (IUW)', label: 'Initial UW', shortLabel: 'IUW', color: 'fuchsia' },
  { key: 'Conditions Requested', label: 'Conditions Req', shortLabel: 'Cond Req', color: 'pink' },
  { key: 'Conditions Submitted', label: 'Conditions Sub', shortLabel: 'Cond Sub', color: 'rose' },
  { key: 'Final Underwriting (FUW)', label: 'Final UW', shortLabel: 'FUW', color: 'orange' },
  { key: 'Clear to Close (CTC)', label: 'Clear to Close', shortLabel: 'CTC', color: 'amber' },
  { key: 'Closing Disclosure (CD) Issued', label: 'CD Issued', shortLabel: 'CD Iss', color: 'yellow' },
  { key: 'Closing Disclosure (CD) Signed', label: 'CD Signed', shortLabel: 'CD Sign', color: 'lime' },
  { key: 'Closing Scheduled', label: 'Closing Sched', shortLabel: 'Sched', color: 'green' },
  { key: 'Closed', label: 'Closed', shortLabel: 'Closed', color: 'emerald' },
  { key: 'Funded', label: 'Funded', shortLabel: 'Funded', color: 'teal' },
  { key: 'Loan Complete / Transfer', label: 'Complete', shortLabel: 'Done', color: 'cyan' },
  { key: 'Back On Market (BOM)', label: 'Back On Market', shortLabel: 'BOM', color: 'red' },
  { key: 'CASH', label: 'Cash Deal', shortLabel: 'CASH', color: 'sky' }
]

// Helper to get address from different database schemas
const getAddress = (deal) => deal.Address || deal['Property Address'] || deal.address || ''

const colorMap = {
  slate: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', header: 'bg-slate-600', dot: 'bg-slate-500' },
  gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', header: 'bg-gray-600', dot: 'bg-gray-500' },
  zinc: { bg: 'bg-zinc-500/20', border: 'border-zinc-500/30', text: 'text-zinc-400', header: 'bg-zinc-600', dot: 'bg-zinc-500' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', header: 'bg-blue-600', dot: 'bg-blue-500' },
  indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', header: 'bg-indigo-600', dot: 'bg-indigo-500' },
  violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', header: 'bg-violet-600', dot: 'bg-violet-500' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', header: 'bg-purple-600', dot: 'bg-purple-500' },
  fuchsia: { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', header: 'bg-fuchsia-600', dot: 'bg-fuchsia-500' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', header: 'bg-pink-600', dot: 'bg-pink-500' },
  rose: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', header: 'bg-rose-600', dot: 'bg-rose-500' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', header: 'bg-orange-600', dot: 'bg-orange-500' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', header: 'bg-amber-600', dot: 'bg-amber-500' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', header: 'bg-yellow-600', dot: 'bg-yellow-500' },
  lime: { bg: 'bg-lime-500/20', border: 'border-lime-500/30', text: 'text-lime-400', header: 'bg-lime-600', dot: 'bg-lime-500' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', header: 'bg-green-600', dot: 'bg-green-500' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', header: 'bg-emerald-600', dot: 'bg-emerald-500' },
  teal: { bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400', header: 'bg-teal-600', dot: 'bg-teal-500' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', header: 'bg-cyan-600', dot: 'bg-cyan-500' },
  sky: { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400', header: 'bg-sky-600', dot: 'bg-sky-500' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', header: 'bg-red-600', dot: 'bg-red-500' }
}

// City to Edwards Co. mapping
const CITY_TO_EDWARDS = {
  'El Paso': "Edward's LLC.",
  'Las Cruces': "Edward's NM.",
  'McAllen': "Edward's RGV",
  'San Antonio': 'San Antonio' // No Edwards mapping yet
}

// Cities for Presale filter
const CITIES = ['El Paso', 'Las Cruces', 'McAllen', 'San Antonio']

// Helper to get close date urgency (for color coding)
const getCloseDateUrgency = (deal) => {
  const closingDate = deal['Scheduled Closing']?.start || deal['Closed Date']?.start
  if (!closingDate) return 'none'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const closeDate = new Date(closingDate)
  closeDate.setHours(0, 0, 0, 0)

  const daysUntilClose = Math.ceil((closeDate - today) / (1000 * 60 * 60 * 24))

  if (daysUntilClose <= 0) return 'overdue' // Red - past or today
  if (daysUntilClose <= 10) return 'soon' // Yellow - within 10 days
  return 'none' // Default
}

function PipelineBoard({ highlightedDealId, onClearHighlight, cityFilter, onClearCity }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [viewMode, setViewMode] = useState('monthly') // 'monthly' or 'all'
  const [pipelineTab, setPipelineTab] = useState('loan-status') // 'presale', 'loan-status', 'closed'
  const [presaleCity, setPresaleCity] = useState('') // City filter for Presale tab
  const [expandedColumns, setExpandedColumns] = useState({}) // For mobile accordion
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    agent: '',
    loanStatus: '',
    loanType: '',
    assistingAgent: '',
    executed: '',
    loName: '',
    mortgageCompany: '',
    brokerName: '',
    realtorPartner: ''
  })
  // Move to Pipeline form state
  const [moveForm, setMoveForm] = useState({ closedDate: '', executeDate: '' })
  const [isMoving, setIsMoving] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)

  // Fetch from correct database based on active tab
  useEffect(() => { fetchDeals() }, [pipelineTab])

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
    setError(null)
    try {
      // Fetch from correct database based on tab
      const dbMap = {
        'presale': 'PROPERTIES',
        'loan-status': 'PIPELINE',
        'closed': 'CLOSED_DEALS'
      }
      const database = dbMap[pipelineTab] || 'PIPELINE'
      const token = localStorage.getItem('authToken')
      const response = await axios.get(`/api/databases/${database}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      // API returns array directly, not { results: [...] }
      setDeals(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data')
    } finally { setLoading(false) }
  }

  // Move property from Properties to Pipeline
  const moveToPipeline = async () => {
    if (!selectedDeal || !moveForm.closedDate) return

    setIsMoving(true)
    try {
      await axios.post('/api/databases/actions', {
        action: 'move-to-pipeline',
        propertyId: selectedDeal.id,
        address: selectedDeal.Address || selectedDeal.address || '',
        closedDate: moveForm.closedDate,
        executeDate: moveForm.executeDate || null,
        salesPrice: selectedDeal['Sales Price'] || selectedDeal.Price || 0,
        agent: selectedDeal.Agent || '',
        buyerName: selectedDeal['Buyer Name'] || ''
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

      // Log the move
      await axios.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Property moved to Pipeline: ${selectedDeal.Address || 'Unknown'}`,
        dealAddress: selectedDeal.Address || 'Unknown',
        newStatus: 'Loan Application Received',
        entityType: 'Deal',
        actionType: 'Moved Stage'
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

      // Close modal and refresh
      setSelectedDeal(null)
      setMoveForm({ closedDate: '', executeDate: '' })
      fetchDeals()
    } catch (err) {
      console.error('Failed to move property:', err.response?.data || err)
      alert(`Failed to move property: ${err.response?.data?.details || err.response?.data?.error || err.message}`)
    } finally {
      setIsMoving(false)
    }
  }

  // Handle drag-drop of deals between columns
  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result

    // Dropped outside or same position
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return
    }

    const newLoanStatus = destination.droppableId
    const deal = deals.find(d => d.id === draggableId)
    if (!deal) return

    // Optimistic update
    setDeals(prev => prev.map(d =>
      d.id === draggableId ? { ...d, 'Loan Status': newLoanStatus } : d
    ))

    const oldLoanStatus = deal['Loan Status'] || source.droppableId

    try {
      // Update Pipeline in Notion
      await axios.post('/api/databases/actions', {
        action: 'update-status',
        dealId: draggableId,
        loanStatus: newLoanStatus
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

      // Log the status change
      await axios.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Deal moved: ${oldLoanStatus} → ${newLoanStatus}`,
        dealAddress: deal.Address || 'Unknown Address',
        oldStatus: oldLoanStatus,
        newStatus: newLoanStatus,
        entityType: 'Deal',
        actionType: 'Moved Stage'
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

      // If moved to Closed, Funded, or Complete - MOVE to Closed Deals (create + delete from Pipeline)
      if (newLoanStatus === 'Closed' || newLoanStatus === 'Funded' || newLoanStatus === 'Loan Complete / Transfer') {
        // Move deal: creates in Closed Deals + archives from Pipeline
        await axios.post('/api/databases/actions', {
          action: 'move-to-closed',
          dealId: draggableId,
          address: deal.Address || '',
          closeDate: deal['Scheduled Closing']?.start || new Date().toISOString().split('T')[0],
          finalSalePrice: deal['Sales Price'] || 0,
          agent: deal.Agent || '',
          buyerName: deal['Buyer Name'] || '',
          commission: deal.Commission || 0
        }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

        // Remove from local state
        setDeals(prev => prev.filter(d => d.id !== draggableId))

        // Log the closed deal
        await axios.post('/api/databases/actions', {
          action: 'log-activity',
          logAction: `Deal closed: ${deal.Address || 'Unknown'} - $${(deal['Sales Price'] || 0).toLocaleString()}`,
          dealAddress: deal.Address || 'Unknown Address',
          oldStatus: oldLoanStatus,
          newStatus: newLoanStatus,
          entityType: 'Deal',
          actionType: 'Closed Deal'
        }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })
      }
    } catch (err) {
      console.error('Failed to update deal:', err)
      // Revert on error
      fetchDeals()
    }
  }

  // Change loan status from modal (mobile-friendly alternative to drag-drop)
  const changeStatus = async (newLoanStatus) => {
    if (!selectedDeal || isChangingStatus) return

    const oldLoanStatus = selectedDeal['Loan Status']
    if (oldLoanStatus === newLoanStatus) return

    setIsChangingStatus(true)

    // Optimistic update
    setDeals(prev => prev.map(d =>
      d.id === selectedDeal.id ? { ...d, 'Loan Status': newLoanStatus } : d
    ))
    setSelectedDeal(prev => ({ ...prev, 'Loan Status': newLoanStatus }))

    try {
      // Update Pipeline in Notion
      await axios.post('/api/databases/actions', {
        action: 'update-status',
        dealId: selectedDeal.id,
        loanStatus: newLoanStatus
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

      // Log the status change
      await axios.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Deal moved: ${oldLoanStatus} → ${newLoanStatus}`,
        dealAddress: selectedDeal.Address || 'Unknown Address',
        oldStatus: oldLoanStatus,
        newStatus: newLoanStatus,
        entityType: 'Deal',
        actionType: 'Moved Stage'
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

      // If moved to Closed, Funded, or Complete - MOVE to Closed Deals
      if (newLoanStatus === 'Closed' || newLoanStatus === 'Funded' || newLoanStatus === 'Loan Complete / Transfer') {
        await axios.post('/api/databases/actions', {
          action: 'move-to-closed',
          dealId: selectedDeal.id,
          address: selectedDeal.Address || '',
          closeDate: selectedDeal['Scheduled Closing']?.start || new Date().toISOString().split('T')[0],
          finalSalePrice: selectedDeal['Sales Price'] || 0,
          agent: selectedDeal.Agent || '',
          buyerName: selectedDeal['Buyer Name'] || '',
          commission: selectedDeal.Commission || 0
        }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })

        // Remove from local state and close modal
        setDeals(prev => prev.filter(d => d.id !== selectedDeal.id))
        setSelectedDeal(null)

        // Log the closed deal
        await axios.post('/api/databases/actions', {
          action: 'log-activity',
          logAction: `Deal closed: ${selectedDeal.Address || 'Unknown'} - $${(selectedDeal['Sales Price'] || 0).toLocaleString()}`,
          dealAddress: selectedDeal.Address || 'Unknown Address',
          oldStatus: oldLoanStatus,
          newStatus: newLoanStatus,
          entityType: 'Deal',
          actionType: 'Closed Deal'
        }, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } })
      }
    } catch (err) {
      console.error('Failed to update deal status:', err)
      fetchDeals()
    } finally {
      setIsChangingStatus(false)
    }
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

  // Get unique values for filter dropdowns
  const uniqueAgents = [...new Set(deals.map(d => d.Agent).filter(Boolean))].sort()
  const uniqueLoanStatuses = LOAN_STATUS_COLUMNS.map(c => c.key)
  const uniqueLoanTypes = [...new Set(deals.map(d => d['Loan Type']).filter(Boolean))].sort()
  const uniqueAssistingAgents = [...new Set(deals.map(d => d['Assisting Agent']).filter(Boolean))].sort()
  const uniqueLONames = [...new Set(deals.map(d => d['LO Name']).filter(Boolean))].sort()
  const uniqueMortgageCompanies = [...new Set(deals.map(d => d['Mortgage Company']).filter(Boolean))].sort()
  const uniqueBrokerNames = [...new Set(deals.map(d => d['Broker Name']).filter(Boolean))].sort()
  const uniqueRealtorPartners = [...new Set(deals.map(d => d['Realtor Partner']).filter(Boolean))].sort()

  // Apply all filters
  const filteredDeals = deals.filter(deal => {
    // Time filter
    if (viewMode === 'monthly' && !isThisMonth(deal)) return false

    // Pipeline tab filter - now each tab fetches from its own database
    // Presale: PROPERTIES db - show all (not executed)
    // Loan Status: PIPELINE db - show only active loan status items (exclude closed)
    // Closed: CLOSED_DEALS db - show all
    if (pipelineTab === 'loan-status') {
      const loanStatus = deal['Loan Status'] || ''
      const isClosed = loanStatus === 'Closed' || loanStatus === 'Funded' || loanStatus === 'Loan Complete / Transfer'
      if (isClosed) return false // Hide closed items from loan-status kanban
    }
    // Presale and Closed tabs show everything from their respective databases

    // Presale city filter (secondary filter within Presale tab)
    if (pipelineTab === 'presale' && presaleCity) {
      const edwardsCo = CITY_TO_EDWARDS[presaleCity]
      const dealOffice = deal.Office || deal['Edwards Co'] || deal['Edwards Co.'] || ''
      if (edwardsCo && dealOffice !== edwardsCo) return false
    }

    // City filter (from Overview navigation)
    if (cityFilter) {
      const edwardsCo = CITY_TO_EDWARDS[cityFilter]
      const dealOffice = deal.Office || deal['Edwards Co'] || deal['Edwards Co.'] || ''
      if (edwardsCo && dealOffice !== edwardsCo) return false
    }

    // Search filter (address, buyer, agent)
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchAddress = getAddress(deal).toLowerCase().includes(search)
      const matchBuyer = (deal['Buyer Name'] || '').toLowerCase().includes(search)
      const matchAgent = (deal.Agent || '').toLowerCase().includes(search)
      if (!matchAddress && !matchBuyer && !matchAgent) return false
    }

    // Agent filter
    if (filters.agent && deal.Agent !== filters.agent) return false

    // Loan status filter
    if (filters.loanStatus && deal['Loan Status'] !== filters.loanStatus) return false

    // Loan type filter
    if (filters.loanType && deal['Loan Type'] !== filters.loanType) return false

    // Assisting agent filter
    if (filters.assistingAgent && deal['Assisting Agent'] !== filters.assistingAgent) return false

    // Executed filter
    if (filters.executed) {
      const isExecuted = deal.Executed ? 'Yes' : 'No'
      if (isExecuted !== filters.executed) return false
    }

    // LO Name filter
    if (filters.loName && deal['LO Name'] !== filters.loName) return false

    // Mortgage Company filter
    if (filters.mortgageCompany && deal['Mortgage Company'] !== filters.mortgageCompany) return false

    // Broker Name filter
    if (filters.brokerName && deal['Broker Name'] !== filters.brokerName) return false

    // Realtor Partner filter
    if (filters.realtorPartner && deal['Realtor Partner'] !== filters.realtorPartner) return false

    return true
  })

  const clearFilters = () => {
    setSearchTerm('')
    setFilters({
      agent: '',
      loanStatus: '',
      loanType: '',
      assistingAgent: '',
      executed: '',
      loName: '',
      mortgageCompany: '',
      brokerName: '',
      realtorPartner: ''
    })
  }

  const hasActiveFilters = searchTerm || cityFilter || Object.values(filters).some(v => v)

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
        <p className="text-red-400">{typeof error === 'object' ? (error?.message || 'An error occurred') : error}</p>
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Pipeline</h2>
            {cityFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full text-sm text-blue-400">
                🏢 {cityFilter}
                {onClearCity && (
                  <button onClick={onClearCity} className="hover:text-white ml-1">✕</button>
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">
            {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
            {viewMode === 'monthly' ? ` in ${currentMonthName}` : ' total'}
            {hasActiveFilters && ' (filtered)'}
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

          {/* Filter Toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3.5 border rounded-xl transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white active:bg-gray-700'
            }`}
          >
            <span className="text-lg">🔍</span>
          </motion.button>

          {/* Refresh */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={fetchDeals}
            className="p-3.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white active:bg-gray-700 min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <span className="text-lg">🔄</span>
          </motion.button>
        </div>
      </div>

      {/* Pipeline Tabs */}
      <div className="flex bg-gray-800/50 rounded-xl p-1.5 border border-gray-700 gap-1">
        <button
          onClick={() => setPipelineTab('presale')}
          className={`flex-1 px-3 sm:px-4 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
            pipelineTab === 'presale'
              ? 'bg-amber-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50 active:bg-gray-700'
          }`}
        >
          <span className="hidden sm:inline">📋 Presale</span>
          <span className="sm:hidden text-base">Presale</span>
          {pipelineTab === 'presale' && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-black/20">
              {deals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setPipelineTab('loan-status')}
          className={`flex-1 px-3 sm:px-4 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
            pipelineTab === 'loan-status'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50 active:bg-gray-700'
          }`}
        >
          <span className="hidden sm:inline">💰 Loan Status</span>
          <span className="sm:hidden text-base">Loan</span>
          {pipelineTab === 'loan-status' && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-black/20">
              {filteredDeals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setPipelineTab('closed')}
          className={`flex-1 px-3 sm:px-4 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
            pipelineTab === 'closed'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50 active:bg-gray-700'
          }`}
        >
          <span className="hidden sm:inline">✅ Closed Deals</span>
          <span className="sm:hidden text-base">Closed</span>
          {pipelineTab === 'closed' && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-black/20">
              {deals.length}
            </span>
          )}
        </button>
      </div>

      {/* Presale City Filter (only shown when Presale tab is active) */}
      <AnimatePresence>
        {pipelineTab === 'presale' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPresaleCity('')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  presaleCity === ''
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
                }`}
              >
                All Cities
              </button>
              {CITIES.map(city => (
                <button
                  key={city}
                  onClick={() => setPresaleCity(city)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    presaleCity === city
                      ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filters */}
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

      {/* Simple Grid View for Presale and Closed tabs */}
      {(pipelineTab === 'presale' || pipelineTab === 'closed') && (
        <>
          {/* Stats bar */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-white">{filteredDeals.length}</span>
              <span className="text-gray-400 ml-2">
                {pipelineTab === 'presale' ? 'Properties' : 'Closed Deals'}
              </span>
            </div>
          </div>

          {/* Grid of properties/deals */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {error || `No ${pipelineTab === 'presale' ? 'properties' : 'closed deals'} found`}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDeals.map(deal => {
                const address = getAddress(deal)
                const buyer = deal['Buyer Name'] || ''
                const price = deal['Sales Price'] || deal['Final Sale Price'] || deal.Price || 0
                const closingDate = deal['Scheduled Closing'] || deal['Close Date']
                const agent = deal.Agent || ''

                return (
                  <div
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-gray-500 transition-colors"
                  >
                    <p className="font-medium text-white truncate">{address || 'No Address'}</p>
                    {buyer && <p className="text-gray-400 text-sm mt-1 truncate">{buyer}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-emerald-400 font-semibold">{formatCurrency(price)}</span>
                      {closingDate && (
                        <span className="text-gray-500 text-xs">{formatDate(closingDate)}</span>
                      )}
                    </div>
                    {agent && (
                      <p className="text-xs text-gray-500 mt-2 truncate">{agent}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Loan Status Tab - Kanban View */}
      {pipelineTab === 'loan-status' && (
        <>
          {/* Mobile Summary Stats */}
          <div className="sm:hidden bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-white">{deals.length}</span>
              <span className="text-gray-400 ml-2">Active Deals</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-emerald-400">
                {(groupedDeals['Closed'] || []).length + (groupedDeals['Funded'] || []).length}
              </span>
              <span className="text-gray-500 text-sm ml-1">Closed/Funded</span>
            </div>
          </div>

          {/* Mobile Accordion View */}
          <div className="sm:hidden space-y-3">
            {/* Expand/Collapse All Button */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const columnsWithDeals = LOAN_STATUS_COLUMNS.filter(col => (groupedDeals[col.key] || []).length > 0)
                  const allExpanded = columnsWithDeals.every(col => expandedColumns[col.key])
                  const newState = {}
                  columnsWithDeals.forEach(col => { newState[col.key] = !allExpanded })
                  setExpandedColumns(newState)
                }}
                className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white active:bg-gray-700 transition-colors"
              >
                {LOAN_STATUS_COLUMNS.filter(col => (groupedDeals[col.key] || []).length > 0).every(col => expandedColumns[col.key])
                  ? '▲ Collapse All'
                  : '▼ Expand All'}
              </button>
            </div>

            {LOAN_STATUS_COLUMNS.map((col) => {
              const colors = colorMap[col.color]
              const columnDeals = groupedDeals[col.key] || []
              const isExpanded = expandedColumns[col.key]

              if (columnDeals.length === 0) return null

              return (
                <div key={col.key} className="rounded-xl overflow-hidden shadow-lg">
                  {/* Accordion Header */}
                  <button
                    onClick={() => toggleColumn(col.key)}
                    className={`${colors.header} w-full px-5 py-4 flex items-center justify-between active:opacity-80 transition-opacity`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white text-base">{col.label}</span>
                      <span className="bg-white/20 px-2.5 py-1 rounded-full text-sm font-medium text-white">
                        {columnDeals.length}
                      </span>
                    </div>
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      className="text-white/80 text-lg"
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
                        <div className="p-4 space-y-3">
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
      <DragDropContext onDragEnd={onDragEnd}>
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

                  {/* Column Body - Droppable */}
                  <Droppable droppableId={col.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${colors.bg} ${colors.border} border border-t-0 rounded-b-xl p-3 min-h-[400px] space-y-3 ${
                          snapshot.isDraggingOver ? 'ring-2 ring-blue-500/50' : ''
                        }`}
                      >
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
                            const urgency = getCloseDateUrgency(deal)

                            // Card background based on close date urgency
                            const cardBg = urgency === 'overdue'
                              ? 'bg-red-900/40 border-red-500/50 hover:border-red-400'
                              : urgency === 'soon'
                                ? 'bg-yellow-900/30 border-yellow-500/50 hover:border-yellow-400'
                                : 'bg-gray-800 border-gray-700 hover:border-gray-500'

                            return (
                              <Draggable key={deal.id} draggableId={deal.id} index={idx}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => setSelectedDeal(deal)}
                                    className={`${cardBg} rounded-xl p-3 border cursor-grab transition-all ${
                                      snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-500 rotate-2' : 'hover:border-gray-500'
                                    }`}
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
                                  </div>
                                )}
                              </Draggable>
                            )
                          })
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </div>
      </DragDropContext>

          {/* Unassigned Deals Warning */}
          {unassigned.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-400 text-sm">
                ⚠️ {unassigned.length} deal{unassigned.length > 1 ? 's' : ''} without Loan Status assigned
              </p>
            </div>
          )}
        </>
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

                {/* Move to Pipeline section - only show on Presale tab */}
                {pipelineTab === 'presale' && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Move to Pipeline</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Closed Date *</label>
                        <input
                          type="date"
                          value={moveForm.closedDate}
                          onChange={e => setMoveForm(prev => ({ ...prev, closedDate: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Execute Date</label>
                        <input
                          type="date"
                          value={moveForm.executeDate}
                          onChange={e => setMoveForm(prev => ({ ...prev, executeDate: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={moveToPipeline}
                        disabled={!moveForm.closedDate || isMoving}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        {isMoving ? 'Moving...' : 'Move to Pipeline'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Change Status section - only show on Loan Status tab */}
                {pipelineTab === 'loan-status' && (
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
                  </div>
                )}

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
          {closingDate && (
            <p className="text-gray-500 text-sm mt-1">{formatDate(closingDate)}</p>
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
}

export default PipelineBoard
