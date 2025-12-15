import { useState, useEffect } from 'react'
import axios from 'axios'
import { useStatsOverview } from '../hooks/useApi'
import { useToast } from '../components/Toast'
import StatsOverview from '../components/StatsOverview'
import ScheduleCalendar from '../components/ScheduleCalendar'
import { ActivityLogger } from '../utils/activityLogger'

function EmployeeDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('schedule')
  const toast = useToast()

  // Log tab navigation
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    const tabNames = { schedule: 'Schedule Shifts', overview: 'Employee Dashboard' }
    ActivityLogger.navigate(tabNames[tabId] || tabId)
  }

  // Use React Query for stats (cached, auto-refresh)
  const { data: stats, isLoading: loading, error: statsError } = useStatsOverview()

  // Show toast on stats error
  useEffect(() => {
    if (statsError) {
      toast.error('Failed to load dashboard overview')
    }
  }, [statsError])

  const handleLogout = async () => {
    const token = localStorage.getItem('authToken')
    try {
      await axios.post('/api/auth/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (error) {
      console.error('Logout API failed:', error)
    } finally {
      setUser(null)
    }
  }

  const tabs = [
    { id: 'schedule', name: 'Schedule Shifts', icon: '📅' },
    { id: 'overview', name: 'Dashboard', icon: '📊' }
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">🏠</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">REG Portal</h1>
              <p className="text-sm text-gray-500">Employee Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-200">{user.fullName || 'Employee'}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
              🚪 Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white border-t border-x border-gray-700'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'schedule' ? (
          <>
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-6 sm:p-8 text-white mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold">Welcome back, {user.fullName?.split(' ')[0] || 'there'}!</h2>
              <p className="text-white/80 mt-2">Request your Model Home shifts below. Select dates and choose available homes.</p>
            </div>

            {/* Schedule Calendar */}
            <ScheduleCalendar user={user} />
          </>
        ) : (
          <>
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold">Dashboard Overview</h2>
              <p className="text-white/80 mt-2">View company statistics and team performance.</p>
            </div>

            {/* Stats */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Company Stats</h3>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <StatsOverview stats={stats} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default EmployeeDashboard
