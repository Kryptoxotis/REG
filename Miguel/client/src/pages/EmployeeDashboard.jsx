import { useState, useEffect } from 'react'
import axios from 'axios'
import StatsOverview from '../components/StatsOverview'

function EmployeeDashboard({ user, setUser }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/databases/stats/overview', { withCredentials: true })
      setStats(response.data)
    } catch (error) { console.error('Failed to fetch stats:', error) }
    finally { setLoading(false) }
  }

  const handleLogout = async () => {
    try { await axios.post('/api/auth/logout', {}, { withCredentials: true }); setUser(null) }
    catch (error) { console.error('Logout failed:', error) }
  }

  const quickLinks = [
    { name: 'Availability Schedule', icon: '📅', desc: 'View and update your availability', color: 'from-blue-500 to-cyan-400' },
    { name: 'Team Scoreboard', icon: '🏆', desc: 'Check team performance', color: 'from-amber-500 to-orange-400' },
    { name: 'Master Calendar', icon: '📆', desc: 'View upcoming events', color: 'from-teal-500 to-cyan-400' }
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">🏢</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">REG Portal</h1>
              <p className="text-sm text-gray-500">Employee Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
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
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
          <h2 className="text-3xl font-bold">Welcome back, {user.fullName || 'there'}!</h2>
          <p className="text-white/80 mt-2">Here is your dashboard overview for today</p>
        </div>

        {/* Quick Links */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickLinks.map((link, idx) => (
              <div key={idx} className="bg-gray-800 rounded-2xl border border-gray-700 p-6 hover:border-gray-600 transition-all cursor-pointer group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {link.icon}
                </div>
                <h4 className="font-semibold text-white">{link.name}</h4>
                <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Dashboard Overview</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <StatsOverview stats={stats} />
          )}
        </div>
      </main>
    </div>
  )
}

export default EmployeeDashboard
