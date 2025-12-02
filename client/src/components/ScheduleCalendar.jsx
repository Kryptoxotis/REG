import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

function ScheduleCalendar() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get('/api/databases/SCHEDULE', { withCredentials: true })
      setData(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch schedule')
    } finally { setLoading(false) }
  }

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

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return data.filter(item => {
      const itemDate = item.Date?.start || item.Date
      if (!itemDate) return false
      return itemDate.startsWith(dateStr)
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
        <p className="text-red-400">{error}</p>
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
                        <div className="text-[10px] sm:text-xs text-gray-500 pl-1">
                          +{events.length - 2} more
                        </div>
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
              const itemDate = item.Date?.start || item.Date
              return itemDate && new Date(itemDate) >= new Date(new Date().setHours(0,0,0,0))
            })
            .sort((a, b) => {
              const dateA = a.Date?.start || a.Date
              const dateB = b.Date?.start || b.Date
              return new Date(dateA) - new Date(dateB)
            })
            .slice(0, 10)
            .map((event, idx) => {
              const eventDate = event.Date?.start || event.Date
              const date = new Date(eventDate)
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
            const itemDate = item.Date?.start || item.Date
            return itemDate && new Date(itemDate) >= new Date(new Date().setHours(0,0,0,0))
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
                        const d = selectedEvent.Date?.start || selectedEvent.Date
                        if (!d) return 'No date'
                        const date = new Date(d)
                        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                      })()}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedEvent['Model Home Address'] && (
                    <div className="bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Location</p>
                      <p className="text-white font-medium">{selectedEvent['Model Home Address']}</p>
                    </div>
                  )}

                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Assigned Staff</p>
                    <div className="space-y-2">
                      {selectedEvent['Assigned Staff 1'] && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-sm font-bold">
                            {selectedEvent['Assigned Staff 1'].charAt(0)}
                          </div>
                          <span className="text-white">{selectedEvent['Assigned Staff 1']}</span>
                        </div>
                      )}
                      {selectedEvent['Assigned Staff 2'] && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 text-sm font-bold">
                            {selectedEvent['Assigned Staff 2'].charAt(0)}
                          </div>
                          <span className="text-white">{selectedEvent['Assigned Staff 2']}</span>
                        </div>
                      )}
                      {!selectedEvent['Assigned Staff 1'] && !selectedEvent['Assigned Staff 2'] && (
                        <p className="text-gray-500">No staff assigned</p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEvent(null)}
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
