import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'
import {
  ScheduleEventModal,
  WeekSubmissionPanel,
  DaySelectionModal,
  AdminListView,
  ScheduleStatusBanners,
  AdminPendingPanel,
  ScheduleLegend,
  getStatusColor,
  getStatusBadgeColor
} from './schedule'

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
  const [selectedDay, setSelectedDay] = useState(null) // Day click modal for employees (legacy)
  const [selectedDays, setSelectedDays] = useState([]) // Multi-day selection for week submission
  const [selectedEvent, setSelectedEvent] = useState(null) // Event detail modal
  const [pendingRequests, setPendingRequests] = useState([]) // Current week's pending requests (for validation)

  // Form states
  const [selectedModelHome, setSelectedModelHome] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [denyNotes, setDenyNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(null) // Track which action is loading

  // Admin filter and settings
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('calendar') // calendar or list
  const [editingOpenDay, setEditingOpenDay] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const isAdmin = user?.role === 'admin'
  // HttpOnly cookies handle auth automatically via withCredentials in api.js

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
        api.get('/api/databases/schedule'),
        api.get('/api/databases/PROPERTIES'),
        api.get('/api/databases/schedule?settings=true').catch(() => ({ data: { scheduleOpenDay: 15 } }))
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

  // Check if displayed calendar is next month ONLY (employees can only edit next month, not any future month)
  const today = new Date()
  const isFutureMonth = (year > today.getFullYear()) || (year === today.getFullYear() && month > today.getMonth())
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  // Calculate exactly what "next month" is
  const nextMonthIndex = today.getMonth() === 11 ? 0 : today.getMonth() + 1
  const nextMonthYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear()
  const isNextMonth = year === nextMonthYear && month === nextMonthIndex

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
      await api.post('/api/databases/schedule', {
        date: dateStr,
        modelHome: selectedModelHome.Address || selectedModelHome.address || selectedModelHome.Name,
        modelHomeId: selectedModelHome.id,
        employeeId: user?.teamMemberId || user?.id,
        employeeName: user?.fullName || user?.name || user?.email
      })

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

  // Toggle day selection for week submission
  const toggleDaySelection = (day) => {
    const dateStr = getISODate(day)
    setSelectedDays(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr)
      } else {
        return [...prev, dateStr]
      }
    })
  }

  // Submit all selected days for the week
  const handleSubmitWeek = async () => {
    if (!selectedModelHome) {
      alert('Please select a Model Home first')
      return
    }
    if (selectedDays.length === 0) {
      alert('Please select at least one day')
      return
    }

    // Validate 3-5 day rule
    if (selectedDays.length < 3) {
      const proceed = window.confirm(
        `⚠️ MINIMUM NOT MET\n\n` +
        `You've selected ${selectedDays.length} day(s).\n` +
        `Minimum required: 3 days per week.\n\n` +
        `Do you want to continue anyway?`
      )
      if (!proceed) return
    }
    if (selectedDays.length > 5) {
      alert('❌ Maximum 5 days per week allowed. Please deselect some days.')
      return
    }

    setSubmitting(true)
    try {
      const modelHomeAddress = selectedModelHome.Address || selectedModelHome.address || selectedModelHome.Name

      // Submit all selected days
      for (const dateStr of selectedDays) {
        await api.post('/api/databases/schedule', {
          date: dateStr,
          modelHome: modelHomeAddress,
          modelHomeId: selectedModelHome.id,
          employeeId: user?.teamMemberId || user?.id,
          employeeName: user?.fullName || user?.name || user?.email
        })
      }

      await fetchData()
      setSelectedDays([])
      setSelectedModelHome(null)
      alert(`✓ Schedule request submitted for ${selectedDays.length} days! Awaiting admin approval.`)
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
      const result = await api.patch('/api/databases/schedule', {
        action: 'approve',
        scheduleId
      })

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
      await api.patch('/api/databases/schedule', {
        action: 'deny',
        scheduleId,
        notes: denyNotes || undefined
      })

      await fetchData()
      setSelectedEvent(null)
      setDenyNotes('')
    } catch (err) {
      alert('Failed to deny: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  // Admin: Save schedule open day setting
  const saveScheduleOpenDay = async (newDay) => {
    if (newDay < 1 || newDay > 28) {
      alert('Open day must be between 1-28')
      return
    }
    setSavingSettings(true)
    try {
      await api.patch('/api/databases/schedule', {
        action: 'update-settings',
        scheduleOpenDay: newDay
      })
      setScheduleOpenDay(newDay)
      setEditingOpenDay(false)
      alert(`Schedule open day updated to the ${newDay}${newDay === 1 ? 'st' : newDay === 2 ? 'nd' : newDay === 3 ? 'rd' : 'th'} of each month`)
    } catch (err) {
      alert('Failed to save setting: ' + (err.response?.data?.error || err.message))
    } finally {
      setSavingSettings(false)
    }
  }

  // Filter schedule data based on status (memoized for performance)
  const filteredSchedule = useMemo(() => {
    if (statusFilter === 'all') return scheduleData
    return scheduleData.filter(item => item.status?.toLowerCase() === statusFilter)
  }, [scheduleData, statusFilter])

  // Build calendar grid (memoized to prevent recalculation)
  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < startingDay; i++) days.push(null)
    for (let day = 1; day <= daysInMonth; day++) days.push(day)
    return days
  }, [startingDay, daysInMonth])

  // Pending requests count (memoized for admin)
  const pendingCount = useMemo(() =>
    scheduleData.filter(s => s.status === 'Pending').length
  , [scheduleData])

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

              {/* Schedule Open Day Setting */}
              <div className="flex items-center gap-2">
                {editingOpenDay ? (
                  <>
                    <select
                      value={scheduleOpenDay}
                      onChange={(e) => setScheduleOpenDay(parseInt(e.target.value))}
                      className="px-2 py-2 bg-gray-800 border border-amber-500 rounded-lg text-sm text-white w-16"
                      disabled={savingSettings}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => saveScheduleOpenDay(scheduleOpenDay)}
                      disabled={savingSettings}
                      className="px-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg disabled:opacity-50"
                    >
                      {savingSettings ? '...' : '✓'}
                    </button>
                    <button
                      onClick={() => setEditingOpenDay(false)}
                      className="px-2 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
                    >
                      ✗
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingOpenDay(true)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white flex items-center gap-1"
                    title="Set schedule open day"
                  >
                    🔓 Opens: {scheduleOpenDay}th
                  </button>
                )}
              </div>
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
        <ScheduleStatusBanners
          scheduleIsOpen={scheduleIsOpen}
          scheduleOpenDay={scheduleOpenDay}
          isCurrentMonth={isCurrentMonth}
          isNextMonth={isNextMonth}
          isFutureMonth={isFutureMonth}
          nextMonthIndex={nextMonthIndex}
          nextMonthYear={nextMonthYear}
        />
      )}

      {/* Admin: Pending Requests Panel */}
      {isAdmin && viewMode === 'calendar' && (
        <AdminPendingPanel
          pendingCount={pendingCount}
          scheduleData={scheduleData}
          setSelectedEvent={setSelectedEvent}
        />
      )}

      {/* List View (Admin) */}
      {isAdmin && viewMode === 'list' ? (
        <AdminListView
          filteredSchedule={filteredSchedule}
          handleApprove={handleApprove}
          setSelectedEvent={setSelectedEvent}
          actionLoading={actionLoading}
        />
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

              const isSelected = day && selectedDays.includes(getISODate(day))

              // Employee can only select days in NEXT month (not current, not 2+ months ahead)
              const canEmployeeEdit = !past && !isAdmin && scheduleIsOpen && isNextMonth

              const isClickable = (day && canEmployeeEdit) || (day && isAdmin && pendingEvents.length > 0)

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (day && canEmployeeEdit) {
                      toggleDaySelection(day)
                    } else if (day && isAdmin && pendingEvents.length > 0) {
                      setSelectedEvent(pendingEvents[0])
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
                      e.preventDefault()
                      if (canEmployeeEdit) {
                        toggleDaySelection(day)
                      } else if (isAdmin && pendingEvents.length > 0) {
                        setSelectedEvent(pendingEvents[0])
                      }
                    }
                  }}
                  tabIndex={isClickable ? 0 : -1}
                  role={isClickable ? 'button' : undefined}
                  aria-label={day ? `${monthNames[month]} ${day}${isSelected ? ', selected' : ''}${pendingEvents.length > 0 ? `, ${pendingEvents.length} pending request${pendingEvents.length > 1 ? 's' : ''}` : ''}` : undefined}
                  aria-pressed={isSelected}
                  className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                    ${!day ? 'bg-gray-900/30' : ''}
                    ${past ? 'opacity-50' : ''}
                    ${isSelected ? 'bg-amber-500/20 ring-2 ring-amber-500/50 ring-inset' : ''}
                    ${day && canEmployeeEdit ? 'cursor-pointer hover:bg-gray-700/30' : ''}
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
      <ScheduleLegend isAdmin={isAdmin} />

      {/* Employee: Week Submission Section - Only show for NEXT month */}
      {!isAdmin && scheduleIsOpen && isNextMonth && (
        <WeekSubmissionPanel
          selectedDays={selectedDays}
          setSelectedDays={setSelectedDays}
          selectedModelHome={selectedModelHome}
          setSelectedModelHome={setSelectedModelHome}
          modelHomes={modelHomes}
          submitting={submitting}
          handleSubmitWeek={handleSubmitWeek}
        />
      )}

      {/* Employee: Day Selection Modal */}
      {!isAdmin && (
        <DaySelectionModal
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          selectedModelHome={selectedModelHome}
          setSelectedModelHome={setSelectedModelHome}
          modelHomes={modelHomes}
          month={month}
          year={year}
          getUserWeekRequests={getUserWeekRequests}
          isSlotTaken={isSlotTaken}
          getUserPendingForSlot={getUserPendingForSlot}
          handleSubmitRequest={handleSubmitRequest}
          submitting={submitting}
        />
      )}

      {/* Event Detail Modal (Both Admin & Employee) */}
      <ScheduleEventModal
        selectedEvent={selectedEvent}
        onClose={() => { setSelectedEvent(null); setDenyNotes('') }}
        isAdmin={isAdmin}
        denyNotes={denyNotes}
        setDenyNotes={setDenyNotes}
        handleApprove={handleApprove}
        handleDeny={handleDeny}
        actionLoading={actionLoading}
      />
    </div>
  )
}

export default ScheduleCalendar
