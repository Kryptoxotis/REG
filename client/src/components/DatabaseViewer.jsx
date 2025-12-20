import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Users, Building2, TrendingUp, UserCheck, Calendar, X, Filter, ChevronRight, Eye, EyeOff, RefreshCw, AlertCircle, Maximize2, Minimize2, Edit3, Save, XCircle } from 'lucide-react'
import api from '../lib/api'
import { useDatabase } from '../hooks/useApi'
import { useToast } from './Toast'
import { getFieldPreferences } from './FieldSettings'
import { ActivityLogger } from '../utils/activityLogger'

const CITIES = ['El Paso', 'Las Cruces', 'McAllen', 'San Antonio']
const CITY_TO_EDWARDS = {
  'El Paso': "Edward's LLC.",
  'Las Cruces': "Edward's NM.",
  'McAllen': "Edward's RGV",
  'San Antonio': 'San Antonio'
}

const dbConfig = {
  TEAM_MEMBERS: { title: 'Team Members', icon: Users, primaryField: 'Name', secondaryFields: ['Role', 'Phone', 'Email'], statusField: 'Status', mobileLayout: 'card' },
  PROPERTIES: { title: 'Properties', icon: Building2, primaryField: 'Address', secondaryFields: ['Status', 'Floorplan', 'Sales Price'], statusField: 'Status', mobileLayout: 'table', tableColumns: ['Address', 'Status', 'Floorplan', 'Sales Price', 'Subdivision'] },
  PIPELINE: { title: 'Pipeline', icon: TrendingUp, primaryField: 'Deal Name', secondaryFields: ['Stage', 'Value', 'Agent'], statusField: 'Stage', mobileLayout: 'card' },
  CLIENTS: { title: 'Clients', icon: UserCheck, primaryField: 'Name', secondaryFields: ['Email', 'Phone', 'Source'], statusField: 'Status', mobileLayout: 'card' },
  SCHEDULE: { title: 'Schedule', icon: Calendar, primaryField: 'Date', secondaryFields: ['Model Home Address', 'Assigned Staff 1', 'Assigned Staff 2'], statusField: null, mobileLayout: 'list' }
}

function getStatusColor(status) {
  if (!status) return 'bg-gray-700 text-gray-300'
  const s = status.toLowerCase()
  // Property-specific statuses
  if (s === 'available' || s.includes('active')) return 'bg-emerald-500/20 text-emerald-400'
  if (s === 'pending' || s.includes('under contract')) return 'bg-amber-500/20 text-amber-400'
  if (s === 'sold' || s.includes('closed')) return 'bg-red-500/20 text-red-400'
  if (s === 'model home' || s.includes('model')) return 'bg-purple-500/20 text-purple-400'
  // General statuses
  if (s.includes('won') || s.includes('completed')) return 'bg-emerald-500/20 text-emerald-400'
  if (s.includes('negotiation') || s.includes('showing')) return 'bg-amber-500/20 text-amber-400'
  if (s.includes('new') || s.includes('lead') || s.includes('prospect')) return 'bg-blue-500/20 text-blue-400'
  if (s.includes('inactive') || s.includes('lost') || s.includes('terminated')) return 'bg-red-500/20 text-red-400'
  return 'bg-gray-700 text-gray-300'
}

function getStatusBorderColor(status) {
  if (!status) return 'border-gray-700'
  const s = status.toLowerCase()
  if (s === 'available' || s.includes('active')) return 'border-l-emerald-500'
  if (s === 'pending' || s.includes('under contract')) return 'border-l-amber-500'
  if (s === 'sold' || s.includes('closed')) return 'border-l-red-500'
  if (s === 'model home' || s.includes('model')) return 'border-l-purple-500'
  return 'border-l-gray-600'
}

// Check if item was created within the last 3 days
function isNewItem(item) {
  if (!item?.created_time) {
    return false
  }
  const created = new Date(item.created_time)
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const isNew = created >= threeDaysAgo
  return isNew
}

