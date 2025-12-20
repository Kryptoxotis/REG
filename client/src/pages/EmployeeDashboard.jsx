import { useState, useEffect, useMemo } from 'react'
import api from '../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { ActivityLogger } from '../utils/activityLogger'
import { useToast } from '../components/Toast'
import ScheduleCalendar from '../components/ScheduleCalendar'
import PipelineBoard from '../components/PipelineBoard'
import OfficeOverview from '../components/OfficeOverview'
import Chat from '../components/Chat'

function EmployeeDashboard({ user, setUser }) {
  const toast = useToast()
  const [activeSection, setActiveSection] = useState('overview')
  const [profileData, setProfileData] = useState(null)
  const [personalStats, setPersonalStats] = useState(null)
  const [teamStats, setTeamStats] = useState(null)
  const [pipelineStats, setPipelineStats] = useState(null) // Personal stats from Pipeline
  const [propertiesData, setPropertiesData] = useState([])
  const [loading, setLoading] = useState({})
  const [error, setError] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileUpdates, setProfileUpdates] = useState({})
  const [saving, setSaving] = useState(false)

  // Properties filters
  const [propertySearch, setPropertySearch] = useState('')
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('')
  const [expandedProperty, setExpandedProperty] = useState(null)

  // HttpOnly cookies handle auth automatically via withCredentials in api.js

  // Navigation items - order matters
  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'pipeline', label: 'Pipeline', icon: '📈' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'properties', label: 'Properties', icon: '🏠' },
    { id: 'chat', label: 'Chat', icon: '💬' },
  ]

  // Handle logout
  const handleLogout = async () => {
    ActivityLogger.logout(user?.fullName || user?.email || 'Unknown User')
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      console.error('Logout API failed:', error)
    } finally {
      setUser(null)
    }
  }

  // Handle section change with logging and permission verification
  const handleSectionChange = async (sectionId) => {
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
          setUser(null)
          return
        }
      }

      // Handle role changes (employee promoted to admin)
      if (result.roleChanged) {
        toast.info(result.message || 'Your access level has changed.')
        setUser(prev => ({ ...prev, role: result.newRole }))
        // If promoted to admin, parent component will re-render with AdminDashboard
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

    setActiveSection(sectionId)
    const section = navItems.find(n => n.id === sectionId)
    ActivityLogger.navigate(section?.label || sectionId)
  }

  // Fetch profile data (own team member record)
  useEffect(() => {
    let isMounted = true
    if (activeSection === 'profile' || activeSection === 'overview') {
      fetchProfile(isMounted)
    }
    return () => { isMounted = false }
  }, [activeSection])

  // Fetch properties for Properties view
  useEffect(() => {
    let isMounted = true
    if (activeSection === 'properties') {
      fetchProperties(isMounted)
    }
    return () => { isMounted = false }
  }, [activeSection])

  async function fetchProfile(isMounted = true) {
    if (profileData) return // Already fetched
    setLoading(prev => ({ ...prev, profile: true }))
    try {
      // Get all team members and find current user
      const res = await api.get('/api/databases/TEAM_MEMBERS')
      if (!isMounted) return
      const members = Array.isArray(res.data) ? res.data : []
      const myProfile = members.find(m =>
        m.Email?.toLowerCase() === user?.email?.toLowerCase() ||
        m.email?.toLowerCase() === user?.email?.toLowerCase()
      )
      setProfileData(myProfile || null)

      // Also fetch personal stats
      fetchPersonalStats(myProfile, isMounted)
    } catch (err) {
      if (!isMounted) return
      console.error('Profile fetch error:', err)
      setError('Failed to load profile')
    } finally {
      if (isMounted) setLoading(prev => ({ ...prev, profile: false }))
    }
  }

  async function fetchPersonalStats(profile, isMounted = true) {
    try {
      const res = await api.get('/api/databases/team-kpis')
      if (!isMounted) return
      // Handle paginated response format { data: [...], pagination: {...} }
      const teamData = res.data?.data || res.data || []
      const allStats = Array.isArray(teamData) ? teamData : []
      // Find stats for current user
      const myStats = allStats.find(s =>
        s.name?.toLowerCase() === profile?.Name?.toLowerCase() ||
        s.email?.toLowerCase() === user?.email?.toLowerCase()
      )
      setPersonalStats(myStats || null)

      // Calculate team totals for Overview
      if (allStats.length > 0) {
        const teamTotals = allStats.reduce((acc, s) => ({
          totalDeals: (acc.totalDeals || 0) + (s.totalDeals || 0),
          closedDeals: (acc.closedDeals || 0) + (s.closedDeals || 0),
          pendingDeals: (acc.pendingDeals || 0) + (s.pendingDeals || 0),
          totalVolume: (acc.totalVolume || 0) + (s.totalVolume || 0),
          memberCount: (acc.memberCount || 0) + 1
        }), {})
        // Calculate team close rate
        teamTotals.closingRate = teamTotals.totalDeals > 0
          ? Math.round((teamTotals.closedDeals / teamTotals.totalDeals) * 100)
          : 0
        setTeamStats(teamTotals)
      }

      // Also fetch pipeline stats for Profile
      fetchPipelineStats(profile, isMounted)
    } catch (err) {
      if (!isMounted) return
      console.error('Stats fetch error:', err)
    }
  }

  // Fetch personal stats from Pipeline (for Profile section)
  async function fetchPipelineStats(profile, isMounted = true) {
    try {
      const [pipelineRes, closedRes] = await Promise.all([
        api.get('/api/databases/PIPELINE'),
        api.get('/api/databases/CLOSED_DEALS')
      ])
      if (!isMounted) return
      const pipelineDeals = Array.isArray(pipelineRes.data) ? pipelineRes.data : []
      const closedDeals = Array.isArray(closedRes.data) ? closedRes.data : []

      // Get user's name for matching
      const userName = profile?.Name || user?.fullName || user?.name || ''
      const userNameLower = userName.toLowerCase()

      // Filter deals by Agent matching current user
      const myPipelineDeals = pipelineDeals.filter(d => {
        const agent = (d.Agent || d.agent || '')?.toLowerCase()
        return agent === userNameLower || agent.includes(userNameLower)
      })

      const myClosedDeals = closedDeals.filter(d => {
        const agent = (d.Agent || d.agent || '')?.toLowerCase()
        return agent === userNameLower || agent.includes(userNameLower)
      })

      // Calculate stats
      const stats = {
        totalDeals: myPipelineDeals.length + myClosedDeals.length,
        activeDeals: myPipelineDeals.length,
        closedDeals: myClosedDeals.length,
        closingRate: (myPipelineDeals.length + myClosedDeals.length) > 0
          ? Math.round((myClosedDeals.length / (myPipelineDeals.length + myClosedDeals.length)) * 100)
          : 0,
        totalVolume: myClosedDeals.reduce((sum, d) =>
          sum + (parseFloat(d['Sale Price'] || d.salePrice || d['Contract Price'] || 0)), 0
        )
      }
      setPipelineStats(stats)
    } catch (err) {
      if (!isMounted) return
      console.error('Pipeline stats fetch error:', err)
    }
  }

  async function fetchProperties(isMounted = true) {
    if (propertiesData.length > 0) return
    setLoading(prev => ({ ...prev, properties: true }))
    try {
      const res = await api.get('/api/databases/PROPERTIES')
      if (!isMounted) return
      setPropertiesData(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      if (!isMounted) return
      console.error('Properties fetch error:', err)
    } finally {
      if (isMounted) setLoading(prev => ({ ...prev, properties: false }))
    }
  }

  // Profile editing
  const handleProfileEdit = (field, value) => {
    setProfileUpdates(prev => ({ ...prev, [field]: value }))
  }

  const saveProfileChanges = async () => {
    if (!profileData?.id) return
    setSaving(true)
    try {
      await api.patch(`/api/databases/TEAM_MEMBERS/${profileData.id}`, profileUpdates)
      setProfileData(prev => ({ ...prev, ...profileUpdates }))
      setProfileUpdates({})
      setEditingProfile(false)
      ActivityLogger.editRecord('Team Member', profileData.Name, 'Contact Info', 'updated', 'saved')
    } catch (err) {
      console.error('Save profile error:', err)
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Filter properties
  const filteredProperties = useMemo(() => {
    return propertiesData.filter(p => {
      const matchesSearch = !propertySearch ||
        (p.Address || p.Name || '').toLowerCase().includes(propertySearch.toLowerCase()) ||
        (p.Subdivision || '').toLowerCase().includes(propertySearch.toLowerCase())
      const matchesStatus = !propertyStatusFilter || p.Status === propertyStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [propertiesData, propertySearch, propertyStatusFilter])

  // Get unique property statuses for filter
  const propertyStatuses = useMemo(() => {
    const statuses = new Set(propertiesData.map(p => p.Status).filter(Boolean))
    return Array.from(statuses).sort()
  }, [propertiesData])

  const handleLogout = async () => {
    // Log the logout action before clearing user state
    ActivityLogger.logout(user?.fullName || user?.email || 'Unknown User')

    try {
      // HttpOnly cookies handle auth automatically via withCredentials
      await api.post('/api/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20 md:pb-0">
      {/* Header - Simpler than admin */}
      <header className="bg-gray-950 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">🏠</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-white">REG Portal</h1>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeSection === item.id
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="mr-1.5">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm text-gray-300">{user.fullName?.split(' ')[0] || 'Employee'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        <AnimatePresence mode="wait">
          {/* OVERVIEW SECTION */}
          {activeSection === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Welcome */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Welcome back, {user.fullName?.split(' ')[0] || 'there'}!
                </h2>
                <p className="text-gray-400 mt-1">Team overview for today</p>
              </div>

              {/* Office Overview - Team Stats by City (read-only for employees) */}
              <div className="mb-6">
                <OfficeOverview readOnly={true} />
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <QuickAction
                  icon="📅"
                  label="Request Shifts"
                  onClick={() => handleSectionChange('schedule')}
                />
                <QuickAction
                  icon="📈"
                  label="View Pipeline"
                  onClick={() => handleSectionChange('pipeline')}
                />
                <QuickAction
                  icon="👤"
                  label="My Profile"
                  onClick={() => handleSectionChange('profile')}
                />
              </div>
            </motion.div>
          )}

          {/* PROFILE SECTION */}
          {activeSection === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">My Profile</h2>
                {!editingProfile ? (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="px-3 py-1.5 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-all"
                  >
                    Edit Contact Info
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingProfile(false); setProfileUpdates({}) }}
                      className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveProfileChanges}
                      disabled={saving || Object.keys(profileUpdates).length === 0}
                      className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {loading.profile ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : !profileData ? (
                <div className="bg-gray-800 rounded-xl p-6 text-center">
                  <p className="text-gray-400">Profile not found. Contact admin.</p>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  {/* Profile Header */}
                  <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-6 border-b border-gray-700">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {(profileData.Name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{profileData.Name || 'Unknown'}</h3>
                        <p className="text-amber-400">{profileData.Role || profileData['Job Title'] || 'Team Member'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Profile Fields */}
                  <div className="p-4 sm:p-6 space-y-4">
                    {/* Editable Fields */}
                    <ProfileField
                      label="Email"
                      value={profileUpdates.Email ?? profileData.Email}
                      editable={editingProfile}
                      onChange={(v) => handleProfileEdit('Email', v)}
                    />
                    <ProfileField
                      label="Phone"
                      value={profileUpdates.Phone ?? profileData.Phone}
                      editable={editingProfile}
                      onChange={(v) => handleProfileEdit('Phone', v)}
                    />

                    {/* Read-only Fields */}
                    <ProfileField label="Role" value={profileData.Role} />
                    <ProfileField label="Status" value={profileData.Status} badge />
                    <ProfileField label="Start Date" value={profileData['Start Date']} />

                    {/* Stats Section - From Pipeline Data */}
                    {pipelineStats && (
                      <div className="pt-4 border-t border-gray-700">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Your Performance</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-2xl font-bold text-white">{pipelineStats.totalDeals || 0}</p>
                            <p className="text-xs text-gray-500">Total Deals</p>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-2xl font-bold text-green-400">{pipelineStats.closedDeals || 0}</p>
                            <p className="text-xs text-gray-500">Closed</p>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-2xl font-bold text-amber-400">{pipelineStats.activeDeals || 0}</p>
                            <p className="text-xs text-gray-500">Active</p>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-2xl font-bold text-blue-400">{pipelineStats.closingRate || 0}%</p>
                            <p className="text-xs text-gray-500">Close Rate</p>
                          </div>
                        </div>
                        {pipelineStats.totalVolume > 0 && (
                          <div className="mt-3 bg-gray-900/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-400">${(pipelineStats.totalVolume / 1000).toFixed(0)}k</p>
                            <p className="text-xs text-gray-500">Total Closed Volume</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* PIPELINE SECTION */}
          {activeSection === 'pipeline' && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-[600px]"
            >
              <PipelineBoard
                user={user}
                isEmployee={true}
                onNavigate={(view, id) => {
                  // Handle navigation if needed
                }}
              />
            </motion.div>
          )}

          {/* SCHEDULE SECTION */}
          {activeSection === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ScheduleCalendar user={user} />
            </motion.div>
          )}

          {/* PROPERTIES SECTION */}
          {activeSection === 'properties' && (
            <motion.div
              key="properties"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-white">Properties</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  />
                  <select
                    value={propertyStatusFilter}
                    onChange={(e) => setPropertyStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">All Status</option>
                    {propertyStatuses.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading.properties ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredProperties.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-6 text-center">
                  <p className="text-gray-400">No properties found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProperties.map(property => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      expanded={expandedProperty === property.id}
                      onToggle={() => setExpandedProperty(
                        expandedProperty === property.id ? null : property.id
                      )}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* CHAT SECTION */}
          {activeSection === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-[calc(100vh-180px)]"
            >
              <Chat isAdmin={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-50">
        <div className="flex justify-around py-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleSectionChange(item.id)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all ${
                activeSection === item.id
                  ? 'text-amber-400'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// Helper Components

function StatCard({ label, value, icon, highlight }) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${highlight ? 'border-green-500/30' : 'border-gray-700'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-4 text-left transition-all hover:border-amber-500/50 group"
    >
      <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">{icon}</span>
      <p className="text-sm font-medium text-gray-300">{label}</p>
    </button>
  )
}

function ProfileField({ label, value, editable, onChange, badge }) {
  if (editable) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {badge ? (
        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
          value === 'Active' ? 'bg-green-500/20 text-green-400' :
          value === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
          'bg-gray-700 text-gray-300'
        }`}>
          {value || 'N/A'}
        </span>
      ) : (
        <p className="text-white">{value || 'N/A'}</p>
      )}
    </div>
  )
}

function PropertyCard({ property, expanded, onToggle }) {
  const statusColors = {
    'Available': 'bg-green-500/20 text-green-400',
    'Pending': 'bg-amber-500/20 text-amber-400',
    'Sold': 'bg-blue-500/20 text-blue-400',
    'Model': 'bg-purple-500/20 text-purple-400',
  }

  return (
    <div
      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden cursor-pointer hover:border-gray-600 transition-all"
      onClick={onToggle}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-white text-sm line-clamp-1">
            {property.Address || property.Name || 'Unknown'}
          </h3>
          <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ml-2 ${statusColors[property.Status] || 'bg-gray-700 text-gray-300'}`}>
            {property.Status || 'N/A'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-2">{property.Subdivision || 'No subdivision'}</p>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          {property.Beds && <span>{property.Beds} bed</span>}
          {property.Baths && <span>{property.Baths} bath</span>}
          {property['Sales Price'] && (
            <span className="text-amber-400 font-medium">
              ${(property['Sales Price'] / 1000).toFixed(0)}k
            </span>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-700"
          >
            <div className="p-4 bg-gray-850 space-y-2 text-sm">
              {property.Floorplan && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Floorplan</span>
                  <span className="text-white">{property.Floorplan}</span>
                </div>
              )}
              {property['Sq Ft'] && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sq Ft</span>
                  <span className="text-white">{property['Sq Ft'].toLocaleString()}</span>
                </div>
              )}
              {property['Lot Size'] && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Lot Size</span>
                  <span className="text-white">{property['Lot Size']}</span>
                </div>
              )}
              {property.Builder && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Builder</span>
                  <span className="text-white">{property.Builder}</span>
                </div>
              )}
              {property.Notes && (
                <div className="pt-2 border-t border-gray-700">
                  <span className="text-gray-500 block mb-1">Notes</span>
                  <p className="text-gray-300 text-xs">{property.Notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default EmployeeDashboard
