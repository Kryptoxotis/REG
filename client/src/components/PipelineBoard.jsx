import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import api from '../lib/api'
import { useToast } from './Toast'
import { useTeamMembers, useProperties, useClosedDeals } from '../hooks/useApi'
import {
  LOAN_STATUS_COLUMNS,
  colorMap,
  CITY_TO_EDWARDS,
  CITIES,
  getAddress,
  getCloseDateUrgency,
  formatCurrency,
  formatDate
} from './pipeline/pipelineConstants'
import MobileDealCard from './pipeline/MobileDealCard'
import DealDetailModal from './pipeline/DealDetailModal'
import PipelineFilters from './pipeline/PipelineFilters'

function PipelineBoard({ highlightedDealId, onClearHighlight, cityFilter, onClearCity, user, isEmployee }) {
  const toast = useToast()
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [viewMode, setViewMode] = useState('monthly')
  const [layoutMode, setLayoutMode] = useState('row') // 'card' or 'row'
  const [pipelineTab, setPipelineTab] = useState('pending')
  const [expandedColumns, setExpandedColumns] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const employeeName = user?.fullName || user?.name || ''
  const [filters, setFilters] = useState({
    agent: '', loanStatus: '', loanType: '', assistingAgent: '',
    executed: '', loName: '', mortgageCompany: '', brokerName: '', realtorPartner: ''
  })

  const [moveForm, setMoveForm] = useState({
    agent: '', buyerName: '', buyerEmail: '', buyerPhone: '',
    assistingAgent: '', brokerName: '', loName: '', loEmail: '', loPhone: '',
    loanAmount: '', loanType: '', realtorPartner: '', realtorEmail: '', realtorPhone: '',
    notes: '', closedDate: '', executeDate: '',
    // New fields for Submitted and Pending flows
    foreman: '', subdivision: '', agentAssist: '',
    submittedBy: '', agentRole: '', streetAddress: '', city: '', state: '', zipCode: '',
    lot: '', block: '', floorPlan: ''
  })
  const { data: teamMembersData } = useTeamMembers()
  const teamMembers = useMemo(() => {
    const members = Array.isArray(teamMembersData) ? teamMembersData : []
    return members.filter(m => m.Status === 'Active' || m.status === 'Active')
  }, [teamMembersData])
  const [isMoving, setIsMoving] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [isSendingBack, setIsSendingBack] = useState(false)
  const [isMovingToSubmitted, setIsMovingToSubmitted] = useState(false)
  const [isMovingToPending, setIsMovingToPending] = useState(false)

  // Use React Query hooks for cached data
  const { data: propertiesData, isLoading: propertiesLoading, error: propertiesError, refetch: refetchProperties } = useProperties()
  const { data: closedDealsData, isLoading: closedLoading, error: closedError, refetch: refetchClosedDeals } = useClosedDeals()

  // Derive deals from cached data based on active tab
  // Dashboard section mapping: "Submitted" = Notion Status "Pending", "Pending" = Notion Status "Sold"
  const derivedDeals = useMemo(() => {
    if (pipelineTab === 'closed-deals') {
      return Array.isArray(closedDealsData) ? closedDealsData : []
    }
    const rawData = Array.isArray(propertiesData) ? propertiesData : []
    // Filter Submitted tab to show deals with Notion Status = "Pending"
    if (pipelineTab === 'submitted') {
      return rawData.filter(deal => {
        const status = (deal.Status || deal.status || '').toLowerCase().trim()
        return status === 'pending'
      })
    }
    // Filter Pending tab to show deals with Notion Status = "Sold"
    return rawData.filter(deal => {
      const status = (deal.Status || deal.status || '').toLowerCase().trim()
      return status === 'sold'
    })
  }, [pipelineTab, propertiesData, closedDealsData])

  // Local state for optimistic UI updates
  const [deals, setDeals] = useState([])
  useEffect(() => {
    setDeals(derivedDeals)
  }, [derivedDeals])

  const loading = pipelineTab === 'closed-deals' ? closedLoading : propertiesLoading
  const error = pipelineTab === 'closed-deals' ? closedError?.message : propertiesError?.message

  // Refetch function for after mutations
  const fetchDeals = useCallback(() => {
    if (pipelineTab === 'closed-deals') {
      refetchClosedDeals()
    } else {
      refetchProperties()
    }
  }, [pipelineTab, refetchProperties, refetchClosedDeals])

  useEffect(() => {
    if (highlightedDealId && deals.length > 0) {
      const deal = deals.find(d => d.id === highlightedDealId)
      if (deal) {
        setSelectedDeal(deal)
        if (onClearHighlight) onClearHighlight()
      }
    }
  }, [highlightedDealId, deals, onClearHighlight])

  const moveToPipeline = async () => {
    if (!selectedDeal) return
    if (!moveForm.agent) { toast.error('Agent is required'); return }
    if (!moveForm.buyerName) { toast.error('Buyer Name is required'); return }
    if (!moveForm.buyerEmail) { toast.error('Buyer Email is required'); return }
    if (!moveForm.buyerPhone) { toast.error('Buyer Phone is required'); return }

    setIsMoving(true)
    try {
      await api.post('/api/databases/actions', {
        action: 'move-to-pipeline',
        propertyId: selectedDeal.id,
        address: selectedDeal.Address || selectedDeal.address || '',
        salesPrice: selectedDeal['Sales Price'] || selectedDeal.Price || 0,
        edwardsCo: selectedDeal['Edwards Co.'] || selectedDeal['Edwards Co'] || selectedDeal.Office || '',
        agent: moveForm.agent, buyerName: moveForm.buyerName,
        buyerEmail: moveForm.buyerEmail, buyerPhone: moveForm.buyerPhone,
        assistingAgent: moveForm.assistingAgent || null, brokerName: moveForm.brokerName || null,
        loName: moveForm.loName || null, loEmail: moveForm.loEmail || null, loPhone: moveForm.loPhone || null,
        loanAmount: moveForm.loanAmount ? parseFloat(moveForm.loanAmount) : null,
        loanType: moveForm.loanType || null, realtorPartner: moveForm.realtorPartner || null,
        realtorEmail: moveForm.realtorEmail || null, realtorPhone: moveForm.realtorPhone || null,
        notes: moveForm.notes || null, closedDate: moveForm.closedDate || null, executeDate: moveForm.executeDate || null
      })

      await api.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Property moved to Pipeline: ${selectedDeal.Address || 'Unknown'}`,
        dealAddress: selectedDeal.Address || 'Unknown',
        newStatus: 'Loan Application Received', entityType: 'Deal', actionType: 'Moved Stage'
      })

      setSelectedDeal(null)
      setMoveForm({
        agent: '', buyerName: '', buyerEmail: '', buyerPhone: '',
        assistingAgent: '', brokerName: '', loName: '', loEmail: '', loPhone: '',
        loanAmount: '', loanType: '', realtorPartner: '', realtorEmail: '', realtorPhone: '',
        notes: '', closedDate: '', executeDate: ''
      })
      fetchDeals()
    } catch (err) {
      console.error('Failed to move property:', err.response?.data || err)
      toast.error(`Failed to move property: ${err.response?.data?.details || err.response?.data?.error || err.message}`)
    } finally { setIsMoving(false) }
  }

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return

    const newLoanStatus = destination.droppableId
    const deal = deals.find(d => d.id === draggableId)
    if (!deal) return

    setDeals(prev => prev.map(d => d.id === draggableId ? { ...d, 'Loan Status': newLoanStatus } : d))
    const oldLoanStatus = deal['Loan Status'] || source.droppableId

    try {
      await api.post('/api/databases/actions', {
        action: 'update-status', dealId: draggableId, loanStatus: newLoanStatus
      })

      await api.post('/api/databases/actions', {
        action: 'log-activity', logAction: `Deal moved: ${oldLoanStatus} → ${newLoanStatus}`,
        dealAddress: deal.Address || 'Unknown Address', oldStatus: oldLoanStatus, newStatus: newLoanStatus,
        entityType: 'Deal', actionType: 'Moved Stage'
      })

      if (newLoanStatus === 'Closed' || newLoanStatus === 'Funded' || newLoanStatus === 'Loan Complete / Transfer') {
        await api.post('/api/databases/actions', {
          action: 'move-to-closed', dealId: draggableId, address: deal.Address || '',
          closeDate: deal['Scheduled Closing']?.start || new Date().toISOString().split('T')[0],
          finalSalePrice: deal['Sales Price'] || 0, agent: deal.Agent || '',
          buyerName: deal['Buyer Name'] || '', commission: deal.Commission || 0
        })
        setDeals(prev => prev.filter(d => d.id !== draggableId))
      }
    } catch (err) {
      console.error('Failed to update deal:', err)
      fetchDeals()
    }
  }

  const changeStatus = async (newLoanStatus) => {
    if (!selectedDeal || isChangingStatus) return
    const oldLoanStatus = selectedDeal['Loan Status']
    if (oldLoanStatus === newLoanStatus) return

    setIsChangingStatus(true)
    setDeals(prev => prev.map(d => d.id === selectedDeal.id ? { ...d, 'Loan Status': newLoanStatus } : d))
    setSelectedDeal(prev => ({ ...prev, 'Loan Status': newLoanStatus }))

    try {
      await api.post('/api/databases/actions', {
        action: 'update-status', dealId: selectedDeal.id, loanStatus: newLoanStatus
      })

      await api.post('/api/databases/actions', {
        action: 'log-activity', logAction: `Deal moved: ${oldLoanStatus} → ${newLoanStatus}`,
        dealAddress: selectedDeal.Address || 'Unknown Address', oldStatus: oldLoanStatus, newStatus: newLoanStatus,
        entityType: 'Deal', actionType: 'Moved Stage'
      })

      if (newLoanStatus === 'Closed' || newLoanStatus === 'Funded' || newLoanStatus === 'Loan Complete / Transfer') {
        await api.post('/api/databases/actions', {
          action: 'move-to-closed', dealId: selectedDeal.id, address: selectedDeal.Address || '',
          closeDate: selectedDeal['Scheduled Closing']?.start || new Date().toISOString().split('T')[0],
          finalSalePrice: selectedDeal['Sales Price'] || 0, agent: selectedDeal.Agent || '',
          buyerName: selectedDeal['Buyer Name'] || '', commission: selectedDeal.Commission || 0
        })
        setDeals(prev => prev.filter(d => d.id !== selectedDeal.id))
        setSelectedDeal(null)
      }
    } catch (err) {
      console.error('Failed to update deal status:', err)
      fetchDeals()
    } finally { setIsChangingStatus(false) }
  }

  const sendBackToProperties = async () => {
    if (!selectedDeal || isSendingBack) return
    if (!confirm('Are you sure you want to send this deal back to Properties?')) return

    setIsSendingBack(true)
    try {
      // HttpOnly cookies handle auth automatically via withCredentials
      await api.post('/api/databases/actions', {
        action: 'send-back-to-properties', dealId: selectedDeal.id,
        address: selectedDeal.Address || '', salesPrice: selectedDeal['Sales Price'] || 0, status: 'Inventory'
      })

      await api.post('/api/databases/actions', {
        action: 'log-activity', logAction: `Deal sent back to Properties: ${selectedDeal.Address || 'Unknown'}`,
        dealAddress: selectedDeal.Address || 'Unknown Address', entityType: 'Deal', actionType: 'Sent Back to Properties'
      })

      setDeals(prev => prev.filter(d => d.id !== selectedDeal.id))
      setSelectedDeal(null)
    } catch (err) {
      console.error('Failed to send back to properties:', err)
      toast.error('Failed to send back to Properties')
    } finally { setIsSendingBack(false) }
  }

  // Move Property to Submitted (first Pipeline stage, keeps Property linked)
  const moveToSubmitted = async () => {
    if (!selectedDeal || isMovingToSubmitted) return
    if (!moveForm.buyerName) { toast.error('Buyer Name is required'); return }

    setIsMovingToSubmitted(true)
    try {
      const result = await api.post('/api/databases/actions', {
        action: 'move-to-submitted',
        propertyId: selectedDeal.id,
        address: selectedDeal.Address || selectedDeal.address || '',
        salesPrice: selectedDeal['Sales Price'] || selectedDeal.salesPrice || 0,
        foreman: moveForm.foreman,
        subdivision: moveForm.subdivision,
        agentAssist: moveForm.agentAssist,
        buyerName: moveForm.buyerName
      })

      await api.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Property moved to Submitted: ${selectedDeal.Address || 'Unknown'}`,
        dealAddress: selectedDeal.Address || 'Unknown Address',
        entityType: 'Deal',
        actionType: 'Move to Submitted'
      })

      // Reset form and close modal
      setMoveForm(prev => ({
        ...prev, foreman: '', subdivision: '', agentAssist: '', buyerName: ''
      }))
      setSelectedDeal(null)
      fetchDeals()
    } catch (err) {
      console.error('Failed to move to submitted:', err)
      toast.error(err.response?.data?.error || 'Failed to move to Submitted')
    } finally { setIsMovingToSubmitted(false) }
  }

  // Move Submitted deal to Pending (full form, archives Property, locks address)
  const moveToPending = async () => {
    if (!selectedDeal || isMovingToPending) return
    if (!moveForm.agent) { toast.error('Agent is required'); return }
    if (!moveForm.buyerName) { toast.error('Buyer Name is required'); return }
    if (!moveForm.buyerEmail) { toast.error('Buyer Email is required'); return }
    if (!moveForm.buyerPhone) { toast.error('Buyer Phone is required'); return }

    setIsMovingToPending(true)
    try {
      await api.post('/api/databases/actions', {
        action: 'move-to-pending',
        dealId: selectedDeal.id,
        propertyId: selectedDeal['Linked Property']?.[0] || null,
        submittedBy: moveForm.submittedBy || employeeName,
        agentRole: moveForm.agentRole,
        streetAddress: moveForm.streetAddress,
        city: moveForm.city,
        state: moveForm.state,
        zipCode: moveForm.zipCode,
        lot: moveForm.lot,
        block: moveForm.block,
        subdivision: moveForm.subdivision,
        floorPlan: moveForm.floorPlan,
        agent: moveForm.agent,
        buyerName: moveForm.buyerName,
        buyerEmail: moveForm.buyerEmail,
        buyerPhone: moveForm.buyerPhone,
        assistingAgent: moveForm.assistingAgent,
        brokerName: moveForm.brokerName,
        loName: moveForm.loName,
        loEmail: moveForm.loEmail,
        loPhone: moveForm.loPhone,
        loanAmount: moveForm.loanAmount,
        loanType: moveForm.loanType,
        realtorPartner: moveForm.realtorPartner,
        realtorEmail: moveForm.realtorEmail,
        realtorPhone: moveForm.realtorPhone,
        notes: moveForm.notes
      })

      await api.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Deal moved to Pending: ${moveForm.streetAddress || selectedDeal.Address || 'Unknown'}`,
        dealAddress: moveForm.streetAddress || selectedDeal.Address || 'Unknown Address',
        entityType: 'Deal',
        actionType: 'Move to Pending'
      })

      // Reset form and refresh
      setMoveForm({
        agent: '', buyerName: '', buyerEmail: '', buyerPhone: '',
        assistingAgent: '', brokerName: '', loName: '', loEmail: '', loPhone: '',
        loanAmount: '', loanType: '', realtorPartner: '', realtorEmail: '', realtorPhone: '',
        notes: '', closedDate: '', executeDate: '',
        foreman: '', subdivision: '', agentAssist: '',
        submittedBy: '', agentRole: '', streetAddress: '', city: '', state: '', zipCode: '',
        lot: '', block: '', floorPlan: ''
      })
      setSelectedDeal(null)
      fetchDeals()
    } catch (err) {
      console.error('Failed to move to pending:', err)
      toast.error(err.response?.data?.error || 'Failed to move to Pending')
    } finally { setIsMovingToPending(false) }
  }

  // Delete from Submitted (remove pipeline entry without affecting original property)
  const [isDeletingSubmitted, setIsDeletingSubmitted] = useState(false)
  const deleteFromSubmitted = async () => {
    if (!selectedDeal || isDeletingSubmitted) return
    if (!confirm('Are you sure you want to delete this from Submitted? This cannot be undone.')) return

    setIsDeletingSubmitted(true)
    try {
      await api.delete(`/api/databases/properties/${selectedDeal.id}`)

      await api.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Deleted from Submitted: ${getAddress(selectedDeal) || 'Unknown'}`,
        dealAddress: getAddress(selectedDeal) || 'Unknown Address',
        entityType: 'Deal',
        actionType: 'Delete from Submitted'
      })

      setSelectedDeal(null)
      fetchDeals()
    } catch (err) {
      console.error('Failed to delete from submitted:', err)
      toast.error(err.response?.data?.error || 'Failed to delete')
    } finally { setIsDeletingSubmitted(false) }
  }

  // Swap address - update the property link on this submitted deal
  const [isSwappingAddress, setIsSwappingAddress] = useState(false)
  const [showAddressSwap, setShowAddressSwap] = useState(false)
  const [properties, setProperties] = useState([])

  // Update Closed Date on a pending deal
  const [isUpdatingClosedDate, setIsUpdatingClosedDate] = useState(false)
  const updateClosedDate = async (newDate) => {
    if (!selectedDeal || isUpdatingClosedDate) return

    setIsUpdatingClosedDate(true)
    try {
      await api.patch(`/api/databases/properties/${selectedDeal.id}`, {
        'Closed Date': newDate || null
      })

      // Update local state
      setSelectedDeal(prev => ({
        ...prev,
        'Closed Date': newDate ? { start: newDate } : null
      }))

      toast.success(newDate ? 'Closed Date updated' : 'Closed Date cleared')
      fetchDeals()
    } catch (err) {
      console.error('Failed to update closed date:', err)
      toast.error(err.response?.data?.error || 'Failed to update Closed Date')
    } finally { setIsUpdatingClosedDate(false) }
  }

  const fetchProperties = async () => {
    try {
      const response = await api.get('/api/databases/properties')
      const propsData = response.data?.data || response.data || []
      setProperties(Array.isArray(propsData) ? propsData : [])
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    }
  }

  const swapAddress = async (newPropertyId, newAddress) => {
    if (!selectedDeal || isSwappingAddress) return

    setIsSwappingAddress(true)
    try {
      await api.patch(`/api/databases/properties/${selectedDeal.id}`, {
        Address: newAddress,
        propertyId: newPropertyId
      })

      await api.post('/api/databases/actions', {
        action: 'log-activity',
        logAction: `Swapped address to: ${newAddress}`,
        dealAddress: newAddress,
        entityType: 'Deal',
        actionType: 'Swap Address'
      })

      setShowAddressSwap(false)
      setSelectedDeal(null)
      fetchDeals()
    } catch (err) {
      console.error('Failed to swap address:', err)
      toast.error(err.response?.data?.error || 'Failed to swap address')
    } finally { setIsSwappingAddress(false) }
  }

  const isThisMonth = (deal) => {
    const dateFields = [deal['Scheduled Closing'], deal['Closed Date'], deal.Executed]
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    for (const dateObj of dateFields) {
      if (dateObj?.start) {
        const d = new Date(dateObj.start)
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) return true
      }
    }
    return !dateFields.some(d => d?.start)
  }

  const isThisWeek = (deal) => {
    const dateFields = [deal['Scheduled Closing'], deal['Closed Date'], deal.Executed]
    const now = new Date()
    // Get start of current week (Sunday)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    // Get end of current week (Saturday)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    for (const dateObj of dateFields) {
      if (dateObj?.start) {
        const d = new Date(dateObj.start)
        if (d >= startOfWeek && d <= endOfWeek) return true
      }
    }
    // If no dates, include it
    return !dateFields.some(d => d?.start)
  }

  // Memoize unique filter options to prevent recalculation on every render
  const uniqueAgents = useMemo(() => [...new Set(deals.map(d => d.Agent).filter(Boolean))].sort(), [deals])
  const uniqueLoanTypes = useMemo(() => [...new Set(deals.map(d => d['Loan Type']).filter(Boolean))].sort(), [deals])
  const uniqueAssistingAgents = useMemo(() => [...new Set(deals.map(d => d['Assisting Agent']).filter(Boolean))].sort(), [deals])
  const uniqueLONames = useMemo(() => [...new Set(deals.map(d => d['LO Name']).filter(Boolean))].sort(), [deals])
  const uniqueMortgageCompanies = useMemo(() => [...new Set(deals.map(d => d['Mortgage Company']).filter(Boolean))].sort(), [deals])
  const uniqueRealtorPartners = useMemo(() => [...new Set(deals.map(d => d['Realtor Partner']).filter(Boolean))].sort(), [deals])

  // Memoize filtered deals to prevent recalculation on every render
  const filteredDeals = useMemo(() => deals.filter(deal => {
    if (viewMode === 'monthly' && !isThisMonth(deal)) return false
    if (viewMode === 'weekly' && !isThisWeek(deal)) return false
    if (pipelineTab === 'pending') {
      const loanStatus = deal['Loan Status'] || ''
      if (loanStatus === 'Closed' || loanStatus === 'Funded' || loanStatus === 'Loan Complete / Transfer') return false
    }
    if (cityFilter) {
      const edwardsCo = CITY_TO_EDWARDS[cityFilter]
      const dealOffice = deal.Office || deal['Edwards Co'] || deal['Edwards Co.'] || ''
      if (edwardsCo && dealOffice !== edwardsCo) return false
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchAddress = getAddress(deal).toLowerCase().includes(search)
      const matchBuyer = (deal['Buyer Name'] || '').toLowerCase().includes(search)
      const matchAgent = (deal.Agent || '').toLowerCase().includes(search)
      if (!matchAddress && !matchBuyer && !matchAgent) return false
    }
    if (filters.agent && deal.Agent !== filters.agent) return false
    if (filters.loanStatus && deal['Loan Status'] !== filters.loanStatus) return false
    if (filters.loanType && deal['Loan Type'] !== filters.loanType) return false
    if (filters.assistingAgent && deal['Assisting Agent'] !== filters.assistingAgent) return false
    if (filters.executed) {
      const isExecuted = deal.Executed ? 'Yes' : 'No'
      if (isExecuted !== filters.executed) return false
    }
    if (filters.loName && deal['LO Name'] !== filters.loName) return false
    if (filters.mortgageCompany && deal['Mortgage Company'] !== filters.mortgageCompany) return false
    if (filters.brokerName && deal['Broker Name'] !== filters.brokerName) return false
    if (filters.realtorPartner && deal['Realtor Partner'] !== filters.realtorPartner) return false
    if (isEmployee && employeeName && pipelineTab === 'pending') {
      const dealAgent = (deal.Agent || '').toLowerCase()
      const userNameLower = employeeName.toLowerCase()
      if (!dealAgent.includes(userNameLower) && !userNameLower.includes(dealAgent)) return false
    }
    return true
  }), [deals, viewMode, pipelineTab, cityFilter, searchTerm, filters, isEmployee, employeeName])

  const clearFilters = () => {
    setSearchTerm('')
    setFilters({
      agent: '', loanStatus: '', loanType: '', assistingAgent: '',
      executed: '', loName: '', mortgageCompany: '', brokerName: '', realtorPartner: ''
    })
  }

  const hasActiveFilters = searchTerm || cityFilter || Object.values(filters).some(v => v)

  // Memoize grouped deals to prevent recalculation on every render
  const groupedDeals = useMemo(() => LOAN_STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = filteredDeals.filter(deal => (deal['Loan Status'] || '') === col.key)
    return acc
  }, {}), [filteredDeals])

  const unassigned = useMemo(() => filteredDeals.filter(deal => !deal['Loan Status']), [filteredDeals])
  const toggleColumn = (key) => setExpandedColumns(prev => ({ ...prev, [key]: !prev[key] }))

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

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Pipeline</h2>
            {cityFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full text-sm text-blue-400">
                🏢 {cityFilter}
                {onClearCity && <button onClick={onClearCity} className="hover:text-white ml-1">✕</button>}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">
            {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
            {viewMode === 'monthly' ? ` in ${currentMonthName}` : viewMode === 'weekly' ? ' this week' : ' total'}
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
            <button onClick={() => setViewMode('weekly')} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${viewMode === 'weekly' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Weekly</button>
            <button onClick={() => setViewMode('monthly')} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${viewMode === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Monthly</button>
            <button onClick={() => setViewMode('all')} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>All Time</button>
          </div>
          <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
            <button onClick={() => setLayoutMode('card')} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${layoutMode === 'card' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Cards</button>
            <button onClick={() => setLayoutMode('row')} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${layoutMode === 'row' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Rows</button>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowFilters(!showFilters)} aria-label={showFilters ? 'Hide filters' : 'Show filters'} aria-expanded={showFilters} className={`p-3.5 border rounded-xl transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center ${showFilters || hasActiveFilters ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>🔍</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={fetchDeals} aria-label="Refresh pipeline data" className="p-3.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white min-w-[48px] min-h-[48px] flex items-center justify-center">🔄</motion.button>
        </div>
      </div>

      {/* Pipeline Tabs */}
      <div className="flex bg-gray-800/50 rounded-xl p-1.5 border border-gray-700 gap-1">
        <button onClick={() => setPipelineTab('submitted')} className={`flex-1 px-3 sm:px-4 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-all ${pipelineTab === 'submitted' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}>
          <span className="hidden sm:inline">📋 Submitted</span><span className="sm:hidden">Submit</span>
          {pipelineTab === 'submitted' && <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-black/20">{deals.length}</span>}
        </button>
        <button onClick={() => setPipelineTab('pending')} className={`flex-1 px-3 sm:px-4 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-all ${pipelineTab === 'pending' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}>
          <span className="hidden sm:inline">💰 Pending</span><span className="sm:hidden">Pending</span>
          {pipelineTab === 'pending' && <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-black/20">{filteredDeals.length}</span>}
        </button>
        <button onClick={() => setPipelineTab('closed-deals')} className={`flex-1 px-3 sm:px-4 py-3 sm:py-2.5 text-sm font-medium rounded-lg transition-all ${pipelineTab === 'closed-deals' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}>
          <span className="hidden sm:inline">✅ Closed</span><span className="sm:hidden">Closed</span>
          {pipelineTab === 'closed-deals' && <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-black/20">{deals.length}</span>}
        </button>
      </div>


      {/* Filters */}
      <PipelineFilters
        showFilters={showFilters} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        filters={filters} setFilters={setFilters} hasActiveFilters={hasActiveFilters} clearFilters={clearFilters}
        uniqueAgents={uniqueAgents} uniqueLoanTypes={uniqueLoanTypes} uniqueAssistingAgents={uniqueAssistingAgents}
        uniqueLONames={uniqueLONames} uniqueMortgageCompanies={uniqueMortgageCompanies} uniqueRealtorPartners={uniqueRealtorPartners}
      />

      {/* Grid View for Presale and Closed tabs */}
      {(pipelineTab === 'submitted' || pipelineTab === 'closed-deals') && (
        <>
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-white">{filteredDeals.length}</span>
              <span className="text-gray-400 ml-2">{pipelineTab === 'submitted' ? 'Submitted' : 'Closed'}</span>
            </div>
          </div>
          {filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{error || `No ${pipelineTab === 'submitted' ? 'submitted items' : 'closed'} found`}</div>
          ) : layoutMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDeals.map(deal => (
                <div key={deal.id} onClick={() => setSelectedDeal(deal)} className="bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-gray-500 transition-colors">
                  <p className="font-medium text-white truncate">{getAddress(deal) || 'No Address'}</p>
                  {deal['Buyer Name'] && <p className="text-gray-400 text-sm mt-1 truncate">{deal['Buyer Name']}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-emerald-400 font-semibold">{formatCurrency(deal['Sales Price'] || deal['Final Sale Price'] || deal.Price || 0)}</span>
                    {(deal['Scheduled Closing'] || deal['Close Date']) && <span className="text-gray-500 text-xs">{formatDate(deal['Scheduled Closing'] || deal['Close Date'])}</span>}
                  </div>
                  {deal.Agent && <p className="text-xs text-gray-500 mt-2 truncate">{deal.Agent}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-400 uppercase">
                <div className="col-span-4">Address</div>
                <div className="col-span-2">Buyer</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Agent</div>
              </div>
              {filteredDeals.map(deal => (
                <div key={deal.id} onClick={() => setSelectedDeal(deal)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-500 transition-colors grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center">
                  <div className="sm:col-span-4">
                    <p className="font-medium text-white truncate">{getAddress(deal) || 'No Address'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-gray-400 text-sm truncate">{deal['Buyer Name'] || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-emerald-400 font-semibold">{formatCurrency(deal['Sales Price'] || deal['Final Sale Price'] || deal.Price || 0)}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 text-sm">{formatDate(deal['Scheduled Closing'] || deal['Close Date']) || '-'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 text-sm truncate">{deal.Agent || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Loan Status Tab - Kanban/Row View */}
      {pipelineTab === 'pending' && (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Summary */}
          <div className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between mb-4">
            <div><span className="text-2xl font-bold text-white">{deals.length}</span><span className="text-gray-400 ml-2">Active Deals</span></div>
            <div className="flex items-center gap-4">
              <div className="text-right"><span className="text-lg font-semibold text-emerald-400">{(groupedDeals['Closed'] || []).length + (groupedDeals['Funded'] || []).length}</span><span className="text-gray-500 text-sm ml-1">Closed/Funded</span></div>
              <button onClick={() => {
                const columnsWithDeals = LOAN_STATUS_COLUMNS.filter(col => (groupedDeals[col.key] || []).length > 0)
                const allExpanded = columnsWithDeals.every(col => expandedColumns[col.key])
                const newState = {}
                columnsWithDeals.forEach(col => { newState[col.key] = !allExpanded })
                setExpandedColumns(newState)
              }} className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-600 transition-colors">
                {LOAN_STATUS_COLUMNS.filter(col => (groupedDeals[col.key] || []).length > 0).every(col => expandedColumns[col.key]) ? '▲ Collapse All' : '▼ Expand All'}
              </button>
            </div>
          </div>

          {/* Row View with Collapsible Sections */}
          {layoutMode === 'row' && (
            <div className="space-y-3">
              {/* Unassigned Section - shows deals without Loan Status at top for assignment */}
              {unassigned.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-amber-500/50">
                  <button onClick={() => toggleColumn('unassigned')} className="bg-amber-600 w-full px-5 py-3 flex items-center justify-between hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                      <motion.span animate={{ rotate: expandedColumns['unassigned'] ? 180 : 0 }} className="text-white/80">▼</motion.span>
                      <span className="font-semibold text-white">Unassigned</span>
                      <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-sm font-medium text-white">{unassigned.length}</span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedColumns['unassigned'] && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <Droppable droppableId="unassigned">
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`bg-amber-500/10 border-amber-500/30 border-t-0 min-h-[60px] ${snapshot.isDraggingOver ? 'ring-2 ring-amber-500/50 ring-inset' : ''}`}>
                              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-400 uppercase bg-gray-900/30">
                                <div className="col-span-1"></div>
                                <div className="col-span-3">Address</div>
                                <div className="col-span-2">Buyer</div>
                                <div className="col-span-2">Price</div>
                                <div className="col-span-2">Closing Date</div>
                                <div className="col-span-2">Agent</div>
                              </div>
                              <div className="divide-y divide-amber-700/30">
                                {unassigned.map((deal, idx) => {
                                  const urgency = getCloseDateUrgency(deal)
                                  const rowBg = urgency === 'overdue' ? 'bg-red-900/20 hover:bg-red-900/30' : urgency === 'soon' ? 'bg-yellow-900/20 hover:bg-yellow-900/30' : 'hover:bg-amber-700/20'
                                  return (
                                    <Draggable key={deal.id} draggableId={deal.id} index={idx}>
                                      {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.draggableProps} className={`${rowBg} px-4 py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center transition-all ${snapshot.isDragging ? 'shadow-xl ring-2 ring-amber-500 bg-gray-800 rounded-lg z-50' : ''}`}>
                                          <div {...provided.dragHandleProps} className="sm:col-span-1 flex items-center justify-center cursor-grab active:cursor-grabbing">
                                            <span className="text-gray-500 hover:text-gray-300 text-lg">⋮⋮</span>
                                          </div>
                                          <div className="sm:col-span-3 cursor-pointer" onClick={() => setSelectedDeal(deal)}>
                                            <p className="font-medium text-white truncate hover:text-amber-400">{deal.Address || 'No Address'}</p>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <p className="text-gray-400 text-sm truncate">{deal['Buyer Name'] || '-'}</p>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <p className="text-emerald-400 font-medium">{formatCurrency(deal['Sales Price'])}</p>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <p className={`text-sm ${urgency === 'overdue' ? 'text-red-400' : urgency === 'soon' ? 'text-yellow-400' : 'text-gray-400'}`}>{formatDate(deal['Scheduled Closing'])}</p>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <p className="text-gray-400 text-sm truncate">{deal.Agent || '-'}</p>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  )
                                })}
                                {provided.placeholder}
                              </div>
                            </div>
                          )}
                        </Droppable>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {LOAN_STATUS_COLUMNS.map((col) => {
                const colors = colorMap[col.color]
                const columnDeals = groupedDeals[col.key] || []
                return (
                  <div key={col.key} className="rounded-xl overflow-hidden border border-gray-700">
                    <button onClick={() => toggleColumn(col.key)} className={`${colors.header} w-full px-5 py-3 flex items-center justify-between hover:brightness-110 transition-all`}>
                      <div className="flex items-center gap-3">
                        <motion.span animate={{ rotate: expandedColumns[col.key] ? 180 : 0 }} className="text-white/80">▼</motion.span>
                        <span className="font-semibold text-white">{col.label}</span>
                        <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-sm font-medium text-white">{columnDeals.length}</span>
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedColumns[col.key] && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          <Droppable droppableId={col.key}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className={`${colors.bg} ${colors.border} border-t-0 min-h-[60px] ${snapshot.isDraggingOver ? 'ring-2 ring-blue-500/50 ring-inset' : ''}`}>
                                {/* Row Header */}
                                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-400 uppercase bg-gray-900/30">
                                  <div className="col-span-1"></div>
                                  <div className="col-span-3">Address</div>
                                  <div className="col-span-2">Buyer</div>
                                  <div className="col-span-2">Price</div>
                                  <div className="col-span-2">Closing Date</div>
                                  <div className="col-span-2">Agent</div>
                                </div>
                                {/* Draggable Rows */}
                                <div className="divide-y divide-gray-700/50">
                                  {columnDeals.length === 0 && (
                                    <p className="text-center text-gray-500 text-sm py-4">No deals</p>
                                  )}
                                  {columnDeals.map((deal, idx) => {
                                    const urgency = getCloseDateUrgency(deal)
                                    const rowBg = urgency === 'overdue' ? 'bg-red-900/20 hover:bg-red-900/30' : urgency === 'soon' ? 'bg-yellow-900/20 hover:bg-yellow-900/30' : 'hover:bg-gray-700/30'
                                    return (
                                      <Draggable key={deal.id} draggableId={deal.id} index={idx}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} className={`${rowBg} px-4 py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center transition-all ${snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-500 bg-gray-800 rounded-lg z-50' : ''}`}>
                                            {/* Drag Handle */}
                                            <div {...provided.dragHandleProps} className="sm:col-span-1 flex items-center justify-center cursor-grab active:cursor-grabbing">
                                              <span className="text-gray-500 hover:text-gray-300 text-lg">⋮⋮</span>
                                            </div>
                                            {/* Address */}
                                            <div className="sm:col-span-3 cursor-pointer" onClick={() => setSelectedDeal(deal)}>
                                              <p className="font-medium text-white truncate hover:text-blue-400">{deal.Address || 'No Address'}</p>
                                            </div>
                                            {/* Buyer */}
                                            <div className="sm:col-span-2">
                                              <p className="text-gray-400 text-sm truncate">{deal['Buyer Name'] || '-'}</p>
                                            </div>
                                            {/* Price */}
                                            <div className="sm:col-span-2">
                                              <span className="text-emerald-400 font-semibold">{formatCurrency(deal['Sales Price'])}</span>
                                            </div>
                                            {/* Closing Date */}
                                            <div className="sm:col-span-2">
                                              <span className={`text-sm ${urgency === 'overdue' ? 'text-red-400 font-medium' : urgency === 'soon' ? 'text-yellow-400' : 'text-gray-500'}`}>
                                                {deal['Scheduled Closing'] ? formatDate(deal['Scheduled Closing']) : '-'}
                                              </span>
                                            </div>
                                            {/* Agent */}
                                            <div className="sm:col-span-2 flex items-center gap-2">
                                              <span className="text-gray-500 text-sm truncate">{deal.Agent || '-'}</span>
                                              {deal.Executed && <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">Executed</span>}
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    )
                                  })}
                                </div>
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}

          {/* Card/Kanban View */}
          {layoutMode === 'card' && (
            <>
              {/* Mobile Accordion */}
              <div className="sm:hidden space-y-3">
                {/* Unassigned Section for Mobile - only on Submitted tab */}
                {pipelineTab === 'submitted' && unassigned.length > 0 && (
                  <div className="rounded-xl overflow-hidden shadow-lg">
                    <button onClick={() => toggleColumn('unassigned')} className="bg-amber-600 w-full px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white text-base">Unassigned</span>
                        <span className="bg-white/20 px-2.5 py-1 rounded-full text-sm font-medium text-white">{unassigned.length}</span>
                      </div>
                      <motion.span animate={{ rotate: expandedColumns['unassigned'] ? 180 : 0 }} className="text-white/80 text-lg">▼</motion.span>
                    </button>
                    <AnimatePresence>
                      {expandedColumns['unassigned'] && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-amber-500/10 border-amber-500/30 border border-t-0">
                          <div className="p-4 space-y-3">
                            {unassigned.map((deal) => <MobileDealCard key={deal.id} deal={deal} onSelect={setSelectedDeal} formatCurrency={formatCurrency} formatDate={formatDate} />)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {LOAN_STATUS_COLUMNS.map((col) => {
                  const colors = colorMap[col.color]
                  const columnDeals = groupedDeals[col.key] || []
                  return (
                    <div key={col.key} className="rounded-xl overflow-hidden shadow-lg">
                      <button onClick={() => toggleColumn(col.key)} className={`${colors.header} w-full px-5 py-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-white text-base">{col.label}</span>
                          <span className="bg-white/20 px-2.5 py-1 rounded-full text-sm font-medium text-white">{columnDeals.length}</span>
                        </div>
                        <motion.span animate={{ rotate: expandedColumns[col.key] ? 180 : 0 }} className="text-white/80 text-lg">▼</motion.span>
                      </button>
                      <AnimatePresence>
                        {expandedColumns[col.key] && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`${colors.bg} ${colors.border} border border-t-0`}>
                            <div className="p-4 space-y-3">
                              {columnDeals.length === 0 ? (
                                <p className="text-center text-gray-500 text-sm py-4">No deals</p>
                              ) : columnDeals.map((deal) => <MobileDealCard key={deal.id} deal={deal} onSelect={setSelectedDeal} formatCurrency={formatCurrency} formatDate={formatDate} />)}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Kanban */}
              <div className="hidden sm:block overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {/* Unassigned Column for Desktop - only on Submitted tab */}
                  {pipelineTab === 'submitted' && unassigned.length > 0 && (
                    <div className="w-72 flex-shrink-0">
                      <div className="bg-amber-600 rounded-t-xl px-4 py-3 flex items-center justify-between">
                        <span className="font-semibold text-white">Unassigned</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm text-white">{unassigned.length}</span>
                      </div>
                      <Droppable droppableId="unassigned">
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className={`bg-amber-500/10 border-amber-500/30 border border-t-0 rounded-b-xl p-3 min-h-[400px] space-y-3 ${snapshot.isDraggingOver ? 'ring-2 ring-amber-500/50' : ''}`}>
                            {unassigned.map((deal, idx) => {
                              const urgency = getCloseDateUrgency(deal)
                              const cardBg = urgency === 'overdue' ? 'bg-red-900/40 border-red-500/50 hover:border-red-400' : urgency === 'soon' ? 'bg-yellow-900/30 border-yellow-500/50 hover:border-yellow-400' : 'bg-gray-800 border-amber-700/50 hover:border-amber-500'
                              return (
                                <Draggable key={deal.id} draggableId={deal.id} index={idx}>
                                  {(provided, snapshot) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setSelectedDeal(deal)} className={`${cardBg} rounded-xl p-3 border cursor-grab transition-all ${snapshot.isDragging ? 'shadow-xl ring-2 ring-amber-500 rotate-2' : ''}`}>
                                      <p className="font-medium text-white text-sm truncate">{deal.Address || 'No Address'}</p>
                                      {deal['Buyer Name'] && <p className="text-gray-400 text-xs mt-1 truncate">{deal['Buyer Name']}</p>}
                                      <div className="flex items-center justify-between mt-2">
                                        <span className="text-emerald-400 text-sm font-semibold">{formatCurrency(deal['Sales Price'])}</span>
                                        {deal['Scheduled Closing'] && <span className="text-gray-500 text-xs">{formatDate(deal['Scheduled Closing'])}</span>}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              )
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                  {LOAN_STATUS_COLUMNS.map((col) => {
                    const colors = colorMap[col.color]
                    const columnDeals = groupedDeals[col.key] || []
                    return (
                      <div key={col.key} className="w-72 flex-shrink-0">
                        <div className={`${colors.header} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                          <span className="font-semibold text-white">{col.label}</span>
                          <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm text-white">{columnDeals.length}</span>
                        </div>
                        <Droppable droppableId={col.key}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`${colors.bg} ${colors.border} border border-t-0 rounded-b-xl p-3 min-h-[400px] space-y-3 ${snapshot.isDraggingOver ? 'ring-2 ring-blue-500/50' : ''}`}>
                              {columnDeals.length === 0 ? <p className="text-center text-gray-500 text-sm py-8">No deals</p> : columnDeals.map((deal, idx) => {
                                const urgency = getCloseDateUrgency(deal)
                                const cardBg = urgency === 'overdue' ? 'bg-red-900/40 border-red-500/50 hover:border-red-400' : urgency === 'soon' ? 'bg-yellow-900/30 border-yellow-500/50 hover:border-yellow-400' : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                                return (
                                  <Draggable key={deal.id} draggableId={deal.id} index={idx}>
                                    {(provided, snapshot) => (
                                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setSelectedDeal(deal)} className={`${cardBg} rounded-xl p-3 border cursor-grab transition-all ${snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-500 rotate-2' : ''}`}>
                                        <p className="font-medium text-white text-sm truncate">{deal.Address || 'No Address'}</p>
                                        {deal['Buyer Name'] && <p className="text-gray-400 text-xs mt-1 truncate">{deal['Buyer Name']}</p>}
                                        <div className="flex items-center justify-between mt-2">
                                          <span className="text-emerald-400 text-sm font-semibold">{formatCurrency(deal['Sales Price'])}</span>
                                          {deal['Scheduled Closing'] && <span className="text-gray-500 text-xs">{formatDate(deal['Scheduled Closing'])}</span>}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                          {deal.Agent && <span className="text-xs text-gray-500 truncate max-w-[120px]">{deal.Agent}</span>}
                                          {deal.Executed && <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">Executed</span>}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                )
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

        </DragDropContext>
      )}

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <DealDetailModal
          selectedDeal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          pipelineTab={pipelineTab}
          moveForm={moveForm}
          setMoveForm={setMoveForm}
          teamMembers={teamMembers}
          moveToPending={moveToPending}
          isMovingToPending={isMovingToPending}
          changeStatus={changeStatus}
          isChangingStatus={isChangingStatus}
          sendBackToProperties={sendBackToProperties}
          isSendingBack={isSendingBack}
          deleteFromSubmitted={deleteFromSubmitted}
          isDeletingSubmitted={isDeletingSubmitted}
          showAddressSwap={showAddressSwap}
          setShowAddressSwap={setShowAddressSwap}
          properties={properties}
          fetchProperties={fetchProperties}
          swapAddress={swapAddress}
          isSwappingAddress={isSwappingAddress}
          updateClosedDate={updateClosedDate}
          isUpdatingClosedDate={isUpdatingClosedDate}
        />
      )}
    </div>
  )
}

export default PipelineBoard
