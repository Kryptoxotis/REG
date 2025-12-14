import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

function ScheduleCalendar({ onNavigate }) {
  const [data, setData] = useState([])
  const [teamKpis, setTeamKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState(null) // For "Show More" modal
  const [editMode, setEditMode] = useState(false)
  const [editStaff1, setEditStaff1] = useState('')
  const [editStaff2, setEditStaff2] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('authToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const [scheduleRes, kpisRes] = await Promise.all([
        axios.get('/api/databases/SCHEDULE', { headers }),
        axios.get('/api/databases/team-kpis', { headers })
      ])
      setData(scheduleRes.data)
      setTeamKpis(kpisRes.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch schedule')
    } finally { setLoading(false) }
  }

  const findStaffKpis = (staffName) => {
    if (!staffName) return null
    return teamKpis.find(member =>
      member.name && member.name.toLowerCase().includes(staffName.toLowerCase())
    )
  }

  const handleStaffClick = (staffName, e) => {
    e.stopPropagation()
    const kpis = findStaffKpis(staffName)
    if (kpis) {
      setSelectedStaff(kpis)
    }
  }

  const formatCurrency = (num) => '$' + (num || 0).toLocaleString()

  const startEdit = () => {
    setEditStaff1(selectedEvent['Assigned Staff 1'] || '')
    setEditStaff2(selectedEvent['Assigned Staff 2'] || '')
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setEditStaff1('')
    setEditStaff2('')
  }

  const saveStaffChanges = async () => {
    if (!selectedEvent?.id) return
    setSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      await axios.patch(`/api/databases/SCHEDULE/${selectedEvent.id}`, {
        'Assigned Staff 1': editStaff1,
        'Assigned Staff 2': editStaff2
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

      // Update local data
      setData(prev => prev.map(item =>
        item.id === selectedEvent.id
          ? { ...item, 'Assigned Staff 1': editStaff1, 'Assigned Staff 2': editStaff2 }
          : item
      ))
      setSelectedEvent(prev => ({ ...prev, 'Assigned Staff 1': editStaff1, 'Assigned Staff 2': editStaff2 }))
      setEditMode(false)
    } catch (err) {
      alert('Failed to save changes: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  // Get active team members for dropdown
  const activeTeamMembers = teamKpis.filter(m => m.status === 'Active').map(m => m.name)

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay, year, month }
  }

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentDate)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToToday = () => setCurrentDate(new Date())

  // Parse date from various formats (Notion date object, ISO string, or DD/MM/YYYY)
  const parseScheduleDate = (dateField) => {
    if (!dateField) return null

    // Handle Notion date object format { start: "2024-12-15", end: null }
    if (typeof dateField === 'object' && dateField.start) {
      const d = new Date(dateField.start)
      if (isNaN(d.getTime())) return null
      return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() }
    }

    // Handle ISO date string "2024-12-15"
    if (typeof dateField === 'string' && dateField.includes('-') && !dateField.includes('/')) {
      const d = new Date(dateField)
      if (isNaN(d.getTime())) return null
      return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() }
    }

    // Handle old DD/MM/YYYY format (fallback)
    if (typeof dateField === 'string') {
      const datePart = dateField.includes(' - ') ? dateField.split(' - ')[0] : dateField
      const [day, month, year] = datePart.split('/')
      if (!day || !month || !year) return null
      return { day: parseInt(day), month: parseInt(month), year: parseInt(year) }
    }

    return null
  }

  const getEventsForDay = (day) => {
    return data.filter(item => {
      const parsed = parseScheduleDate(item.Date)
      if (!parsed) return false
      return parsed.day === day && parsed.month === (month + 1) && parsed.year === year
    })
  }

  const isToday = (day) => {
    const today = new Date()
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-400">Loading schedule...</p>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400">{typeof error === 'object' ? (error?.message || 'An error occurred') : error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Try Again</button>
      </motion.div>
    )
  }

  // Generate calendar grid
  const calendarDays = []
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Schedule</h2>
          <p className="text-sm text-gray-400">{data.length} scheduled shifts</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={goToToday} className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg">
            Today
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={fetchData} className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white">
            🔄
          </motion.button>
        </div>
      </div>

      {/* Calendar Container */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={prevMonth} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <h3 className="text-xl font-bold text-white">
            {monthNames[month]} {year}
          </h3>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={nextMonth} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-700">
          {dayNames.map(day => (
            <div key={day} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold text-gray-400 bg-gray-900/50">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const events = day ? getEventsForDay(day) : []
            const hasEvents = events.length > 0
            const today = isToday(day)

            return (
              <motion.div
                key={idx}
                whileHover={day ? { backgroundColor: 'rgba(75, 85, 99, 0.3)' } : {}}
                className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r border-gray-700/50 ${!day ? 'bg-gray-900/30' : ''}`}
              >
                {day && (
                  <>
                    <div className={`text-right mb-1 ${today ? 'font-bold' : ''}`}>
                      <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm ${today ? 'bg-amber-500 text-white' : 'text-gray-400'}`}>
                        {day}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {events.slice(0, 2).map((event, eventIdx) => (
                        <motion.div
                          key={event.id || eventIdx}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedEvent(event)}
                          className="px-1.5 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-[10px] sm:text-xs text-amber-300 truncate cursor-pointer hover:bg-amber-500/30 transition-colors"
                        >
                          {event['Model Home Address'] || 'Shift'}
                        </motion.div>
                      ))}
                      {events.length > 2 && (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedDayEvents({ day, events })}
                          className="text-[10px] sm:text-xs text-amber-400 pl-1 cursor-pointer hover:text-amber-300"
                        >
                          +{events.length - 2} more →
                        </motion.div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Upcoming Events List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Upcoming Shifts</h3>
        </div>
        <div className="divide-y divide-gray-700/50 max-h-[300px] overflow-y-auto">
          {data
            .filter(item => {
              const parsed = parseScheduleDate(item.Date)
              if (!parsed) return false
              const eventDate = new Date(parsed.year, parsed.month - 1, parsed.day)
              return eventDate >= new Date(new Date().setHours(0,0,0,0))
            })
            .sort((a, b) => {
              const parsedA = parseScheduleDate(a.Date)
              const parsedB = parseScheduleDate(b.Date)
              const dateA = new Date(parsedA.year, parsedA.month - 1, parsedA.day)
              const dateB = new Date(parsedB.year, parsedB.month - 1, parsedB.day)
              return dateA - dateB
            })
            .slice(0, 10)
            .map((event, idx) => {
              const parsed = parseScheduleDate(event.Date)
              const date = new Date(parsed.year, parsed.month - 1, parsed.day)
              return (
                <motion.div
                  key={event.id || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedEvent(event)}
                  className="p-4 hover:bg-gray-700/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-amber-500/20 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-amber-400 text-xs font-semibold">{monthNames[date.getMonth()].slice(0, 3)}</span>
                      <span className="text-amber-300 text-lg font-bold">{date.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{event['Model Home Address'] || 'Scheduled Shift'}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {event['Assigned Staff 1'] && (
                          <span className="text-xs text-gray-400">
                            👤 {event['Assigned Staff 1']}
                          </span>
                        )}
                        {event['Assigned Staff 2'] && (
                          <span className="text-xs text-gray-400">
                            👤 {event['Assigned Staff 2']}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          {data.filter(item => {
            const parsed = parseScheduleDate(item.Date)
            if (!parsed) return false
            const eventDate = new Date(parsed.year, parsed.month - 1, parsed.day)
            return eventDate >= new Date(new Date().setHours(0,0,0,0))
          }).length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No upcoming shifts scheduled
            </div>
          )}
        </div>
      </motion.div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEvent(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-md w-full overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-400" />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">📅</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Scheduled Shift</h2>
                    <p className="text-gray-400">
                      {(() => {
                        const parsed = parseScheduleDate(selectedEvent.Date)
                        if (!parsed) return 'No date'
                        const date = new Date(parsed.year, parsed.month - 1, parsed.day)
                        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                      })()}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedEvent['Model Home Address'] && (
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (onNavigate) {
                          // Navigate to Pipeline view - the address can be searched there
                          onNavigate('PIPELINE', null)
                          setSelectedEvent(null)
                        }
                      }}
                      className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-700/50 transition-colors group"
                    >
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Location</p>
                      <p className="text-white font-medium">{selectedEvent['Model Home Address']}</p>
                      <p className="text-xs text-amber-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to view in Pipeline →</p>
                    </motion.div>
                  )}

                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Assigned Staff</p>
                      {!editMode && (
                        <button onClick={startEdit} className="text-xs text-amber-400 hover:text-amber-300">
                          Edit
                        </button>
                      )}
                    </div>

                    {editMode ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Staff 1</label>
                          <select
                            value={editStaff1}
                            onChange={(e) => setEditStaff1(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                          >
                            <option value="">-- None --</option>
                            {activeTeamMembers.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Staff 2</label>
                          <select
                            value={editStaff2}
                            onChange={(e) => setEditStaff2(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                          >
                            <option value="">-- None --</option>
                            {activeTeamMembers.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={saveStaffChanges}
                            disabled={saving}
                            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedEvent['Assigned Staff 1'] && (
                          <motion.div
                            whileHover={{ scale: 1.02, x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => handleStaffClick(selectedEvent['Assigned Staff 1'], e)}
                            className="flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-sm font-bold">
                              {selectedEvent['Assigned Staff 1'].charAt(0)}
                            </div>
                            <span className="text-white">{selectedEvent['Assigned Staff 1']}</span>
                            <span className="ml-auto text-xs text-amber-400">View Stats →</span>
                          </motion.div>
                        )}
                        {selectedEvent['Assigned Staff 2'] && (
                          <motion.div
                            whileHover={{ scale: 1.02, x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => handleStaffClick(selectedEvent['Assigned Staff 2'], e)}
                            className="flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 text-sm font-bold">
                              {selectedEvent['Assigned Staff 2'].charAt(0)}
                            </div>
                            <span className="text-white">{selectedEvent['Assigned Staff 2']}</span>
                            <span className="ml-auto text-xs text-orange-400">View Stats →</span>
                          </motion.div>
                        )}
                        {!selectedEvent['Assigned Staff 1'] && !selectedEvent['Assigned Staff 2'] && (
                          <p className="text-gray-500">No staff assigned</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { setSelectedEvent(null); setEditMode(false) }}
                  className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff Stats Modal */}
      <AnimatePresence>
        {selectedStaff && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedStaff(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-md w-full overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-400" />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                    {selectedStaff.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedStaff.name}</h2>
                    <p className="text-gray-400">{selectedStaff.role || 'Agent'} • {selectedStaff.status}</p>
                  </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{selectedStaff.kpis?.totalDeals || 0}</p>
                    <p className="text-xs text-gray-400">Total Deals</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{selectedStaff.kpis?.closedDeals || 0}</p>
                    <p className="text-xs text-gray-400">Closed</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">{selectedStaff.kpis?.executedDeals || 0}</p>
                    <p className="text-xs text-gray-400">Executed</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-400">{selectedStaff.kpis?.pendingDeals || 0}</p>
                    <p className="text-xs text-gray-400">Pending</p>
                  </div>
                </div>

                {/* Volume Stats */}
                <div className="space-y-2 bg-gray-800 rounded-xl p-4">
                  <div className="flex justify-between py-1.5 border-b border-gray-700">
                    <span className="text-gray-400 text-sm">Total Volume</span>
                    <span className="text-white font-semibold">{formatCurrency(selectedStaff.kpis?.totalVolume)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-700">
                    <span className="text-gray-400 text-sm">Closed Volume</span>
                    <span className="text-emerald-400 font-semibold">{formatCurrency(selectedStaff.kpis?.closedVolume)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-700">
                    <span className="text-gray-400 text-sm">Avg Deal Size</span>
                    <span className="text-white font-semibold">{formatCurrency(selectedStaff.kpis?.avgDealSize)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-400 text-sm">Closing Rate</span>
                    <span className={`font-semibold ${(selectedStaff.kpis?.closingRate || 0) >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedStaff.kpis?.closingRate || 0}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                {selectedStaff.kpis?.totalDeals > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Pipeline Progress</span>
                      <span>{selectedStaff.kpis?.closedDeals}/{selectedStaff.kpis?.totalDeals}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedStaff.kpis?.closingRate || 0}%` }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedStaff(null)}
                  className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Events Modal (Show More) */}
      <AnimatePresence>
        {selectedDayEvents && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDayEvents(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[80vh] overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-400" />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">📅</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {monthNames[month]} {selectedDayEvents.day}, {year}
                    </h2>
                    <p className="text-gray-400">{selectedDayEvents.events.length} scheduled shifts</p>
                  </div>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                  {selectedDayEvents.events.map((event, idx) => (
                    <motion.div
                      key={event.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setSelectedDayEvents(null)
                        setSelectedEvent(event)
                      }}
                      className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-700/50 transition-colors group"
                    >
                      <p className="text-white font-medium">{event['Model Home Address'] || 'Scheduled Shift'}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {event['Assigned Staff 1'] && (
                          <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
                            👤 {event['Assigned Staff 1']}
                          </span>
                        )}
                        {event['Assigned Staff 2'] && (
                          <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
                            👤 {event['Assigned Staff 2']}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to view details & edit staff →
                      </p>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedDayEvents(null)}
                  className="mt-6 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
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

export default ScheduleCalendar
