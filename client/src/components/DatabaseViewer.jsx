import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Users, Building2, TrendingUp, UserCheck, Calendar, X, Filter, ChevronRight, Eye, EyeOff } from 'lucide-react'
import axios from 'axios'

const dbConfig = {
  TEAM_MEMBERS: { title: 'Team Members', icon: Users, primaryField: 'Name', secondaryFields: ['Role', 'Phone', 'Email'], statusField: 'Status', mobileLayout: 'card' },
  PROPERTIES: { title: 'Properties', icon: Building2, primaryField: 'Property Name', secondaryFields: ['Status', 'Type', 'Address'], statusField: 'Status', mobileLayout: 'table', tableColumns: ['Property Name', 'Status', 'Type', 'Address', 'Price'] },
  PIPELINE: { title: 'Pipeline', icon: TrendingUp, primaryField: 'Deal Name', secondaryFields: ['Stage', 'Value', 'Agent'], statusField: 'Stage', mobileLayout: 'card' },
  CLIENTS: { title: 'Clients', icon: UserCheck, primaryField: 'Name', secondaryFields: ['Email', 'Phone', 'Source'], statusField: 'Status', mobileLayout: 'card' },
  SCHEDULE: { title: 'Schedule', icon: Calendar, primaryField: 'Date', secondaryFields: ['Model Home Address', 'Assigned Staff 1', 'Assigned Staff 2'], statusField: null, mobileLayout: 'list' }
}

function getStatusColor(status) {
  if (!status) return 'bg-gray-700 text-gray-300'
  const s = status.toLowerCase()
  if (s.includes('active') || s.includes('won') || s.includes('closed')) return 'bg-emerald-500/20 text-emerald-400'
  if (s.includes('pending') || s.includes('negotiation') || s.includes('showing')) return 'bg-amber-500/20 text-amber-400'
  if (s.includes('new') || s.includes('lead') || s.includes('prospect')) return 'bg-blue-500/20 text-blue-400'
  if (s.includes('inactive') || s.includes('lost') || s.includes('terminated')) return 'bg-red-500/20 text-red-400'
  return 'bg-gray-700 text-gray-300'
}

