import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'
import { useStats } from '../hooks/useApi'
import { useToast } from '../components/Toast'
import DatabaseViewer from '../components/DatabaseViewer'
import OfficeOverview from '../components/OfficeOverview'
import Settings from '../components/Settings'
import TeamKPIView from '../components/TeamKPIView'
import ScheduleCalendar from '../components/ScheduleCalendar'
import PipelineBoard from '../components/PipelineBoard'
import DivisionsView from '../components/DivisionsView'
import Chat from '../components/Chat'
import { ActivityLogger } from '../utils/activityLogger'
import EmployeeDashboard from './EmployeeDashboard'

function AdminDashboard({ user, setUser }) {
  const [activeView, setActiveView] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [highlightedDealId, setHighlightedDealId] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedDivisionCity, setSelectedDivisionCity] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [previewEmployeeView, setPreviewEmployeeView] = useState(false)
  const toast = useToast()

  // Use React Query for stats (cached, auto-refresh)
  const { data: stats, isLoading: loading, error: statsError } = useStats()

  // Show toast on stats error
  useEffect(() => {
    if (statsError) {
      toast.error('Failed to load dashboard statistics')
    }
  }, [statsError])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleLogout = async () => {
    // Log the logout action before clearing user state
    ActivityLogger.logout(user?.fullName || user?.email || 'Unknown User')

    try {
      // HttpOnly cookies handle auth automatically via withCredentials
      await api.post('/api/auth/logout')
    } catch (error) {
      console.error('Logout API failed:', error)
      // Still proceed with logout even if API fails
    } finally {
      // Always clear client-side state
      setUser(null)
    }
  }

  const handleNavClick = async (view, options = {}) => {
    // Verify permissions against database before navigation
    try {
      const response = await api.get('/api/auth/verify-permissions')
      const result = response.data

      if (!result.valid) {
        // Handle terminated or pending accounts
        if (result.action === 'logout') {
          toast.error(result.message || 'Your account access has been revoked.')
          handleLogout()
          return
        }
        if (result.action === 'create-password') {
          toast.info(result.message || 'Please complete your account setup.')
          setUser(null) // This will redirect to login/create-password flow
          return
        }
      }

      // Handle role changes (admin demoted to employee)
      if (result.roleChanged) {
        toast.info(result.message || 'Your access level has changed.')
        setUser(prev => ({ ...prev, role: result.newRole }))
        // If demoted to employee, they'll see the EmployeeDashboard after re-render
        return
      }
    } catch (err) {
      // On 401, logout
      if (err.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
        setUser(null)
        return
      }
      // On other errors, log but allow navigation
      console.error('Permission check failed:', err)
    }

    setActiveView(view)
    setMobileMenuOpen(false)
    setHighlightedDealId(null) // Clear highlight when navigating normally
    setSelectedCity(null) // Clear city filter when navigating normally
    setSearchTerm('') // Clear search when navigating normally

    // Handle division city selection from OfficeOverview
    if (view === 'DIVISIONS' && options.city) {
      setSelectedDivisionCity(options.city)
    } else {
      setSelectedDivisionCity(null)
    }

    // Log navigation
    const viewNames = {
      overview: 'Dashboard Overview',
      TEAM_MEMBERS: 'Team Members',
      PROPERTIES: 'Inventory',
      PIPELINE: 'Pipeline',
      CLIENTS: 'Contact',
      DIVISIONS: 'Subdivisions',
      SCHEDULE: 'Schedule',
      chat: 'Chat',
      settings: 'Settings'
    }
    ActivityLogger.navigate(viewNames[view] || view)
  }

  // Navigate to a view and highlight a specific deal or search for a value
  const handleDealNavigate = (view, dealId, searchValue = null) => {
    setHighlightedDealId(dealId)
    setActiveView(view)
    setSearchTerm(searchValue || '')
  }

  // Navigate to Subdivisions with city filter
  const handleCitySelect = (city) => {
    setSelectedDivisionCity(city)
    setActiveView('DIVISIONS')
    setMobileMenuOpen(false)
  }

  const databases = [
    { key: 'TEAM_MEMBERS', name: 'Team Members', color: 'bg-violet-500', icon: '👥' },
    { key: 'PROPERTIES', name: 'Inventory', color: 'bg-emerald-500', icon: '🏘️' },
    { key: 'PIPELINE', name: 'Pipeline', color: 'bg-blue-500', icon: '📊' },
    { key: 'CLIENTS', name: 'Contact', color: 'bg-pink-500', icon: '💼' },
    { key: 'DIVISIONS', name: 'Subdivisions', color: 'bg-rose-500', icon: '🏢' },
    { key: 'SCHEDULE', name: 'Schedule', color: 'bg-amber-500', icon: '📅' }
  ]

  const sidebarWidth = sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
  const mainMargin = sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'

  const sidebarVariants = {
    hidden: { x: '-100%', opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } }
  }

  const navItemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: (i) => ({ x: 0, opacity: 1, transition: { delay: i * 0.05, duration: 0.3 } })
  }

  const SidebarContent = ({ isMobile = false }) => (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-6 py-5 border-b border-gray-800"
      >
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0"
        >
          <span className="text-xl">🏢</span>
        </motion.div>
        {(isMobile || !sidebarCollapsed) && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg font-bold text-white"
          >
            REG Portal
          </motion.span>
        )}
        {isMobile && (
          <button onClick={() => setMobileMenuOpen(false)} className="ml-auto p-2 text-gray-400 hover:text-white">
            ✕
          </button>
        )}
      </motion.div>

      <nav className="p-4 space-y-2 overflow-y-auto flex-1">
        <motion.button
          onClick={() => handleNavClick('overview')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={activeView === 'overview'
            ? 'w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
            : 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition-all'}
        >
          <span className="text-xl">📊</span>
          {(isMobile || !sidebarCollapsed) && <span className="font-medium">Overview</span>}
        </motion.button>

        {(isMobile || !sidebarCollapsed) && (
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Databases</p>
        )}

        {databases.map((db, i) => (
          <motion.button
            key={db.key}
            onClick={() => handleNavClick(db.key)}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={navItemVariants}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={`${activeView === db.key
              ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-800 text-white'
              : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-all'} ${db.indent ? 'ml-4' : ''}`}
          >
            <span className={db.indent ? 'text-base' : 'text-lg'}>{db.icon}</span>
            {(isMobile || !sidebarCollapsed) && <span className={`font-medium ${db.indent ? 'text-xs' : 'text-sm'}`}>{db.name}</span>}
          </motion.button>
        ))}

        {(isMobile || !sidebarCollapsed) && (
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
        )}

        <motion.button
          onClick={() => handleNavClick('chat')}
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          className={activeView === 'chat'
            ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-800 text-white'
            : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-all'}
        >
          <span className="text-lg">💬</span>
          {(isMobile || !sidebarCollapsed) && <span className="text-sm font-medium">Chat</span>}
        </motion.button>

        <motion.button
          onClick={() => handleNavClick('settings')}
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          className={activeView === 'settings'
            ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-800 text-white'
            : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-all'}
        >
          <span className="text-lg">⚙️</span>
          {(isMobile || !sidebarCollapsed) && <span className="text-sm font-medium">Settings</span>}
        </motion.button>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3"
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          >
            {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
          </motion.div>
          {(isMobile || !sidebarCollapsed) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.fullName || 'Admin'}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          )}
        </motion.div>
      </div>
    </>
  )

  // Show Employee Dashboard when in preview mode
  if (previewEmployeeView) {
    return (
      <div className="relative">
        {/* Floating back button */}
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setPreviewEmployeeView(false)}
          className="fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-500/30 transition-colors"
        >
          <span>🔙</span>
          <span>Back to Admin</span>
        </motion.button>
        {/* Banner indicating preview mode */}
        <div className="fixed top-0 left-0 right-0 z-[90] bg-amber-500/90 text-amber-950 text-center py-1.5 text-xs sm:text-sm font-medium">
          👁️ Preview Mode - This is what employees see
        </div>
        <div className="pt-7">
          <EmployeeDashboard user={user} setUser={setUser} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={sidebarVariants}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-gray-950 flex flex-col lg:hidden"
          >
            <SidebarContent isMobile={true} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-50 ${sidebarWidth} bg-gray-950 transition-all duration-300 border-r border-gray-800 flex-col`}>
        <SidebarContent isMobile={false} />
      </aside>

      <div className={`${mainMargin} transition-all duration-300`}>
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800"
        >
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile menu button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors lg:hidden"
              >
                <span className="text-gray-400 text-xl">☰</span>
              </motion.button>
              {/* Desktop collapse button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:block p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <span className="text-gray-400 text-xl">☰</span>
              </motion.button>
              <div>
                <motion.h1
                  key={activeView}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-lg sm:text-xl font-bold text-white"
                >
                  {activeView === 'overview' ? 'Dashboard' : activeView === 'settings' ? 'Settings' : activeView === 'chat' ? 'Chat' : databases.find(db => db.key === activeView)?.name}
                </motion.h1>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">Welcome back, {user.fullName || user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Admin/Employee View Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPreviewEmployeeView(!previewEmployeeView)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  previewEmployeeView
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10'
                }`}
              >
                <span>{previewEmployeeView ? '👤' : '🔄'}</span>
                <span className="hidden sm:inline">{previewEmployeeView ? 'Employee View' : 'Preview as Employee'}</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <span className="hidden sm:inline">🚪</span> Sign out
              </motion.button>
            </div>
          </div>
        </motion.header>

        <main className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"
                  />
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4 text-gray-400"
                  >
                    Loading dashboard...
                  </motion.p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeView === 'overview' ? (
                  <OfficeOverview onNavigate={handleNavClick} onCitySelect={handleCitySelect} />
                ) : activeView === 'settings' ? (
                  <Settings />
                ) : activeView === 'chat' ? (
                  <Chat isAdmin={true} />
                ) : activeView === 'TEAM_MEMBERS' ? (
                  <TeamKPIView onNavigate={handleDealNavigate} />
                ) : activeView === 'SCHEDULE' ? (
                  <ScheduleCalendar user={user} onNavigate={handleNavClick} />
                ) : activeView === 'PIPELINE' ? (
                  <PipelineBoard highlightedDealId={highlightedDealId} onClearHighlight={() => setHighlightedDealId(null)} cityFilter={selectedCity} onClearCity={() => setSelectedCity(null)} />
                ) : activeView === 'DIVISIONS' ? (
                  <DivisionsView initialCity={selectedDivisionCity} onClearCity={() => setSelectedDivisionCity(null)} />
                ) : (
                  <DatabaseViewer databaseKey={activeView} databaseName={databases.find(db => db.key === activeView)?.name} highlightedId={highlightedDealId} onClearHighlight={() => setHighlightedDealId(null)} onNavigate={handleDealNavigate} searchTerm={searchTerm} onClearSearch={() => setSearchTerm('')} user={user} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
