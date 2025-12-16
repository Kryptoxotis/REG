// Schedule calendar constants and helpers

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Get status color classes
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved': return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
    case 'pending': return 'bg-amber-500/20 border-amber-500/30 text-amber-400'
    case 'denied': return 'bg-red-500/20 border-red-500/30 text-red-400'
    default: return 'bg-gray-500/20 border-gray-500/30 text-gray-400'
  }
}

export const getStatusBadgeColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved': return 'bg-emerald-500'
    case 'pending': return 'bg-amber-500'
    case 'denied': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

// Calendar helpers
export const getDaysInMonth = (date) => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  return {
    daysInMonth: lastDay.getDate(),
    startingDay: firstDay.getDay(),
    year,
    month
  }
}

// Get ISO date string for a specific day in the given month/year
export const getISODate = (year, month, day) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Get week boundaries (Sunday to Saturday)
export const getWeekBounds = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  const dayOfWeek = d.getDay()
  const sunday = new Date(d)
  sunday.setDate(d.getDate() - dayOfWeek)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)

  return {
    sunday: sunday.toISOString().split('T')[0],
    saturday: saturday.toISOString().split('T')[0]
  }
}

// Check if a day is today
export const isToday = (day, month, year) => {
  const today = new Date()
  return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
}

// Check if a day is in the past
export const isPastDay = (day, month, year) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(year, month, day)
  return checkDate < today
}
