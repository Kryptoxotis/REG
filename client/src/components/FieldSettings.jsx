import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Check, Eye, List, Maximize2, Filter } from 'lucide-react'
import api from '../lib/api'

const DATABASES = ['TEAM_MEMBERS', 'PROPERTIES', 'PIPELINE', 'CLIENTS', 'SCHEDULE', 'ACTIVITY_LOG', 'CLOSED_DEALS']
const DISPLAY_LEVELS = [
  { key: 'list', label: 'List View', icon: List, description: 'Initial grid/list display' },
  { key: 'card', label: 'Card View', icon: Eye, description: 'Single record detail' },
  { key: 'expanded', label: 'Expanded View', icon: Maximize2, description: 'Full record details' },
  { key: 'filters', label: 'Filterable Fields', icon: Filter, description: 'Fields available for filtering' }
]

const DEFAULT_PREFS = {
  TEAM_MEMBERS: { list: ['Name', 'Role', 'Status'], card: ['Name', 'Role', 'Phone', 'Email', 'Status'], expanded: [], filters: ['Status', 'Role', 'City'] },
  PROPERTIES: { list: ['Address', 'Status', 'Floorplan', 'Sales Price'], card: ['Address', 'Status', 'Floorplan', 'Sales Price', 'Subdivision'], expanded: [], filters: ['Status', 'Subdivision', 'Beds', 'Baths'] },
  PIPELINE: { list: ['Deal Name', 'Stage', 'Value', 'Agent'], card: ['Deal Name', 'Stage', 'Value', 'Agent', 'Loan Status'], expanded: [], filters: ['Loan Status', 'Agent', 'Loan Type'] },
  CLIENTS: { list: ['Name', 'Email', 'Phone', 'Source'], card: ['Name', 'Email', 'Phone', 'Source', 'Status'], expanded: [], filters: ['Status', 'Source'] },
  SCHEDULE: { list: ['Date', 'Model Home Address', 'Assigned Staff 1'], card: ['Date', 'Model Home Address', 'Assigned Staff 1', 'Assigned Staff 2'], expanded: [], filters: [] },
  ACTIVITY_LOG: { list: ['Action', 'Date', 'User'], card: ['Action', 'Date', 'User', 'Details'], expanded: [], filters: ['Action', 'User'] },
  CLOSED_DEALS: { list: ['Deal Name', 'Close Date', 'Value'], card: ['Deal Name', 'Close Date', 'Value', 'Agent'], expanded: [], filters: ['Agent'] }
}

export function getFieldPreferences(databaseKey) {
  try {
    const stored = localStorage.getItem('fieldPreferences')
    if (stored) {
      const prefs = JSON.parse(stored)
      return prefs[databaseKey] || DEFAULT_PREFS[databaseKey] || { list: [], card: [], expanded: [], filters: [] }
    }
  } catch (e) {
    console.error('Error reading preferences:', e)
  }
  return DEFAULT_PREFS[databaseKey] || { list: [], card: [], expanded: [], filters: [] }
}

export function saveFieldPreferences(databaseKey, preferences) {
  try {
    const stored = localStorage.getItem('fieldPreferences')
    const allPrefs = stored ? JSON.parse(stored) : {}
    allPrefs[databaseKey] = preferences
    localStorage.setItem('fieldPreferences', JSON.stringify(allPrefs))
  } catch (e) {
    console.error('Error saving preferences:', e)
  }
}

export default function FieldSettings({ isOpen, onClose }) {
  const [selectedDb, setSelectedDb] = useState('TEAM_MEMBERS')
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [preferences, setPreferences] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadPreferences()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && selectedDb) {
      fetchSchema(selectedDb)
    }
  }, [isOpen, selectedDb])

  const loadPreferences = () => {
    const stored = localStorage.getItem('fieldPreferences')
    if (stored) {
      setPreferences(JSON.parse(stored))
    } else {
      setPreferences(DEFAULT_PREFS)
    }
  }

  const fetchSchema = async (dbKey) => {
    setLoading(true)
    try {
      // HttpOnly cookies handle auth automatically via withCredentials
      const response = await api.get(`/api/databases/schema?key=${dbKey}`)
      setFields(response.data.fields || [])
    } catch (err) {
      console.error('Failed to fetch schema:', err)
      setFields([])
    } finally {
      setLoading(false)
    }
  }

  const toggleField = (level, fieldName) => {
    setPreferences(prev => {
      const dbPrefs = prev[selectedDb] || { list: [], card: [], expanded: [], filters: [] }
      const levelFields = dbPrefs[level] || []
      const newLevelFields = levelFields.includes(fieldName)
        ? levelFields.filter(f => f !== fieldName)
        : [...levelFields, fieldName]

      return {
        ...prev,
        [selectedDb]: {
          ...dbPrefs,
          [level]: newLevelFields
        }
      }
    })
  }

  const handleSave = () => {
    try {
      setSaving(true)
      localStorage.setItem('fieldPreferences', JSON.stringify(preferences))
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('fieldPreferencesChanged'))
      onClose()
    } catch (error) {
      console.error('Failed to save preferences:', error)
      alert('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setPreferences(prev => ({
      ...prev,
      [selectedDb]: DEFAULT_PREFS[selectedDb] || { list: [], card: [], expanded: [], filters: [] }
    }))
  }

  const currentPrefs = preferences[selectedDb] || { list: [], card: [], expanded: [], filters: [] }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gray-900 rounded-2xl border border-gray-700 max-w-4xl w-full max-h-[85vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-xl">
                <Settings className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Field Display Settings</h2>
                <p className="text-sm text-gray-400">Configure which fields show at each view level</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Database Tabs */}
          <div className="p-4 border-b border-gray-700 flex gap-2 overflow-x-auto">
            {DATABASES.map(db => (
              <button
                key={db}
                onClick={() => setSelectedDb(db)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedDb === db
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {db.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full"
                />
              </div>
            ) : (
              <div className="space-y-6">
                {DISPLAY_LEVELS.map(level => {
                  const Icon = level.icon
                  return (
                    <div key={level.key} className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Icon className="w-5 h-5 text-violet-400" />
                        <div>
                          <h3 className="font-medium text-white">{level.label}</h3>
                          <p className="text-xs text-gray-500">{level.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fields.map(field => {
                          const isSelected = currentPrefs[level.key]?.includes(field.name)
                          return (
                            <button
                              key={field.name}
                              onClick={() => toggleField(level.key, field.name)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                              {field.name}
                            </button>
                          )
                        })}
                      </div>
                      {currentPrefs[level.key]?.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          {level.key === 'expanded' ? 'Shows all remaining fields' : 'No fields selected'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 flex items-center justify-between">
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Reset to Defaults
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
