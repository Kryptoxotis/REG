import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

function ScheduleCalendar({ user, onNavigate }) {
  const [scheduleData, setScheduleData] = useState([])
  const [modelHomes, setModelHomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())

  // Schedule open date setting
  const [scheduleOpenDay, setScheduleOpenDay] = useState(15) // Default: 15th of month
  const [scheduleIsOpen, setScheduleIsOpen] = useState(false)

  // Modal states
  const [selectedDay, setSelectedDay] = useState(null) // Day click modal for employees
  const [selectedEvent, setSelectedEvent] = useState(null) // Event detail modal
  const [pendingRequests, setPendingRequests] = useState([]) // Current week's pending requests (for validation)

  // Form states
  const [selectedModelHome, setSelectedModelHome] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [denyNotes, setDenyNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(null) // Track which action is loading

  // Admin filter
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('calendar') // calendar or list

  const isAdmin = user?.role === 'admin'
  const token = localStorage.getItem('authToken')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  // Check if schedule is currently open
  useEffect(() => {
    const today = new Date()
    const currentDay = today.getDate()
    // Schedule is open from open day until end of month
    setScheduleIsOpen(currentDay >= scheduleOpenDay || isAdmin)
  }, [scheduleOpenDay, isAdmin])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [scheduleRes, propertiesRes, settingsRes] = await Promise.all([
        axios.get('/api/databases/schedule', { headers }),
        axios.get('/api/databases/PROPERTIES', { headers }),
        axios.get('/api/databases/schedule?settings=true', { headers }).catch(() => ({ data: { scheduleOpenDay: 15 } }))
      ])
      setScheduleData(Array.isArray(scheduleRes.data) ? scheduleRes.data : [])
      // Filter properties to only show Model Homes (Status = "Model Home")
      const allProperties = Array.isArray(propertiesRes.data) ? propertiesRes.data : []
      const modelHomesList = allProperties.filter(p =>
        p.Status === 'Model Home' || p.Status === 'Model' ||
        p.status === 'Model Home' || p.status === 'Model'
      )
      setModelHomes(modelHomesList)
      if (settingsRes.data?.scheduleOpenDay) {
        setScheduleOpenDay(settingsRes.data.scheduleOpenDay)
      }
    } catch (err) {
      console.error('Schedule fetch error:', err)
      setError(err.response?.data?.error || 'Failed to fetch schedule')
    } finally { setLoading(false) }
  }

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return { daysInMonth: lastDay.getDate(), startingDay: firstDay.getDay(), year, month }
  }

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentDate)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToToday = () => setCurrentDate(new Date())

  // Parse date from schedule entry
  const parseDate = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), date: d }
  }

  // Get ISO date string for a day
  const getISODate = (day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Get events for a specific day
  const getEventsForDay = (day) => {
    const targetDate = getISODate(day)
    return scheduleData.filter(item => {
      if (!item.date) return false
      return item.date.startsWith(targetDate)
    })
  }

  // Get week boundaries (Sunday to Saturday) - returns ISO date strings for comparison
  const getWeekBounds = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00') // Noon to avoid timezone issues
    const dayOfWeek = d.getDay()
    const sunday = new Date(d)
    sunday.setDate(d.getDate() - dayOfWeek)
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)

    // Return as ISO date strings for easy comparison
    const sundayStr = sunday.toISOString().split('T')[0]
    const saturdayStr = saturday.toISOString().split('T')[0]
    return { sunday: sundayStr, saturday: saturdayStr }
  }

  // Count user's requests for a week (approved + pending only)
  const getUserWeekRequests = (dateStr) => {
    const { sunday, saturday } = getWeekBounds(dateStr)
    const userId = user?.teamMemberId || user?.id
    const userEmail = user?.email?.toLowerCase()
    const userName = (user?.fullName || user?.name || '')?.toLowerCase()

    return scheduleData.filter(item => {
      if (!item.date) return false
      const itemDate = item.date.split('T')[0] // Get just the date part

      // Check if date is within week bounds
      if (itemDate < sunday || itemDate > saturday) return false

      // Skip denied requests - they don't count
      if (item.status === 'Denied') return false

      // Match by employee ID
      if (userId && item.employeeId === userId) return true

      // Match by email (most reliable)
      if (userEmail && item.employeeName?.toLowerCase() === userEmail) return true

      // Match by name
      if (userName && item.employeeName?.toLowerCase() === userName) return true
      if (userName && item.employeeName?.toLowerCase()?.includes(userName)) return true

      return false
    })
  }

  // Check if slot is already taken (Approved by someone else)
  const isSlotTaken = (dateStr, modelHomeAddress) => {
    return scheduleData.find(item =>
      item.date?.startsWith(dateStr) &&
      item.modelHome === modelHomeAddress &&
      item.status === 'Approved'
    )
  }

  // Check if user has pending request for this slot
  const getUserPendingForSlot = (dateStr, modelHomeAddress) => {
    const userName = user?.fullName || user?.name || user?.email
    return scheduleData.find(item =>
      item.date?.startsWith(dateStr) &&
      item.modelHome === modelHomeAddress &&
      item.status === 'Pending' &&
      item.employeeName?.toLowerCase().includes(userName?.toLowerCase())
    )
  }

  const isToday = (day) => {
    const today = new Date()
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  }

  const isPastDay = (day) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(year, month, day)
    return checkDate < today
  }

  // Submit schedule request
  const handleSubmitRequest = async () => {
    if (!selectedModelHome || !selectedDay) return

    const dateStr = getISODate(selectedDay)
    const weekRequests = getUserWeekRequests(dateStr)
    const currentCount = weekRequests.length

    // STRICT: Block if already at 5-day maximum
    if (currentCount >= 5) {
      alert(
        '❌ MAXIMUM REACHED\n\n' +
        'You already have 5 days scheduled this week.\n' +
        'Maximum allowed: 5 days per week (Sun-Sat).\n\n' +
        'You cannot add more shifts this week.'
      )
      return
    }

    // WARNING: If this will leave them under minimum, require confirmation
    const newTotal = currentCount + 1
    if (newTotal < 3) {
      const daysNeeded = 3 - newTotal
      const proceed = window.confirm(
        `⚠️ MINIMUM NOT MET\n\n` +
        `After this request, you'll have ${newTotal} day(s) this week.\n` +
        `Minimum required: 3 days per week.\n\n` +
        `You still need to schedule ${daysNeeded} more day(s) to meet the weekly minimum.\n\n` +
        `Do you want to continue and add more shifts after?`
      )
      if (!proceed) return
    }

    setSubmitting(true)
    try {
      await axios.post('/api/databases/schedule', {
        date: dateStr,
        modelHome: selectedModelHome.Address || selectedModelHome.address || selectedModelHome.Name,
        modelHomeId: selectedModelHome.id,
        employeeId: user?.teamMemberId || user?.id,
        employeeName: user?.fullName || user?.name || user?.email
      }, { headers })

      await fetchData()
      setSelectedDay(null)
      setSelectedModelHome(null)
      alert('Schedule request submitted! Awaiting admin approval.')
    } catch (err) {
      alert('Failed to submit request: ' + (err.response?.data?.error || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  // Admin: Approve request
  const handleApprove = async (scheduleId) => {
    setActionLoading(scheduleId)
    try {
      const result = await axios.patch('/api/databases/schedule', {
        action: 'approve',
        scheduleId
      }, { headers })

      await fetchData()
      setSelectedEvent(null)

      if (result.data.conflictsDenied > 0) {
        alert(`Approved! ${result.data.conflictsDenied} conflicting request(s) were auto-denied.`)
      }
    } catch (err) {
      alert('Failed to approve: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  // Admin: Deny request
  const handleDeny = async (scheduleId) => {
    setActionLoading(scheduleId)
    try {
      await axios.patch('/api/databases/schedule', {
        action: 'deny',
        scheduleId,
        notes: denyNotes || undefined
      }, { headers })

      await fetchData()
      setSelectedEvent(null)
      setDenyNotes('')
    } catch (err) {
      alert('Failed to deny: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  // Filter schedule data based on status
  const filteredSchedule = useMemo(() => {
    if (statusFilter === 'all') return scheduleData
    return scheduleData.filter(item => item.status?.toLowerCase() === statusFilter)
  }, [scheduleData, statusFilter])

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
      case 'pending': return 'bg-amber-500/20 border-amber-500/30 text-amber-400'
      case 'denied': return 'bg-red-500/20 border-red-500/30 text-red-400'
      default: return 'bg-gray-500/20 border-gray-500/30 text-gray-400'
    }
  }

  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-500'
      case 'pending': return 'bg-amber-500'
      case 'denied': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Build calendar grid
  const calendarDays = []
  for (let i = 0; i < startingDay; i++) calendarDays.push(null)
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day)

  // Pending requests count (for admin)
  const pendingCount = scheduleData.filter(s => s.status === 'Pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">Loading schedule...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Try Again</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {isAdmin ? 'Schedule Management' : 'Request Schedule'}
          </h2>
          <p className="text-sm text-gray-400">
            {isAdmin
              ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''} • ${scheduleData.length} total`
              : 'Select dates and model homes to request shifts'
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
              </select>
              <button
                onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white"
              >
                {viewMode === 'calendar' ? '📋 List' : '📅 Calendar'}
              </button>
            </>
          )}
          <button onClick={goToToday} className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg">
            Today
          </button>
          <button onClick={fetchData} className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white">
            🔄
          </button>
        </div>
      </div>

      {/* Employee: Schedule status and rules */}
      {!isAdmin && (
        <div className="space-y-3">
          {/* Schedule Open/Closed Banner */}
          {!scheduleIsOpen ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <span className="text-lg">🔒</span>
                <span>
                  <strong>Schedule Locked</strong> - Opens on the {scheduleOpenDay}th of each month.
                  You can view the calendar but cannot submit requests until then.
                </span>
              </p>
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-sm text-green-400 flex items-center gap-2">
                <span className="text-lg">🔓</span>
                <span><strong>Schedule Open</strong> - Click on any future date to request a shift.</span>
              </p>
            </div>
          )}

          {/* Rules */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-300">
              <span className="text-amber-400 font-medium">📌 Rules:</span> You must schedule at least 3 days per week (minimum) and no more than 5 days per week (maximum).
            </p>
          </div>
        </div>
      )}

      {/* Admin: Pending Requests Panel */}
      {isAdmin && pendingCount > 0 && viewMode === 'calendar' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
        >
          <h3 className="text-amber-400 font-semibold mb-3">⏳ Pending Requests ({pendingCount})</h3>
          <div className="grid gap-2 max-h-40 overflow-y-auto">
            {scheduleData.filter(s => s.status === 'Pending').slice(0, 5).map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedEvent(item)}
                className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-700/50"
              >
                <div>
                  <p className="text-white text-sm font-medium">{item.employeeName || 'Unknown'}</p>
                  <p className="text-gray-400 text-xs">{item.modelHome} • {new Date(item.date).toLocaleDateString()}</p>
                </div>
                <span className="text-amber-400 text-xs">Review →</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* List View (Admin) */}
      {isAdmin && viewMode === 'list' ? (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Model Home</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredSchedule.map(item => (
                  <tr key={item.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-white">{item.employeeName || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-300">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-300">{item.modelHome}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={actionLoading === item.id}
                            className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setSelectedEvent(item)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
                          >
                            ✗
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-xl font-bold text-white">{monthNames[month]} {year}</h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
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
              const today = isToday(day)
              const past = isPastDay(day)
              const approvedEvents = events.filter(e => e.status === 'Approved')
              const pendingEvents = events.filter(e => e.status === 'Pending')
              const deniedEvents = events.filter(e => e.status === 'Denied')

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (day && !past && !isAdmin && scheduleIsOpen) {
                      setSelectedDay(day)
                    } else if (day && isAdmin && pendingEvents.length > 0) {
                      setSelectedEvent(pendingEvents[0])
                    }
                  }}
                  className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r border-gray-700/50
                    ${!day ? 'bg-gray-900/30' : ''}
                    ${past ? 'opacity-50' : ''}
                    ${day && !past && !isAdmin && scheduleIsOpen ? 'cursor-pointer hover:bg-gray-700/30' : ''}
                    ${day && isAdmin && pendingEvents.length > 0 ? 'cursor-pointer hover:bg-amber-500/10' : ''}
                  `}
                >
                  {day && (
                    <>
                      <div className={`text-right mb-1 ${today ? 'font-bold' : ''}`}>
                        <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm
                          ${today ? 'bg-amber-500 text-white' : 'text-gray-400'}
                        `}>
                          {day}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {/* Approved events - greyed out */}
                        {approvedEvents.slice(0, 1).map((event, i) => (
                          <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(event) }}
                            className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-[9px] sm:text-[10px] text-emerald-400 truncate cursor-pointer"
                          >
                            ✓ {event.employeeName?.split(' ')[0] || 'Taken'}
                          </div>
                        ))}
                        {/* Pending events - yellow */}
                        {pendingEvents.slice(0, 1).map((event, i) => (
                          <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(event) }}
                            className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] sm:text-[10px] text-amber-400 truncate cursor-pointer"
                          >
                            ⏳ {event.employeeName?.split(' ')[0] || 'Pending'}
                          </div>
                        ))}
                        {/* Denied events - red */}
                        {deniedEvents.slice(0, 1).map((event, i) => (
                          <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(event) }}
                            className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[9px] sm:text-[10px] text-red-400 truncate cursor-pointer"
                          >
                            ✗ {event.employeeName?.split(' ')[0] || 'Denied'}
                          </div>
                        ))}
                        {/* More indicator */}
                        {events.length > 3 && (
                          <div className="text-[9px] text-gray-500 pl-1">+{events.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-500/50"></span>
          <span>Approved (Taken)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500/50"></span>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500/50"></span>
          <span>Denied</span>
        </div>
        {!isAdmin && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-gray-700"></span>
            <span>Click to Request</span>
          </div>
        )}
      </div>

      {/* Employee: Day Selection Modal */}
      <AnimatePresence>
        {selectedDay && !isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelectedDay(null); setSelectedModelHome(null) }}
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
                <h2 className="text-xl font-bold text-white mb-1">
                  {monthNames[month]} {selectedDay}, {year}
                </h2>
                <p className="text-gray-400 text-sm mb-6">Select a Model Home to request this shift</p>

                {/* Week status - prominent display */}
                {(() => {
                  const weekRequests = getUserWeekRequests(getISODate(selectedDay))
                  const count = weekRequests.length
                  const isAtMax = count >= 5
                  const isUnderMin = count < 3
                  const willBeUnderMin = count + 1 < 3

                  return (
                    <div className={`mb-4 p-4 rounded-xl border ${
                      isAtMax ? 'bg-red-500/10 border-red-500/30' :
                      isUnderMin ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-emerald-500/10 border-emerald-500/30'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">This Week's Schedule</span>
                        <span className={`text-lg font-bold ${
                          isAtMax ? 'text-red-400' :
                          isUnderMin ? 'text-amber-400' :
                          'text-emerald-400'
                        }`}>{count}/5 days</span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all ${
                            isAtMax ? 'bg-red-500' :
                            count >= 3 ? 'bg-emerald-500' :
                            'bg-amber-500'
                          }`}
                          style={{ width: `${(count / 5) * 100}%` }}
                        />
                        {/* Minimum marker at 3/5 = 60% */}
                        <div className="relative -mt-2 h-2">
                          <div className="absolute left-[60%] w-0.5 h-2 bg-white/50" title="Minimum: 3 days" />
                        </div>
                      </div>

                      {/* Status message */}
                      {isAtMax ? (
                        <p className="text-xs text-red-400 font-medium">
                          ❌ Maximum reached - Cannot add more shifts this week
                        </p>
                      ) : isUnderMin ? (
                        <p className="text-xs text-amber-400">
                          ⚠️ Need {3 - count} more day(s) to meet minimum (3 required)
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-400">
                          ✓ Minimum met - Can add {5 - count} more day(s)
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Model Homes List */}
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {modelHomes.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No model homes available</p>
                  ) : (
                    modelHomes.map(home => {
                      const dateStr = getISODate(selectedDay)
                      const address = home.Address || home.address || home.Name || 'Unknown'
                      const taken = isSlotTaken(dateStr, address)
                      const userPending = getUserPendingForSlot(dateStr, address)
                      const isSelected = selectedModelHome?.id === home.id

                      return (
                        <div
                          key={home.id}
                          onClick={() => {
                            if (!taken && !userPending) setSelectedModelHome(home)
                          }}
                          className={`p-4 rounded-xl border transition-all ${
                            taken
                              ? 'bg-gray-800/30 border-gray-700 opacity-50 cursor-not-allowed'
                              : userPending
                                ? 'bg-amber-500/10 border-amber-500/30 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-amber-500/20 border-amber-500 cursor-pointer'
                                  : 'bg-gray-800 border-gray-700 hover:border-gray-600 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">{address}</p>
                              <p className="text-gray-400 text-xs mt-1">
                                {home.Subdivision || home.City || ''}
                              </p>
                            </div>
                            {taken && (
                              <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                                Taken by {taken.employeeName?.split(' ')[0] || 'Someone'}
                              </span>
                            )}
                            {userPending && (
                              <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded">
                                You: Pending
                              </span>
                            )}
                            {isSelected && !taken && !userPending && (
                              <span className="text-amber-400">✓ Selected</span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  {(() => {
                    const weekRequests = getUserWeekRequests(getISODate(selectedDay))
                    const isAtMax = weekRequests.length >= 5
                    return (
                      <button
                        onClick={handleSubmitRequest}
                        disabled={!selectedModelHome || submitting || isAtMax}
                        className={`flex-1 py-3 font-medium rounded-xl transition-colors ${
                          isAtMax
                            ? 'bg-red-900/50 text-red-400 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white'
                        }`}
                      >
                        {submitting ? 'Submitting...' : isAtMax ? 'Max 5 Days Reached' : 'Submit Request'}
                      </button>
                    )
                  })()}
                  <button
                    onClick={() => { setSelectedDay(null); setSelectedModelHome(null) }}
                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Detail Modal (Both Admin & Employee) */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelectedEvent(null); setDenyNotes('') }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700 max-w-md w-full overflow-hidden"
            >
              <div className={`h-2 ${
                selectedEvent.status === 'Approved' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                selectedEvent.status === 'Denied' ? 'bg-gradient-to-r from-red-500 to-rose-400' :
                'bg-gradient-to-r from-amber-500 to-orange-400'
              }`} />
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      selectedEvent.status === 'Approved' ? 'bg-emerald-500/20' :
                      selectedEvent.status === 'Denied' ? 'bg-red-500/20' :
                      'bg-amber-500/20'
                    }`}>
                      {selectedEvent.status === 'Approved' ? '✓' : selectedEvent.status === 'Denied' ? '✗' : '⏳'}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedEvent.employeeName || 'Unknown'}</h2>
                      <p className="text-gray-400 text-sm">
                        {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEvent.status)}`}>
                    {selectedEvent.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Model Home</p>
                    <p className="text-white font-medium">{selectedEvent.modelHome || 'Not specified'}</p>
                  </div>

                  {selectedEvent.submittedAt && (
                    <div className="bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Submitted</p>
                      <p className="text-gray-300">{new Date(selectedEvent.submittedAt).toLocaleString()}</p>
                    </div>
                  )}

                  {selectedEvent.reviewedAt && (
                    <div className="bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Reviewed</p>
                      <p className="text-gray-300">{new Date(selectedEvent.reviewedAt).toLocaleString()}</p>
                    </div>
                  )}

                  {selectedEvent.notes && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                      <p className="text-xs text-red-400 uppercase tracking-wider mb-1">Notes</p>
                      <p className="text-red-300">{selectedEvent.notes}</p>
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                {isAdmin && selectedEvent.status === 'Pending' && (
                  <div className="mt-6 space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Denial Notes (optional)</label>
                      <input
                        type="text"
                        value={denyNotes}
                        onChange={(e) => setDenyNotes(e.target.value)}
                        placeholder="Reason for denial..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(selectedEvent.id)}
                        disabled={actionLoading === selectedEvent.id}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                      >
                        {actionLoading === selectedEvent.id ? '...' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => handleDeny(selectedEvent.id)}
                        disabled={actionLoading === selectedEvent.id}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                      >
                        {actionLoading === selectedEvent.id ? '...' : '✗ Deny'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setSelectedEvent(null); setDenyNotes('') }}
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