function TeamMemberCard({ item, config, onClick }) {
  const [expanded, setExpanded] = useState(false)
  const displayedFields = [config.primaryField, ...config.secondaryFields, config.statusField].filter(Boolean)
  const extraFields = Object.entries(item).filter(([key, value]) => !displayedFields.includes(key) && key !== 'id' && key !== 'created_time' && key !== 'last_edited_time' && value !== null && value !== '' && value !== undefined)
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
      <div className="p-4 cursor-pointer hover:bg-gray-700/50" onClick={onClick}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-white truncate flex-1">{item[config.primaryField] || 'Untitled'}</h3>
          {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
        </div>
        <div className="space-y-1">{config.secondaryFields.map(field => item[field] && <p key={field} className="text-sm text-gray-400 truncate"><span className="text-gray-500">{field}:</span> {String(item[field])}</p>)}</div>
      </div>
      {extraFields.length > 0 && (<>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="w-full px-4 py-2 bg-gray-900 border-t border-gray-700 flex items-center justify-center gap-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}{expanded ? 'Show Less' : 'Show ' + extraFields.length + ' More Fields'}
        </button>
        <AnimatePresence>{expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="px-4 py-3 bg-gray-900 border-t border-gray-700 space-y-2">{extraFields.map(([key, value]) => <p key={key} className="text-sm text-gray-400"><span className="text-gray-500 font-medium">{key}:</span> {String(value)}</p>)}</div></motion.div>}</AnimatePresence>
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

export default function DatabaseViewer({ databaseKey }) {
  const config = dbConfig[databaseKey] || dbConfig.TEAM_MEMBERS
  const Icon = config.icon
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showTerminated, setShowTerminated] = useState(false)

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
  const filteredData = useMemo(() => { if (databaseKey !== 'TEAM_MEMBERS' || showTerminated) return safeData; return safeData.filter(item => { const status = item[config.statusField]; return !status || !status.toLowerCase().includes('terminated') }) }, [safeData, databaseKey, showTerminated, config.statusField])

  const renderTableView = () => {
    const columns = config.tableColumns || [config.primaryField, ...config.secondaryFields]
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-700"><thead className="bg-gray-900"><tr>{columns.map(col => <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{col}</th>)}</tr></thead><tbody className="bg-gray-800 divide-y divide-gray-700">{filteredData.map((item, idx) => <tr key={item.id || idx} className="hover:bg-gray-700 cursor-pointer transition-colors" onClick={() => setSelectedItem(item)}>{columns.map(col => <td key={col} className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{col === config.statusField && item[col] ? <span className={"px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[col])}>{item[col]}</span> : String(item[col] || '-')}</td>)}</tr>)}</tbody></table></div>)
  }

  const renderListView = () => (<div className="space-y-2">{filteredData.map((item, idx) => <motion.div key={item.id || idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 p-3 cursor-pointer hover:bg-gray-700 transition-colors" onClick={() => setSelectedItem(item)}><div className="flex items-center justify-between"><div className="flex-1 min-w-0"><p className="font-medium text-white truncate">{item[config.primaryField] || 'Untitled'}</p><p className="text-sm text-gray-400 truncate">{config.secondaryFields.map(f => item[f]).filter(Boolean).join(' · ')}</p></div><ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" /></div></motion.div>)}</div>)

  const renderCardView = () => (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredData.map((item, idx) => databaseKey === 'TEAM_MEMBERS' ? <TeamMemberCard key={item.id || idx} item={item} config={config} onClick={() => setSelectedItem(item)} /> : <SmartCardView key={item.id || idx} item={item} config={config} onClick={() => setSelectedItem(item)} />)}</div>)

  const renderContent = () => { if (config.mobileLayout === 'table') return (<><div className="sm:hidden">{renderCardView()}</div><div className="hidden sm:block">{renderTableView()}</div></>); if (config.mobileLayout === 'list') return (<><div className="sm:hidden">{renderListView()}</div><div className="hidden sm:block">{renderCardView()}</div></>); return renderCardView() }

  if (isLoading) return (<div className="bg-gray-800 rounded-2xl border border-gray-700 p-6"><div className="animate-pulse space-y-4"><div className="h-6 bg-gray-700 rounded w-1/4"></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-700 rounded-xl"></div>)}</div></div></div>)

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="p-2 bg-violet-500/20 rounded-xl"><Icon className="w-5 h-5 text-violet-400" /></div><div><h2 className="font-semibold text-white">{config.title}</h2><p className="text-sm text-gray-400">{filteredData.length} records</p></div></div>
        {databaseKey === 'TEAM_MEMBERS' && terminatedCount > 0 && <button onClick={() => setShowTerminated(!showTerminated)} className={(showTerminated ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600') + " flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"}>{showTerminated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{showTerminated ? 'Hide' : 'Show'} Terminated ({terminatedCount})</button>}
      </div>
      <div className="p-4">{filteredData.length === 0 ? <div className="text-center py-8 text-gray-500"><Icon className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p>No records found</p></div> : renderContent()}</div>
      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedItem(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900"><h3 className="font-semibold text-lg text-white">{selectedItem[config.primaryField] || 'Details'}</h3><button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-gray-700 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button></div>
              <div className="p-4 space-y-3">{Object.entries(selectedItem).filter(([key]) => key !== 'id' && key !== 'created_time' && key !== 'last_edited_time').map(([key, value]) => value !== null && value !== '' && value !== undefined && <div key={key}><p className="text-sm text-gray-500">{key}</p><p className="text-gray-200">{key === config.statusField ? <span className={"px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(value)}>{String(value)}</span> : String(value)}</p></div>)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