function PropertyCard({ item, config, onClick }) {
  const status = item[config.statusField] || item.Status || item.status || ''
  const primaryValue = item[config.primaryField] || item.Address || 'No Address'
  // Fields to show (from card preferences, excluding primary and status)
  const displayFields = (config.cardFields || config.secondaryFields || []).filter(f => f !== config.primaryField && f !== config.statusField)

  // Get icon for field type
  const getFieldIcon = (fieldName) => {
    const name = fieldName.toLowerCase()
    if (name.includes('subdivision') || name.includes('location') || name.includes('area')) return '📍'
    if (name.includes('floorplan') || name.includes('floor') || name.includes('model')) return '🏠'
    if (name.includes('beds') || name.includes('bedroom')) return '🛏️'
    if (name.includes('baths') || name.includes('bathroom')) return '🚿'
    if (name.includes('sqft') || name.includes('sq ft') || name.includes('size')) return '📐'
    if (name.includes('agent') || name.includes('assigned')) return '👤'
    if (name.includes('buyer') || name.includes('client')) return '🧑'
    if (name.includes('date') || name.includes('closing')) return '📅'
    return null
  }

  // Helper to format values
  const formatValue = (key, value) => {
    if (value === null || value === undefined || value === '') return null
    // Price formatting
    if (key.toLowerCase().includes('price') || key.toLowerCase().includes('value')) {
      const num = Number(value)
      return isNaN(num) ? value : '$' + num.toLocaleString()
    }
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  // Get status-based gradient
  const getStatusGradient = (s) => {
    if (!s) return ''
    const lower = s.toLowerCase()
    if (lower === 'available' || lower.includes('active')) return 'bg-gradient-to-br from-gray-800 to-emerald-900/20'
    if (lower === 'pending' || lower.includes('under contract')) return 'bg-gradient-to-br from-gray-800 to-amber-900/20'
    if (lower === 'sold' || lower.includes('closed')) return 'bg-gradient-to-br from-gray-800 to-red-900/20'
    if (lower === 'model home' || lower.includes('model')) return 'bg-gradient-to-br from-gray-800 to-purple-900/20'
    return 'bg-gray-800'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`${getStatusGradient(status)} rounded-xl border border-gray-700 border-l-4 ${getStatusBorderColor(status)} overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-black/20 transition-all duration-200`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-white truncate flex-1 text-sm sm:text-base flex items-center gap-1">
            {isNewItem(item) && <span className="text-red-500 font-bold text-xl" title="Added in last 3 days">*</span>}
            {primaryValue}
          </h3>
          {status && (
            <span className={`ml-2 px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusColor(status)}`}>
              {status}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {displayFields.map(field => {
            const value = item[field]
            const formatted = formatValue(field, value)
            if (!formatted) return null
            // Price fields get special styling
            const isPrice = field.toLowerCase().includes('price') || field.toLowerCase().includes('value')
            const icon = getFieldIcon(field)
            return (
              <p key={field} className={isPrice ? "text-lg font-bold text-emerald-400 mt-2" : "text-sm text-gray-400 flex items-center gap-1.5"}>
                {!isPrice && icon && <span className="text-gray-500 text-xs">{icon}</span>}
                {!isPrice && !icon && <span className="text-gray-500">{field}:</span>}
                <span className={isPrice ? '' : 'truncate'}>{formatted}</span>
              </p>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

function TeamMemberCard({ item, config, onClick }) {
  const [expanded, setExpanded] = useState(false)
  // Use cardFields from preferences for main grid display (excluding primary which is the title)
  const mainFields = (config.cardFields || config.secondaryFields || []).filter(f => f !== config.primaryField && f !== config.statusField)
  // For expanded: use expandedFields if set, otherwise show all remaining fields not in the main display
  const allFieldKeys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_time' && k !== 'last_edited_time')
  const shownInCard = [config.primaryField, config.statusField, ...mainFields].filter(Boolean)
  const expandedFields = config.expandedFields?.length > 0
    ? config.expandedFields.filter(f => item[f] !== null && item[f] !== '' && item[f] !== undefined)
    : allFieldKeys.filter(k => !shownInCard.includes(k) && item[k] !== null && item[k] !== '' && item[k] !== undefined)
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
      <div className="p-4 cursor-pointer hover:bg-gray-700/50" onClick={onClick}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-white truncate flex-1">{item[config.primaryField] || 'Untitled'}</h3>
          {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
        </div>
        <div className="space-y-1">{mainFields.map(field => item[field] && <p key={field} className="text-sm text-gray-400 truncate"><span className="text-gray-500">{field}:</span> {String(item[field])}</p>)}</div>
      </div>
      {expandedFields.length > 0 && (<>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="w-full px-4 py-2 bg-gray-900 border-t border-gray-700 flex items-center justify-center gap-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}{expanded ? 'Show Less' : `Show ${expandedFields.length} More Fields`}
        </button>
        <AnimatePresence>{expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="px-4 py-3 bg-gray-900 border-t border-gray-700 space-y-2">{expandedFields.map(field => <p key={field} className="text-sm text-gray-400"><span className="text-gray-500 font-medium">{field}:</span> {String(item[field])}</p>)}</div></motion.div>}</AnimatePresence>
      </>)}
    </motion.div>
  )
}

function SmartCardView({ item, config, onClick }) {
  // Use cardFields for display (fallback to secondaryFields)
  const displayFields = (config.cardFields || config.secondaryFields || []).filter(f => f !== config.primaryField && f !== config.statusField)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 p-4 cursor-pointer hover:border-gray-600 transition-colors" onClick={onClick}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white truncate flex-1 flex items-center gap-1">
          {isNewItem(item) && <span className="text-red-500 font-bold text-lg" title="Added in last 3 days">*</span>}
          {item[config.primaryField] || 'Untitled'}
        </h3>
        {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
      </div>
      <div className="space-y-1">{displayFields.map(field => item[field] && <p key={field} className="text-sm text-gray-400 truncate"><span className="text-gray-500">{field}:</span> {String(item[field])}</p>)}</div>
    </motion.div>
  )
}

// Map field names to target databases for clickable relations
const RELATION_FIELD_MAP = {
  'Agent': 'TEAM_MEMBERS',
  'Sales Agent': 'TEAM_MEMBERS',
  'Listing Agent': 'TEAM_MEMBERS',
  'Assigned Staff 1': 'TEAM_MEMBERS',
  'Assigned Staff 2': 'TEAM_MEMBERS',
  'Property': 'PROPERTIES',
  'Property Address': 'PROPERTIES',
  'Address': 'PROPERTIES', // Only when in Pipeline or Clients
  'Client': 'CLIENTS',
  'Buyer': 'CLIENTS',
  'Buyer Name': 'CLIENTS',
  'Deal': 'PIPELINE',
  'Deal Name': 'PIPELINE'
}

// Fields that should NOT be clickable even if they match the map
const EXCLUDED_RELATIONS = {
  'PROPERTIES': ['Address'], // Address in Properties is the primary field, not a relation
  'TEAM_MEMBERS': ['Name']   // Name in Team Members is the primary field
}

export default function DatabaseViewer({ databaseKey, highlightedId, onClearHighlight, onNavigate, searchTerm = '', onClearSearch }) {
  const baseConfig = dbConfig[databaseKey] || dbConfig.TEAM_MEMBERS
  const Icon = baseConfig.icon
  const toast = useToast()

  // Use React Query for data fetching (cached, auto-refresh)
  const { data: queryData, isLoading, error, refetch } = useDatabase(databaseKey)
  const data = queryData || []

  const [selectedItem, setSelectedItem] = useState(null)
  const [showTerminated, setShowTerminated] = useState(false)
  const [cityFilter, setCityFilter] = useState('')
  const [prefVersion, setPrefVersion] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  // Additional filters for Properties
  const [statusFilter, setStatusFilter] = useState('')
  const [subdivisionFilter, setSubdivisionFilter] = useState('')
  const [bedsFilter, setBedsFilter] = useState('')
  const [bathsFilter, setBathsFilter] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  // Additional filters for Clients
  const [sourceFilter, setSourceFilter] = useState('')
  const [clientStatusFilter, setClientStatusFilter] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedFields, setEditedFields] = useState({})
  const [saving, setSaving] = useState(false)
  // Move to Submitted state (for Properties)
  const [showMoveToSubmitted, setShowMoveToSubmitted] = useState(false)
  const [layoutMode, setLayoutMode] = useState('card') // 'card' or 'row'
  const [moveToSubmittedForm, setMoveToSubmittedForm] = useState({ foreman: '', subdivision: '', agentAssist: '', buyerName: '' })
  const [isMovingToSubmitted, setIsMovingToSubmitted] = useState(false)
  const [teamMembers, setTeamMembers] = useState([])

  // Fetch team members for agent dropdown (for Properties move to submitted)
  useEffect(() => {
    if (databaseKey === 'PROPERTIES') {
      api.get('/api/databases/TEAM_MEMBERS')
        .then(res => {
          const members = Array.isArray(res.data) ? res.data : []
          setTeamMembers(members.filter(m => m.Status === 'Active' || m.status === 'Active'))
        })
        .catch(err => console.error('Failed to fetch team members:', err))
    }
  }, [databaseKey])

  // Database key to API path mapping
  const DB_KEY_TO_API = {
    'TEAM_MEMBERS': 'team-members',
    'PROPERTIES': 'properties',
    'PIPELINE': 'pipeline',
    'CLIENTS': 'clients',
    'SCHEDULE': 'schedule'
  }

  // Handle starting edit mode
  const handleStartEdit = () => {
    setEditedFields({ ...selectedItem })
    setIsEditing(true)
  }

  // Handle field change in edit mode
  const handleFieldChange = (key, value) => {
    setEditedFields(prev => ({ ...prev, [key]: value }))
  }

  // Handle save
  const handleSave = async () => {
    setSaving(true)
    try {
      const apiPath = DB_KEY_TO_API[databaseKey] || databaseKey.toLowerCase()
      // Only send changed fields (exclude id, created_time, last_edited_time)
      const updates = {}
      Object.entries(editedFields).forEach(([key, value]) => {
        if (!['id', 'created_time', 'last_edited_time'].includes(key)) {
          updates[key] = value
        }
      })
      // HttpOnly cookies handle auth automatically via withCredentials
      await api.patch(`/api/databases/${apiPath}/${selectedItem.id}`, updates)

      // Log each field edit
      const entityType = baseConfig.title.replace(/s$/, '') // "Properties" -> "Property"
      const entityTitle = selectedItem[config.primaryField] || selectedItem.Name || selectedItem.Address || 'Untitled'
      Object.entries(updates).forEach(([fieldName, newValue]) => {
        const oldValue = selectedItem[fieldName]
        if (oldValue !== newValue) {
          ActivityLogger.editRecord(entityType, entityTitle, fieldName, oldValue, newValue)
        }
      })

      // Update selected item and refetch data
      setSelectedItem(prev => ({ ...prev, ...editedFields }))
      setIsEditing(false)
      refetch() // Refresh from server
      toast.success('Changes saved successfully')
    } catch (err) {
      toast.error('Failed to save: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedFields({})
  }

  // Reset state when closing modal
  const handleCloseModal = () => {
    setSelectedItem(null)
    setIsExpanded(false)
    setIsEditing(false)
    setEditedFields({})
    setShowMoveToSubmitted(false)
    setMoveToSubmittedForm({ foreman: '', subdivision: '', agentAssist: '', buyerName: '' })
  }

  // Handle Move to Submitted (Properties only)
  const handleMoveToSubmitted = async () => {
    if (!selectedItem || isMovingToSubmitted) return
    if (!moveToSubmittedForm.buyerName) {
      toast.error('Buyer Name is required')
      return
    }
    setIsMovingToSubmitted(true)
    try {
      await api.post('/api/databases/actions', {
        action: 'move-to-submitted',
        propertyId: selectedItem.id,
        address: selectedItem.Address || selectedItem.address || '',
        salesPrice: selectedItem['Sales Price'] || selectedItem.salesPrice || 0,
        foreman: moveToSubmittedForm.foreman,
        subdivision: moveToSubmittedForm.subdivision || selectedItem.Subdivision || '',
        agentAssist: moveToSubmittedForm.agentAssist,
        buyerName: moveToSubmittedForm.buyerName
      })
      // Log activity
      ActivityLogger.log('Move to Submitted', selectedItem.Address || 'Unknown', 'Property', 'Properties', 'Submitted')
      toast.success('Property moved to Submitted!')
      handleCloseModal()
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to move to Submitted')
    } finally {
      setIsMovingToSubmitted(false)
    }
  }

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast.error(`Failed to load ${baseConfig.title}: ${error.message}`)
    }
  }, [error, baseConfig.title])

  // Listen for field preferences changes
  useEffect(() => {
    const handlePrefsChange = () => {
      setPrefVersion(v => v + 1)
      // Reset all filters when preferences change to ensure removed filters don't persist
      setStatusFilter('')
      setSubdivisionFilter('')
      setBedsFilter('')
      setBathsFilter('')
      setPriceMin('')
      setPriceMax('')
      setSourceFilter('')
      setClientStatusFilter('')
    }
    window.addEventListener('fieldPreferencesChanged', handlePrefsChange)
    return () => window.removeEventListener('fieldPreferencesChanged', handlePrefsChange)
  }, [])

  // Auto-select item when highlightedId changes
  useEffect(() => {
    if (highlightedId && data.length > 0) {
      const item = data.find(d => d.id === highlightedId)
      if (item) {
        setSelectedItem(item)
        if (onClearHighlight) onClearHighlight()
      }
    }
  }, [highlightedId, data, onClearHighlight])

  // Log record view when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      const entityType = baseConfig.title.replace(/s$/, '') // "Properties" -> "Property"
      const entityTitle = selectedItem[config.primaryField] || selectedItem.Name || selectedItem.Address || 'Untitled'
      ActivityLogger.viewRecord(entityType, entityTitle)
    }
  }, [selectedItem?.id]) // Only trigger when item ID changes

  // Check if a field should be rendered as a clickable relation
  const isClickableRelation = (fieldName) => {
    if (!onNavigate) return false
    const excluded = EXCLUDED_RELATIONS[databaseKey] || []
    if (excluded.includes(fieldName)) return false
    return !!RELATION_FIELD_MAP[fieldName]
  }

  // Handle clicking on a relation field
  const handleRelationClick = (fieldName, value) => {
    if (!onNavigate || !value) return
    const targetDb = RELATION_FIELD_MAP[fieldName]
    if (targetDb) {
      // Navigate to the target database - search will happen there
      // For now, just navigate to the database (user can search/find)
      setSelectedItem(null)
      onNavigate(targetDb, null, String(value))
    }
  }

  // Get field preferences from localStorage (refreshes when prefVersion changes)
  const fieldPrefs = useMemo(() => getFieldPreferences(databaseKey), [databaseKey, prefVersion])

  // Merge preferences with base config
  const config = useMemo(() => {
    const listFields = fieldPrefs.list?.length > 0 ? fieldPrefs.list : [baseConfig.primaryField, ...baseConfig.secondaryFields]
    const primaryField = listFields[0] || baseConfig.primaryField
    const secondaryFields = listFields.slice(1)

    return {
      ...baseConfig,
      primaryField,
      secondaryFields,
      tableColumns: listFields,
      cardFields: fieldPrefs.card?.length > 0 ? fieldPrefs.card : [baseConfig.primaryField, ...baseConfig.secondaryFields, baseConfig.statusField].filter(Boolean),
      expandedFields: fieldPrefs.expanded || []
    }
  }, [baseConfig, fieldPrefs, databaseKey])

  // Note: Data fetching is now handled by useDatabase hook (React Query)
  // This provides automatic caching, refetching, and error handling

  const safeData = data || []
  const terminatedCount = useMemo(() => { if (databaseKey !== 'TEAM_MEMBERS') return 0; return safeData.filter(item => { const status = item[config.statusField]; return status && status.toLowerCase().includes('terminated') }).length }, [safeData, databaseKey, config.statusField])

  // Extract unique filter options for Properties and Clients
  const filterOptions = useMemo(() => {
    if (databaseKey === 'PROPERTIES') {
      const statuses = [...new Set(safeData.map(i => i.Status).filter(Boolean))].sort()
      const subdivisions = [...new Set(safeData.map(i => i.Subdivision).filter(Boolean))].sort()
      const beds = [...new Set(safeData.map(i => i.Beds || i.Bedrooms || i.beds).filter(v => v !== null && v !== undefined))].sort((a, b) => Number(a) - Number(b))
      const baths = [...new Set(safeData.map(i => i.Baths || i.Bathrooms || i.baths).filter(v => v !== null && v !== undefined))].sort((a, b) => Number(a) - Number(b))
      return { statuses, subdivisions, beds, baths }
    }
    if (databaseKey === 'CLIENTS') {
      const sources = [...new Set(safeData.map(i => i.Source).filter(Boolean))].sort()
      const statuses = [...new Set(safeData.map(i => i.Status).filter(Boolean))].sort()
      return { sources, statuses }
    }
    return {}
  }, [safeData, databaseKey])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    if (databaseKey === 'PROPERTIES') {
      let count = 0
      if (statusFilter) count++
      if (subdivisionFilter) count++
      if (bedsFilter) count++
      if (bathsFilter) count++
      if (priceMin) count++
      if (priceMax) count++
      return count
    }
    if (databaseKey === 'CLIENTS') {
      let count = 0
      if (sourceFilter) count++
      if (clientStatusFilter) count++
      return count
    }
    return 0
  }, [databaseKey, statusFilter, subdivisionFilter, bedsFilter, bathsFilter, priceMin, priceMax, sourceFilter, clientStatusFilter])

  // Clear all filters
  const clearAllFilters = () => {
    setCityFilter('')
    setStatusFilter('')
    setSubdivisionFilter('')
    setBedsFilter('')
    setBathsFilter('')
    setPriceMin('')
    setPriceMax('')
    setSourceFilter('')
    setClientStatusFilter('')
  }

  const filteredData = useMemo(() => {
    let result = safeData
    // Filter terminated for TEAM_MEMBERS
    if (databaseKey === 'TEAM_MEMBERS' && !showTerminated) {
      result = result.filter(item => { const status = item[config.statusField]; return !status || !status.toLowerCase().includes('terminated') })
    }
    // Filter by city for PROPERTIES (uses Edwards Co mapping)
    if (databaseKey === 'PROPERTIES' && cityFilter) {
      const edwardsCo = CITY_TO_EDWARDS[cityFilter]
      result = result.filter(item => {
        const itemEdwards = item['Edwards Co'] || item['Edwards Co.'] || item.Office || ''
        return itemEdwards === edwardsCo
      })
    }
    // Additional filters for PROPERTIES
    if (databaseKey === 'PROPERTIES') {
      if (statusFilter) {
        result = result.filter(item => item.Status === statusFilter)
      }
      if (subdivisionFilter) {
        result = result.filter(item => item.Subdivision === subdivisionFilter)
      }
      if (bedsFilter) {
        result = result.filter(item => {
          const beds = item.Beds || item.Bedrooms || item.beds
          return beds !== null && beds !== undefined && String(beds) === String(bedsFilter)
        })
      }
      if (bathsFilter) {
        result = result.filter(item => {
          const baths = item.Baths || item.Bathrooms || item.baths
          return baths !== null && baths !== undefined && String(baths) === String(bathsFilter)
        })
      }
      if (priceMin) {
        const min = parseFloat(priceMin)
        result = result.filter(item => {
          const price = item['Sales Price'] || item['Sale Price'] || item.Price || 0
          return price >= min
        })
      }
      if (priceMax) {
        const max = parseFloat(priceMax)
        result = result.filter(item => {
          const price = item['Sales Price'] || item['Sale Price'] || item.Price || 0
          return price <= max
        })
      }
    }
    // Additional filters for CLIENTS
    if (databaseKey === 'CLIENTS') {
      if (sourceFilter) {
        result = result.filter(item => item.Source === sourceFilter)
      }
      if (clientStatusFilter) {
        result = result.filter(item => item.Status === clientStatusFilter)
      }
    }
    // Filter by search term (searches all string fields)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(item => {
        return Object.values(item).some(value => {
          if (typeof value === 'string') {
            return value.toLowerCase().includes(term)
          }
          return false
        })
      })
    }

    // Sort Properties by created date, most recent first
    if (databaseKey === 'PROPERTIES') {
      result = [...result].sort((a, b) => {
        const dateA = a.created_time ? new Date(a.created_time) : new Date(0)
        const dateB = b.created_time ? new Date(b.created_time) : new Date(0)
        return dateB - dateA // Most recent first
      })
    }

    return result
  }, [safeData, databaseKey, showTerminated, cityFilter, statusFilter, subdivisionFilter, bedsFilter, bathsFilter, priceMin, priceMax, sourceFilter, clientStatusFilter, config.statusField, searchTerm])

  const formatPrice = (value) => {
    if (!value) return '-'
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num)) return String(value)
    return '$' + num.toLocaleString()
  }

  const renderTableView = () => {
    const columns = config.tableColumns || [config.primaryField, ...config.secondaryFields]
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-700 shadow-lg">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-900/40 to-purple-900/40">
              {columns.map((col, idx) => (
                <th
                  key={col}
                  className={`px-5 py-4 text-left text-xs font-semibold text-violet-200 uppercase tracking-wider ${idx === 0 ? 'rounded-tl-xl' : ''} ${idx === columns.length - 1 ? 'rounded-tr-xl' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filteredData.map((item, idx) => (
              <motion.tr
                key={item.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`${idx % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/30'} hover:bg-violet-900/20 cursor-pointer transition-all group border-l-2 border-transparent hover:border-violet-500`}
                onClick={() => setSelectedItem(item)}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col}
                    className={`px-5 py-4 text-sm ${colIdx === 0 ? 'font-medium text-white' : 'text-gray-300'}`}
                  >
                    <span className="flex items-center gap-1">
                      {colIdx === 0 && isNewItem(item) && <span className="text-red-500 font-bold text-lg" title="Added in last 3 days">*</span>}
                      {col === config.statusField && item[col] ? (
                        <span className={"inline-flex px-3 py-1 text-xs font-medium rounded-full shadow-sm " + getStatusColor(item[col])}>
                          {item[col]}
                        </span>
                      ) : (col.toLowerCase().includes('price') || col === 'Sales Price') ? (
                        <span className="text-emerald-400 font-semibold">{formatPrice(item[col])}</span>
                      ) : (col === 'Floorplan' || col === 'Floor Plan') ? (
                        <span className="text-blue-400 font-medium">{String(item[col] || '-')}</span>
                      ) : col === 'Subdivision' ? (
                        <span className="text-purple-400">{String(item[col] || '-')}</span>
                      ) : (
                        <span className="group-hover:text-white transition-colors">{String(item[col] || '-')}</span>
                      )}
                    </span>
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderListView = () => (<div className="space-y-2">{filteredData.map((item, idx) => <motion.div key={item.id || idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 p-3 cursor-pointer hover:bg-gray-700 transition-colors" onClick={() => setSelectedItem(item)}><div className="flex items-center justify-between"><div className="flex-1 min-w-0"><p className="font-medium text-white truncate">{item[config.primaryField] || 'Untitled'}</p><p className="text-sm text-gray-400 truncate">{config.secondaryFields.map(f => item[f]).filter(Boolean).join(' · ')}</p></div><ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" /></div></motion.div>)}</div>)

  const renderCardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredData.map((item, idx) => {
        if (databaseKey === 'TEAM_MEMBERS') {
          return <TeamMemberCard key={item.id || idx} item={item} config={config} onClick={() => setSelectedItem(item)} />
        }
        if (databaseKey === 'PROPERTIES') {
          return <PropertyCard key={item.id || idx} item={item} config={config} onClick={() => setSelectedItem(item)} />
        }
        return <SmartCardView key={item.id || idx} item={item} config={config} onClick={() => setSelectedItem(item)} />
      })}
    </div>
  )

  const renderContent = () => {
    // Use layoutMode toggle - user choice overrides default mobileLayout
    if (layoutMode === 'row') {
      return renderTableView()
    }
    // Card mode - always show cards regardless of mobileLayout config
    return renderCardView()
  }

  if (isLoading) return (<div className="bg-gray-800 rounded-2xl border border-gray-700 p-6"><div className="animate-pulse space-y-4"><div className="h-6 bg-gray-700 rounded w-1/4"></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-700 rounded-xl"></div>)}</div></div></div>)

  if (error) return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Failed to load {baseConfig.title}</h3>
        <p className="text-gray-400 mb-4 max-w-md">{error.message || 'An error occurred while fetching data'}</p>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-xl"><Icon className="w-5 h-5 text-violet-400" /></div>
          <div><h2 className="font-semibold text-white">{config.title}</h2><p className="text-sm text-gray-400">{filteredData.length} records{databaseKey === 'PROPERTIES' && <span className="text-red-400 ml-1">({filteredData.filter(isNewItem).length} new*)</span>}</p></div>
          {searchTerm && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-violet-300 rounded-xl text-sm">
              <span>Searching: "{searchTerm}"</span>
              {onClearSearch && (
                <button onClick={onClearSearch} className="hover:text-white transition-colors"><X className="w-4 h-4" /></button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Card/Row toggle for all databases */}
          <div className="flex bg-gray-700 rounded-lg p-0.5 border border-gray-600">
            <button onClick={() => setLayoutMode('card')} className={`px-3 py-1.5 text-sm rounded-md transition-all ${layoutMode === 'card' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>Cards</button>
            <button onClick={() => setLayoutMode('row')} className={`px-3 py-1.5 text-sm rounded-md transition-all ${layoutMode === 'row' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>Rows</button>
          </div>
          {databaseKey === 'PROPERTIES' && (
            <>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-gray-700 text-gray-200 px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Cities</option>
                {CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-violet-500/20 text-violet-300' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                <Filter className="w-4 h-4" />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl text-sm font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </>
          )}
          {databaseKey === 'CLIENTS' && (
            <>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-violet-500/20 text-violet-300' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                <Filter className="w-4 h-4" />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl text-sm font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </>
          )}
          {databaseKey === 'TEAM_MEMBERS' && terminatedCount > 0 && <button onClick={() => setShowTerminated(!showTerminated)} className={(showTerminated ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600') + " flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"}>{showTerminated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{showTerminated ? 'Hide' : 'Show'} Terminated ({terminatedCount})</button>}
        </div>
      </div>

      {/* Clients Filter Panel - filters based on fieldPrefs.filters configuration */}
      {databaseKey === 'CLIENTS' && showFilters && (
        <div className="px-4 pb-4 pt-2 border-b border-gray-700 bg-gray-800/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fieldPrefs.filters?.includes('Source') && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">All Sources</option>
                  {filterOptions.sources?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {fieldPrefs.filters?.includes('Status') && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <select
                  value={clientStatusFilter}
                  onChange={(e) => setClientStatusFilter(e.target.value)}
                  className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">All Statuses</option>
                  {filterOptions.statuses?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Properties Filter Panel - filters based on fieldPrefs.filters configuration */}
      {databaseKey === 'PROPERTIES' && showFilters && (
        <div className="px-4 pb-4 pt-2 border-b border-gray-700 bg-gray-800/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {fieldPrefs.filters?.includes('Status') && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">All Statuses</option>
                  {filterOptions.statuses?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {fieldPrefs.filters?.includes('Subdivision') && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Subdivision</label>
                <select
                  value={subdivisionFilter}
                  onChange={(e) => setSubdivisionFilter(e.target.value)}
                  className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">All Subdivisions</option>
                  {filterOptions.subdivisions?.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            {fieldPrefs.filters?.includes('Beds') && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Beds</label>
                <select
                  value={bedsFilter}
                  onChange={(e) => setBedsFilter(e.target.value)}
                  className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Any</option>
                  {filterOptions.beds?.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}
            {fieldPrefs.filters?.includes('Baths') && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Baths</label>
                <select
                  value={bathsFilter}
                  onChange={(e) => setBathsFilter(e.target.value)}
                  className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Any</option>
                  {filterOptions.baths?.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}
            {fieldPrefs.filters?.includes('Sales Price') && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Min Price</label>
                  <input
                    type="number"
                    placeholder="$0"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Price</label>
                  <input
                    type="number"
                    placeholder="No Max"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="p-4">{filteredData.length === 0 ? <div className="text-center py-8 text-gray-500"><Icon className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p>No records found{activeFilterCount > 0 ? ' - try adjusting filters' : ''}</p></div> : renderContent()}</div>
      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={handleCloseModal}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-gray-900 rounded-2xl border border-gray-700 w-full max-h-[90vh] overflow-hidden flex flex-col transition-all ${isExpanded ? 'max-w-4xl' : 'max-w-lg'}`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
                <h3 className="font-semibold text-lg text-white truncate flex-1">{selectedItem[config.primaryField] || 'Details'}</h3>
                <div className="flex items-center gap-2 ml-4">
                  {isExpanded && !isEditing && (
                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                  >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                  <button onClick={handleCloseModal} className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Editing Mode Actions */}
              {isEditing && (
                <div className="flex items-center gap-2 mx-4 mt-4 p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                  <span className="text-violet-300 text-sm flex-1">Editing mode - make changes and save</span>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="p-4 overflow-y-auto flex-1">
                {isExpanded ? (
                  /* Expanded View - Fields based on preferences or all fields */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(isEditing ? editedFields : selectedItem)
                      .filter(([key]) => {
                        if (['id', 'created_time', 'last_edited_time'].includes(key)) return false
                        // If expandedFields has entries, only show those; otherwise show all
                        if (config.expandedFields?.length > 0) {
                          return config.expandedFields.includes(key)
                        }
                        return true
                      })
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <div key={key} className="flex flex-col p-3 bg-gray-800 rounded-lg">
                          <span className="text-gray-400 text-xs uppercase tracking-wide mb-1">{key}</span>
                          {isEditing ? (
                            typeof value === 'boolean' ? (
                              <select
                                value={value ? 'true' : 'false'}
                                onChange={(e) => handleFieldChange(key, e.target.value === 'true')}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-violet-500"
                              >
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : Array.isArray(value) ? (
                              <input
                                type="text"
                                value={value.join(', ')}
                                onChange={(e) => handleFieldChange(key, e.target.value.split(',').map(s => s.trim()))}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-violet-500"
                              />
                            ) : (
                              <input
                                type="text"
                                value={value ?? ''}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-violet-500"
                              />
                            )
                          ) : (
                            key === config.statusField && value ? (
                              <span className={"inline-block px-2 py-1 text-xs font-medium rounded-full w-fit " + getStatusColor(value)}>{String(value)}</span>
                            ) : isClickableRelation(key) && value ? (
                              <button
                                onClick={() => handleRelationClick(key, value)}
                                className="text-violet-400 hover:text-violet-300 underline decoration-dotted underline-offset-2 transition-colors text-left text-sm"
                              >
                                {String(value)} →
                              </button>
                            ) : (
                              <span className="text-gray-200 text-sm">
                                {value === null || value === undefined || value === '' ? '-' :
                                  Array.isArray(value) ? value.join(', ') :
                                  typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                                  String(value)}
                              </span>
                            )
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  /* Collapsed View - Show fields from cardFields preference */
                  <div className="space-y-3">
                    {Object.entries(selectedItem)
                      .filter(([key, value]) => {
                        if (['id', 'created_time', 'last_edited_time'].includes(key)) return false
                        if (value === null || value === '' || value === undefined) return false
                        // Use cardFields if available, otherwise show first 8
                        if (config.cardFields?.length > 0) {
                          return config.cardFields.includes(key)
                        }
                        return true
                      })
                      .slice(0, config.cardFields?.length > 0 ? config.cardFields.length : 8)
                      .map(([key, value]) => (
                        <div key={key}>
                          <p className="text-sm text-gray-500">{key}</p>
                          {key === config.statusField ? (
                            <span className={"px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(value)}>{String(value)}</span>
                          ) : isClickableRelation(key) ? (
                            <button
                              onClick={() => handleRelationClick(key, value)}
                              className="text-violet-400 hover:text-violet-300 underline decoration-dotted underline-offset-2 transition-colors text-left"
                            >
                              {String(value)} →
                            </button>
                          ) : (
                            <p className="text-gray-200">{Array.isArray(value) ? value.join(', ') : String(value)}</p>
                          )}
                        </div>
                      ))
                    }
                    {(() => {
                      const allKeys = Object.keys(selectedItem).filter(k => !['id', 'created_time', 'last_edited_time'].includes(k) && selectedItem[k] !== null && selectedItem[k] !== '' && selectedItem[k] !== undefined)
                      const shownCount = config.cardFields?.length > 0 ? config.cardFields.filter(f => allKeys.includes(f)).length : Math.min(8, allKeys.length)
                      const hiddenCount = allKeys.length - shownCount
                      return hiddenCount > 0 ? (
                        <p className="text-violet-400 text-sm text-center pt-2">
                          + {hiddenCount} more fields - click Expand to see all
                        </p>
                      ) : null
                    })()}
                  </div>
                )}

                {/* Move to Submitted Action - Properties Only */}
                {databaseKey === 'PROPERTIES' && !isEditing && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    {!showMoveToSubmitted ? (
                      <button
                        onClick={() => setShowMoveToSubmitted(true)}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        📋 Move to Submitted
                      </button>
                    ) : (
                      <div className="p-4 bg-gray-800/50 rounded-xl border border-amber-500/30">
                        <h4 className="text-sm font-semibold text-amber-400 mb-3">Move to Submitted</h4>
                        <p className="text-xs text-gray-400 mb-3">This will create a Pipeline record linked to this property.</p>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Buyer Name *</label>
                            <input
                              type="text"
                              value={moveToSubmittedForm.buyerName}
                              onChange={e => setMoveToSubmittedForm(prev => ({ ...prev, buyerName: e.target.value }))}
                              placeholder="Full name"
                              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Foreman</label>
                            <input
                              type="text"
                              value={moveToSubmittedForm.foreman}
                              onChange={e => setMoveToSubmittedForm(prev => ({ ...prev, foreman: e.target.value }))}
                              placeholder="Foreman name"
                              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Subdivision</label>
                            <input
                              type="text"
                              value={moveToSubmittedForm.subdivision || selectedItem?.Subdivision || ''}
                              onChange={e => setMoveToSubmittedForm(prev => ({ ...prev, subdivision: e.target.value }))}
                              placeholder="Subdivision"
                              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Agent Assist</label>
                            <select
                              value={moveToSubmittedForm.agentAssist}
                              onChange={e => setMoveToSubmittedForm(prev => ({ ...prev, agentAssist: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                            >
                              <option value="">None</option>
                              {teamMembers.map(member => (
                                <option key={member.id} value={member.Name || member.name}>
                                  {member.Name || member.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => setShowMoveToSubmitted(false)}
                              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleMoveToSubmitted}
                              disabled={!moveToSubmittedForm.buyerName || isMovingToSubmitted}
                              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              {isMovingToSubmitted && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                              {isMovingToSubmitted ? 'Moving...' : 'Submit'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
