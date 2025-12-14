import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'

// Shimmer animation keyframes (add to your CSS or use inline)
const shimmerKeyframes = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes pulse-glow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(5deg); }
}
`

function DetailModal({ item, onClose, onUpdate, databaseKey }) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Field configurations with smart grouping
  const fieldConfig = {
    TEAM_MEMBERS: {
      primary: ['Name', 'Status', 'Role'],
      contact: [
        { key: 'Phone', icon: 'phone', action: 'tel' },
        { key: 'Email - ERA', label: 'Work Email', icon: 'email', action: 'mailto' },
        { key: 'Email - Personal', label: 'Personal', icon: 'email', action: 'mailto' }
      ],
      details: [
        { key: 'Team', label: 'Team' },
        { key: 'License Number', label: 'License #' },
        { key: 'Date of Birth', label: 'Birthday', type: 'date' },
        { key: 'T-Shirt Size', label: 'T-Shirt' }
      ]
    },
    PROPERTIES: {
      primary: ['Address', 'Status', 'Subdivision'],
      highlights: [
        { key: 'Sales Price', format: 'currency', highlight: true },
        { key: 'SqFt', label: 'Sq Ft', suffix: ' sq ft' }
      ],
      details: [
        { key: 'Floorplan' },
        { key: 'Bedrooms', label: 'Beds' },
        { key: 'Bathrooms', label: 'Baths' },
        { key: 'Story', label: 'Stories' }
      ]
    },
    MODEL_HOMES: {
      primary: ['Address', 'Status', 'Subdivision'],
      highlights: [
        { key: 'Sales Price', format: 'currency', highlight: true },
        { key: 'SqFt', label: 'Sq Ft', suffix: ' sq ft' }
      ],
      details: [
        { key: 'Floorplan' },
        { key: 'Bedrooms', label: 'Beds' },
        { key: 'Bathrooms', label: 'Baths' }
      ]
    },
    PIPELINE: {
      primary: ['Address', 'Loan Status', 'Executed'],
      highlights: [
        { key: 'Sales Price', format: 'currency', highlight: true },
        { key: 'Loan Amount', format: 'currency' }
      ],
      buyer: [
        { key: 'Buyer Name', label: 'Buyer' },
        { key: 'Buyer Phone', icon: 'phone', action: 'tel' },
        { key: 'Buyer Email', icon: 'email', action: 'mailto' }
      ],
      team: [
        { key: 'Agent' },
        { key: 'Assisting Agent', label: 'Assist' }
      ],
      dates: [
        { key: 'Execution Date', label: 'Executed', type: 'date' },
        { key: 'Scheduled Closing', label: 'Closing', type: 'date' },
        { key: 'Closed Date', label: 'Closed', type: 'date' }
      ],
      lender: [
        { key: 'Loan Type' },
        { key: 'LO Name', label: 'Loan Officer' },
        { key: 'Mortgage Company', label: 'Lender' }
      ],
      notes: [{ key: 'Notes' }]
    },
    CLIENTS: {
      primary: ['Property Address', 'Status'],
      contact: [
        { key: 'Full Name', label: 'Name' },
        { key: 'Phone', icon: 'phone', action: 'tel' },
        { key: 'Email', icon: 'email', action: 'mailto' }
      ],
      details: [
        { key: 'Timeline' },
        { key: 'Motivation' },
        { key: 'Additional Notes', label: 'Notes' }
      ]
    },
    SCHEDULE: {
      primary: ['Date', 'Model Home Address'],
      staff: [
        { key: 'Assigned Staff 1', label: 'Staff 1' },
        { key: 'Assigned Staff 2', label: 'Staff 2' }
      ]
    },
    SCOREBOARD: {
      primary: ['Address', 'Loan Status'],
      highlights: [
        { key: 'Sales Price', format: 'currency', highlight: true },
        { key: 'Loan Amount', format: 'currency' }
      ],
      details: [
        { key: 'Agent' },
        { key: 'Closed Date', type: 'date' }
      ]
    }
  }

  const dbStyles = {
    TEAM_MEMBERS: { icon: '👥', gradient: 'from-violet-500 to-purple-600', glow: 'shadow-violet-500/30', accent: 'violet' },
    PROPERTIES: { icon: '🏘️', gradient: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/30', accent: 'emerald' },
    MODEL_HOMES: { icon: '🏠', gradient: 'from-teal-500 to-cyan-600', glow: 'shadow-teal-500/30', accent: 'teal' },
    PIPELINE: { icon: '📊', gradient: 'from-blue-500 to-indigo-600', glow: 'shadow-blue-500/30', accent: 'blue' },
    CLIENTS: { icon: '💼', gradient: 'from-rose-500 to-pink-600', glow: 'shadow-rose-500/30', accent: 'rose' },
    SCHEDULE: { icon: '📅', gradient: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/30', accent: 'amber' },
    SCOREBOARD: { icon: '🏆', gradient: 'from-indigo-500 to-purple-600', glow: 'shadow-indigo-500/30', accent: 'indigo' }
  }

  const config = fieldConfig[databaseKey] || {}
  const style = dbStyles[databaseKey] || { icon: '📋', gradient: 'from-gray-500 to-gray-600', light: 'gray' }

  useEffect(() => {
    if (item) setFormData({ ...item })
  }, [item])

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const token = localStorage.getItem('authToken')
      await axios.patch(`/api/databases/${databaseKey}/${item.id}`, formData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      onUpdate()
      setIsEditing(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  const formatValue = (val, field = {}) => {
    if (val === null || val === undefined || val === '') return null
    if (field.format === 'currency') return `$${Number(val).toLocaleString()}`
    if (field.type === 'date' && val) {
      const d = typeof val === 'object' && val.start ? val.start : val
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (field.suffix) return `${Number(val).toLocaleString()}${field.suffix}`
    return String(val)
  }

  const getStatusColor = (status) => {
    if (!status) return { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' }
    const s = String(status).toLowerCase()
    if (s.includes('active') || s.includes('closed') || s.includes('funded') || s.includes('model'))
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' }
    if (s.includes('pending') || s.includes('processing') || s.includes('conditions') || s.includes('disclosures'))
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' }
    if (s.includes('inactive') || s.includes('back on market') || s.includes('cancelled'))
      return { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' }
    if (s.includes('new') || s.includes('application') || s.includes('inventory'))
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' }
    return { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' }
  }

  const handleAction = (action, value) => {
    if (!value) return
    if (action === 'tel') window.location.href = `tel:${value}`
    if (action === 'mailto') window.location.href = `mailto:${value}`
  }

  if (!item) return null

  const primaryFields = config.primary || []
  const title = formData[primaryFields[0]] || 'Record'
  const statusKey = primaryFields.find(k => k.includes('Status'))
  const status = statusKey ? formData[statusKey] : null
  const statusColors = getStatusColor(status)

  const sectionOrder = ['highlights', 'contact', 'buyer', 'team', 'dates', 'lender', 'details', 'staff', 'notes']
  const sectionLabels = {
    highlights: null,
    contact: 'Contact',
    buyer: 'Buyer',
    team: 'Team',
    dates: 'Timeline',
    lender: 'Lender',
    details: 'Details',
    staff: 'Assigned Staff',
    notes: 'Notes'
  }

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          onClick={e => e.stopPropagation()}
          className={`relative bg-[#0a0a0a] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-hidden shadow-2xl ${style.glow} shadow-xl`}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 relative z-10">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>

          {/* Animated border glow */}
          <div className={`absolute inset-0 rounded-t-3xl sm:rounded-3xl bg-gradient-to-br ${style.gradient} opacity-20`}
               style={{ animation: 'pulse-glow 3s ease-in-out infinite' }} />
          <div className="absolute inset-[1px] rounded-t-3xl sm:rounded-3xl bg-[#0a0a0a]" />

          {/* Header with shimmer */}
          <div className={`relative bg-gradient-to-br ${style.gradient} p-6 pb-8 overflow-hidden`}>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                   style={{ animation: 'shimmer 3s ease-in-out infinite' }} />
            </div>
            {/* Floating shapes for depth */}
            <div className="absolute top-4 right-12 w-20 h-20 bg-white/5 rounded-full blur-xl"
                 style={{ animation: 'float 6s ease-in-out infinite' }} />
            <div className="absolute bottom-0 left-8 w-16 h-16 bg-black/10 rounded-full blur-lg"
                 style={{ animation: 'float 4s ease-in-out infinite reverse' }} />

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg"
                >
                  <span className="text-3xl drop-shadow-lg">{style.icon}</span>
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90, backgroundColor: 'rgba(0,0,0,0.5)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white/80 transition-all backdrop-blur-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>
              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-2xl font-bold text-white leading-tight drop-shadow-lg"
              >
                {title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-white/60 text-sm mt-1 font-medium"
              >
                {databaseKey.replace(/_/g, ' ')}
              </motion.p>
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10"
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${statusColors.dot} shadow-lg`}
                        style={{ boxShadow: `0 0 10px currentColor` }} />
                  <span className="text-white text-sm font-semibold">{status}</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="relative p-5 max-h-[50vh] overflow-y-auto">
            {isEditing ? (
              <EditForm
                config={config}
                formData={formData}
                onChange={handleChange}
                error={error}
              />
            ) : (
              <div className="space-y-5">
                {sectionOrder.map((sectionKey, sectionIdx) => {
                  const fields = config[sectionKey]
                  if (!fields) return null

                  const hasData = fields.some(f => {
                    const key = typeof f === 'string' ? f : f.key
                    return formatValue(formData[key], f) !== null
                  })
                  if (!hasData) return null

                  const label = sectionLabels[sectionKey]
                  const isHighlight = sectionKey === 'highlights'

                  return (
                    <motion.div
                      key={sectionKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + sectionIdx * 0.05 }}
                    >
                      {label && (
                        <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">{label}</h4>
                      )}
                      {isHighlight ? (
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          {fields.map((f, i) => {
                            const val = formatValue(formData[f.key], f)
                            if (!val) return null
                            return (
                              <motion.div
                                key={f.key}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + i * 0.1 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                className={`relative p-4 rounded-2xl overflow-hidden ${
                                  f.highlight
                                    ? `bg-gradient-to-br ${style.gradient} bg-opacity-10`
                                    : 'bg-white/[0.03]'
                                } border border-white/10 group`}
                              >
                                {f.highlight && (
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1 relative">{f.label || f.key}</p>
                                <p className={`text-xl font-bold relative ${f.highlight ? 'text-white' : 'text-gray-300'}`}>{val}</p>
                              </motion.div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {fields.map((f, i) => {
                            const key = typeof f === 'string' ? f : f.key
                            const field = typeof f === 'string' ? { key: f } : f
                            const val = formatValue(formData[key], field)
                            if (!val) return null

                            const hasAction = field.action && formData[key]

                            return (
                              <motion.div
                                key={key}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15 + i * 0.03 }}
                                onClick={() => hasAction && handleAction(field.action, formData[key])}
                                className={`flex items-center justify-between py-3 px-4 -mx-4 rounded-xl transition-all ${
                                  hasAction
                                    ? 'hover:bg-gradient-to-r hover:from-white/5 hover:to-transparent cursor-pointer group'
                                    : ''
                                }`}
                              >
                                <span className="text-gray-500 text-sm">{field.label || key}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-white text-sm font-medium">{val}</span>
                                  {hasAction && (
                                    <motion.span
                                      whileHover={{ scale: 1.2 }}
                                      className={`text-gray-500 group-hover:text-${style.accent}-400 transition-colors`}
                                    >
                                      {field.icon === 'phone' && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                      )}
                                      {field.icon === 'email' && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                      )}
                                    </motion.span>
                                  )}
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="relative p-5 pt-0">
            {isEditing ? (
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3.5 text-sm font-medium text-gray-400 hover:text-white rounded-xl hover:bg-white/5 border border-white/5 transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 10px 40px -10px rgba(99, 102, 241, 0.5)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex-1 py-3.5 bg-gradient-to-r ${style.gradient} text-white text-sm font-semibold rounded-xl disabled:opacity-50 shadow-lg transition-all`}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Saving...
                    </span>
                  ) : 'Save Changes'}
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setIsEditing(true)}
                className={`relative w-full py-4 overflow-hidden rounded-xl text-white text-sm font-semibold transition-all group`}
              >
                {/* Animated gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-r ${style.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
                <div className="absolute inset-0 border border-white/10 group-hover:border-white/20 rounded-xl transition-colors" />
                {/* Shimmer on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                       style={{ animation: 'shimmer 2s ease-in-out infinite' }} />
                </div>
                <span className="relative flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit Record
                </span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}

function EditForm({ config, formData, onChange, error }) {
  const allFields = []
  Object.values(config).forEach(section => {
    if (Array.isArray(section)) {
      section.forEach(f => {
        const key = typeof f === 'string' ? f : f.key
        const field = typeof f === 'string' ? { key: f, label: f } : { ...f, label: f.label || f.key }
        if (!allFields.find(x => x.key === key)) allFields.push(field)
      })
    }
  })

  return (
    <div className="space-y-4">
      {allFields.map((field, i) => (
        <motion.div
          key={field.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
            {field.label}
          </label>
          <motion.input
            whileFocus={{ scale: 1.01 }}
            type={field.type === 'date' ? 'date' : field.format === 'currency' ? 'number' : 'text'}
            value={formData[field.key] || ''}
            onChange={e => onChange(field.key, e.target.value)}
            className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/5 transition-all"
          />
        </motion.div>
      ))}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3"
        >
          <span className="text-lg">⚠️</span>
          {error}
        </motion.div>
      )}
    </div>
  )
}

export default DetailModal
