import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Users, Building2, TrendingUp, UserCheck, Calendar, X, Filter, ChevronRight, Eye, EyeOff } from 'lucide-react'

const dbConfig = {
  TEAM_MEMBERS: { title: 'Team Members', icon: Users, primaryField: 'Name', secondaryFields: ['Role', 'Phone', 'Email'], statusField: 'Status', mobileLayout: 'card' },
  PROPERTIES: { title: 'Properties', icon: Building2, primaryField: 'Property Name', secondaryFields: ['Status', 'Type', 'Address'], statusField: 'Status', mobileLayout: 'table', tableColumns: ['Property Name', 'Status', 'Type', 'Address', 'Price'] },
  PIPELINE: { title: 'Pipeline', icon: TrendingUp, primaryField: 'Deal Name', secondaryFields: ['Stage', 'Value', 'Agent'], statusField: 'Stage', mobileLayout: 'card' },
  CLIENTS: { title: 'Clients', icon: UserCheck, primaryField: 'Name', secondaryFields: ['Email', 'Phone', 'Source'], statusField: 'Status', mobileLayout: 'card' },
  SCHEDULE: { title: 'Schedule', icon: Calendar, primaryField: 'Date', secondaryFields: ['Model Home Address', 'Assigned Staff 1', 'Assigned Staff 2'], statusField: null, mobileLayout: 'list' }
}

function getStatusColor(status) {
  if (!status) return 'bg-gray-100 text-gray-800'
  const s = status.toLowerCase()
  if (s.includes('active') || s.includes('won') || s.includes('closed')) return 'bg-green-100 text-green-800'
  if (s.includes('pending') || s.includes('negotiation') || s.includes('showing')) return 'bg-yellow-100 text-yellow-800'
  if (s.includes('new') || s.includes('lead') || s.includes('prospect')) return 'bg-blue-100 text-blue-800'
  if (s.includes('inactive') || s.includes('lost') || s.includes('terminated')) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
}

function TeamMemberCard({ item, config, onClick }) {
  const [expanded, setExpanded] = useState(false)
  const displayedFields = [config.primaryField, ...config.secondaryFields, config.statusField].filter(Boolean)
  const extraFields = Object.entries(item).filter(([key, value]) => !displayedFields.includes(key) && key !== 'id' && key !== 'created_time' && key !== 'last_edited_time' && value !== null && value !== '' && value !== undefined)
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={onClick}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 truncate flex-1">{item[config.primaryField] || 'Untitled'}</h3>
          {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
        </div>
        <div className="space-y-1">{config.secondaryFields.map(field => item[field] && <p key={field} className="text-sm text-gray-600 truncate"><span className="text-gray-400">{field}:</span> {String(item[field])}</p>)}</div>
      </div>
      {extraFields.length > 0 && (<>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="w-full px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-600 hover:bg-gray-100">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}{expanded ? 'Show Less' : 'Show ' + extraFields.length + ' More Fields'}
        </button>
        <AnimatePresence>{expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2">{extraFields.map(([key, value]) => <p key={key} className="text-sm text-gray-600"><span className="text-gray-400 font-medium">{key}:</span> {String(value)}</p>)}</div></motion.div>}</AnimatePresence>
      </>)}
    </motion.div>
  )
}

function SmartCardView({ item, config, onClick }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900 truncate flex-1">{item[config.primaryField] || 'Untitled'}</h3>
        {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
      </div>
      <div className="space-y-1">{config.secondaryFields.map(field => item[field] && <p key={field} className="text-sm text-gray-600 truncate"><span className="text-gray-400">{field}:</span> {String(item[field])}</p>)}</div>
    </motion.div>
  )
}

export default function DatabaseViewer({ dbKey, data, isLoading }) {
  const config = dbConfig[dbKey] || dbConfig.TEAM_MEMBERS
  const Icon = config.icon
  const [selectedItem, setSelectedItem] = useState(null)
  const [showTerminated, setShowTerminated] = useState(false)
  const terminatedCount = useMemo(() => { if (dbKey !== 'TEAM_MEMBERS') return 0; return data.filter(item => { const status = item[config.statusField]; return status && status.toLowerCase().includes('terminated') }).length }, [data, dbKey, config.statusField])
  const filteredData = useMemo(() => { if (dbKey !== 'TEAM_MEMBERS' || showTerminated) return data; return data.filter(item => { const status = item[config.statusField]; return !status || !status.toLowerCase().includes('terminated') }) }, [data, dbKey, showTerminated, config.statusField])

  const renderTableView = () => {
    const columns = config.tableColumns || [config.primaryField, ...config.secondaryFields]
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{columns.map(col => <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>)}</tr></thead><tbody className="bg-white divide-y divide-gray-200">{filteredData.map((item, idx) => <tr key={item.id || idx} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedItem(item)}>{columns.map(col => <td key={col} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{col === config.statusField && item[col] ? <span className={"px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[col])}>{item[col]}</span> : String(item[col] || '-')}</td>)}</tr>)}</tbody></table></div>)
  }

  const renderListView = () => (<div className="space-y-2">{filteredData.map((item, idx) => <motion.div key={item.id || idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setSelectedItem(item)}><div className="flex items-center justify-between"><div className="flex-1 min-w-0"><p className="font-medium text-gray-900 truncate">{item[config.primaryField] || 'Untitled'}</p><p className="text-sm text-gray-500 truncate">{config.secondaryFields.map(f => item[f]).filter(Boolean).join(' . ')}</p></div><ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" /></div></motion.div>)}</div>)

  const renderCardView = () => (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredData.map((item, idx) => dbKey === 'TEAM_MEMBERS' ? <TeamMemberCard key={item.id || idx} item={item} config={config} onClick={() => setSelectedItem(item)} /> : <SmartCardView key={item.id || idx} item={item} config={config} onClick={() => setSelectedItem(item)} />)}</div>)

  const renderContent = () => { if (config.mobileLayout === 'table') return renderTableView(); if (config.mobileLayout === 'list') return (<><div className="sm:hidden">{renderListView()}</div><div className="hidden sm:block">{renderCardView()}</div></>); return renderCardView() }

  if (isLoading) return (<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><div className="animate-pulse space-y-4"><div className="h-6 bg-gray-200 rounded w-1/4"></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>)}</div></div></div>)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Icon className="w-5 h-5 text-blue-600" /></div><div><h2 className="font-semibold text-gray-900">{config.title}</h2><p className="text-sm text-gray-500">{filteredData.length} records</p></div></div>
        {dbKey === 'TEAM_MEMBERS' && terminatedCount > 0 && <button onClick={() => setShowTerminated(!showTerminated)} className={(showTerminated ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200') + " flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"}>{showTerminated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{showTerminated ? 'Hide' : 'Show'} Terminated ({terminatedCount})</button>}
      </div>
      <div className="p-4">{filteredData.length === 0 ? <div className="text-center py-8 text-gray-500"><Icon className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p>No records found</p></div> : renderContent()}</div>
      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedItem(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white"><h3 className="font-semibold text-lg text-gray-900">{selectedItem[config.primaryField] || 'Details'}</h3><button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button></div>
              <div className="p-4 space-y-3">{Object.entries(selectedItem).filter(([key]) => key !== 'id' && key !== 'created_time' && key !== 'last_edited_time').map(([key, value]) => value !== null && value !== '' && value !== undefined && <div key={key}><p className="text-sm text-gray-500">{key}</p><p className="text-gray-900">{key === config.statusField ? <span className={"px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(value)}>{String(value)}</span> : String(value)}</p></div>)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
