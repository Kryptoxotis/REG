import { useState, useEffect } from 'react'
import axios from 'axios'
import DatabaseViewer from '../components/DatabaseViewer'
import StatsOverview from '../components/StatsOverview'

function AdminDashboard({ user, setUser }) {
  const [activeView, setActiveView] = useState('overview')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/databases/stats', { withCredentials: true })
      setStats(response.data)
    } catch (error) { console.error('Failed to fetch stats:', error) }
    finally { setLoading(false) }
  }

  const handleLogout = async () => {
    try { await axios.post('/api/auth/logout', {}, { withCredentials: true }); setUser(null) }
    catch (error) { console.error('Logout failed:', error) }
  }

  const databases = [
    { key: 'AVAILABILITY', name: 'Availability', color: 'bg-blue-500', icon: '📅' },
    { key: 'DIRECTORY', name: 'Directory', color: 'bg-violet-500', icon: '📁' },
    { key: 'SCOREBOARD', name: 'Scoreboard', color: 'bg-amber-500', icon: '🏆' },
    { key: 'MODEL_HOMES', name: 'Model Homes', color: 'bg-emerald-500', icon: '🏠' },
    { key: 'SELLER_INQUIRY', name: 'Inquiries', color: 'bg-pink-500', icon: '💼' },
    { key: 'MORTGAGE_CALC', name: 'Mortgage', color: 'bg-indigo-500', icon: '💰' },
    { key: 'STATUS_REPORT', name: 'Reports', color: 'bg-red-500', icon: '📊' },
    { key: 'MASTER_CALENDAR', name: 'Calendar', color: 'bg-teal-500', icon: '📆' }
  ]

  const sidebarClass = sidebarCollapsed ? 'w-20' : 'w-64'
  const mainClass = sidebarCollapsed ? 'ml-20' : 'ml-64'

  return (
    <div className="min-h-screen bg-gray-900">
      <aside className={`fixed inset-y-0 left-0 z-50 ${sidebarClass} bg-gray-950 transition-all duration-300 border-r border-gray-800`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🏢</span>
          </div>
          {!sidebarCollapsed && <span className="text-lg font-bold text-white">REG Portal</span>}
        </div>

        <nav className="p-4 space-y-2">
          <button onClick={() => setActiveView('overview')}
            className={activeView === 'overview'
              ? 'w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
              : 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition-all'}>
            <span className="text-xl">📊</span>
            {!sidebarCollapsed && <span className="font-medium">Overview</span>}
          </button>

          {!sidebarCollapsed && <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Databases</p>}

          {databases.map(db => (
            <button key={db.key} onClick={() => setActiveView(db.key)}
              className={activeView === db.key
                ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-800 text-white'
                : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-all'}>
              <span className="text-lg">{db.icon}</span>
              {!sidebarCollapsed && <span className="text-sm font-medium">{db.name}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.fullName || 'Admin'}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={`${mainClass} transition-all duration-300`}>
        <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
          <div className="flex items-center justify-between px-8 py-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <span className="text-gray-400 text-xl">☰</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {activeView === 'overview' ? 'Dashboard' : databases.find(db => db.key === activeView)?.name}
                </h1>
                <p className="text-sm text-gray-400">Welcome back, {user.fullName || user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
              🚪 Sign out
            </button>
          </div>
        </header>

        <main className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-400">Loading dashboard...</p>
              </div>
            </div>
          ) : activeView === 'overview' ? (
            <StatsOverview stats={stats} />
          ) : (
            <DatabaseViewer databaseKey={activeView} databaseName={databases.find(db => db.key === activeView)?.name} />
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
