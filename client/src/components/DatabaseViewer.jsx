import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Users, Building2, TrendingUp, UserCheck, Calendar, X, Filter, ChevronRight, Eye, EyeOff } from 'lucide-react'
import axios from 'axios'
import { getFieldPreferences } from './FieldSettings'

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

function PropertyCard({ item, config, onClick }) {
  const status = item.Status || item.status || ''
  const price = item['Sales Price'] || item['Sale Price'] || item.Price || 0
  const formattedPrice = price ? '$' + Number(price).toLocaleString() : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`bg-gray-800 rounded-xl border border-gray-700 border-l-4 ${getStatusBorderColor(status)} overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-black/20 transition-all duration-200`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-white truncate flex-1 text-sm sm:text-base">
            {item.Address || item.address || 'No Address'}
          </h3>
          {status && (
            <span className={`ml-2 px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusColor(status)}`}>
              {status}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {item.Subdivision && (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <span className="text-gray-500">📍</span>
              {item.Subdivision}
            </p>
          )}

          {item.Floorplan && (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <span className="text-gray-500">🏠</span>
              {item.Floorplan}
            </p>
          )}

          {formattedPrice && (
            <p className="text-lg font-bold text-emerald-400 mt-2">
              {formattedPrice}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function TeamMemberCard({ item, config, onClick }) {
  const [expanded, setExpanded] = useState(false)
  // Use cardFields from preferences for main display (excluding primary which is the title)
  const cardFields = config.cardFields || [config.primaryField, ...config.secondaryFields, config.statusField].filter(Boolean)
  const mainFields = cardFields.filter(f => f !== config.primaryField && f !== config.statusField)
  // For expanded: use expandedFields if set, otherwise show all remaining fields
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
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 p-4 cursor-pointer hover:border-gray-600 transition-colors" onClick={onClick}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white truncate flex-1">{item[config.primaryField] || 'Untitled'}</h3>
        {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
      </div>
      <div className="space-y-1">{config.secondaryFields.map(field => item[field] && <p key={field} className="text-sm text-gray-400 truncate"><span className="text-gray-500">{field}:</span> {String(item[field])}</p>)}</div>
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

export default function DatabaseViewer({ databaseKey, highlightedId, onClearHighlight, onNavigate }) {
  const baseConfig = dbConfig[databaseKey] || dbConfig.TEAM_MEMBERS
  const Icon = baseConfig.icon
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showTerminated, setShowTerminated] = useState(false)
  const [cityFilter, setCityFilter] = useState('')

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

  // Get field preferences from localStorage
  const fieldPrefs = useMemo(() => getFieldPreferences(databaseKey), [databaseKey])

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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const response = await axios.get(`/api/databases/${databaseKey}`, { withCredentials: true })
        setData(response.data || [])
      } catch (error) {
        console.error('Failed to fetch database:', error)
        setData([])
      } finally {
        setIsLoading(false)
      }
    }
    if (databaseKey) fetchData()
  }, [databaseKey])

  const safeData = data || []
  const terminatedCount = useMemo(() => { if (databaseKey !== 'TEAM_MEMBERS') return 0; return safeData.filter(item => { const status = item[config.statusField]; return status && status.toLowerCase().includes('terminated') }).length }, [safeData, databaseKey, config.statusField])
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
    return result
  }, [safeData, databaseKey, showTerminated, cityFilter, config.statusField])

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

  const renderContent = () => { if (config.mobileLayout === 'table') return (<><div className="sm:hidden">{renderCardView()}</div><div className="hidden sm:block">{renderTableView()}</div></>); if (config.mobileLayout === 'list') return (<><div className="sm:hidden">{renderListView()}</div><div className="hidden sm:block">{renderCardView()}</div></>); return renderCardView() }

  if (isLoading) return (<div className="bg-gray-800 rounded-2xl border border-gray-700 p-6"><div className="animate-pulse space-y-4"><div className="h-6 bg-gray-700 rounded w-1/4"></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-700 rounded-xl"></div>)}</div></div></div>)

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3"><div className="p-2 bg-violet-500/20 rounded-xl"><Icon className="w-5 h-5 text-violet-400" /></div><div><h2 className="font-semibold text-white">{config.title}</h2><p className="text-sm text-gray-400">{filteredData.length} records</p></div></div>
        <div className="flex items-center gap-2">
          {databaseKey === 'PROPERTIES' && (
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
          )}
          {databaseKey === 'TEAM_MEMBERS' && terminatedCount > 0 && <button onClick={() => setShowTerminated(!showTerminated)} className={(showTerminated ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600') + " flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"}>{showTerminated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{showTerminated ? 'Hide' : 'Show'} Terminated ({terminatedCount})</button>}
        </div>
      </div>
      <div className="p-4">{filteredData.length === 0 ? <div className="text-center py-8 text-gray-500"><Icon className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p>No records found</p></div> : renderContent()}</div>
      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedItem(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900"><h3 className="font-semibold text-lg text-white">{selectedItem[config.primaryField] || 'Details'}</h3><button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-gray-700 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button></div>
              <div className="p-4 space-y-3">
                {Object.entries(selectedItem)
                  .filter(([key]) => key !== 'id' && key !== 'created_time' && key !== 'last_edited_time')
                  .map(([key, value]) => value !== null && value !== '' && value !== undefined && (
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
                        <p className="text-gray-200">{String(value)}</p>
                      )}
                    </div>
                  ))
                }
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
