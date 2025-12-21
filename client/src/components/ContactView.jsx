import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Building2, ChevronDown, ChevronRight, Search, X, LayoutGrid, List, Home, MapPin } from 'lucide-react'
import api from '../lib/api'
import DatabaseViewer from './DatabaseViewer'

const CITIES = ['El Paso', 'Horizon', 'Socorro', 'Las Cruces', 'McAllen', 'San Antonio']

function ContactView({ highlightedId, onClearHighlight, onNavigate, searchTerm, onClearSearch }) {
  const [activeTab, setActiveTab] = useState('contacts') // 'contacts' or 'divisions'
  const [contacts, setContacts] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedCities, setExpandedCities] = useState({})
  const [expandedDivisions, setExpandedDivisions] = useState({})
  const [divisionSearch, setDivisionSearch] = useState('')
  const [layoutMode, setLayoutMode] = useState('card') // 'card' or 'list'

  // Fetch contacts and properties for divisions view
  useEffect(() => {
    if (activeTab === 'divisions') {
      fetchDivisionsData()
    }
  }, [activeTab])

  const fetchDivisionsData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [contactsRes, propertiesRes] = await Promise.all([
        api.get('/api/databases/clients'),
        api.get('/api/databases/PROPERTIES')
      ])
      const contactsData = contactsRes.data?.data || contactsRes.data || []
      const propertiesData = propertiesRes.data?.data || propertiesRes.data || []
      setContacts(Array.isArray(contactsData) ? contactsData : [])
      setProperties(Array.isArray(propertiesData) ? propertiesData : [])
    } catch (err) {
      console.error('Failed to fetch divisions data:', err)
      setError(err.response?.data?.error || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  // Group properties by subdivision to get stats
  const propertyStatsBySubdivision = useMemo(() => {
    const stats = {}
    properties.forEach(prop => {
      const subdivision = prop.Subdivision || prop.subdivision || 'Unknown'
      const status = prop.Status || prop['Sold/Available'] || ''

      if (!stats[subdivision]) {
        stats[subdivision] = {
          modelHomes: 0,
          activeHomes: 0,
          soldHomes: 0,
          availableHomes: 0,
          total: 0
        }
      }

      stats[subdivision].total++

      const statusLower = status.toLowerCase()
      if (statusLower.includes('model')) {
        stats[subdivision].modelHomes++
      } else if (statusLower === 'available' || statusLower === 'inventory') {
        stats[subdivision].availableHomes++
        stats[subdivision].activeHomes++
      } else if (statusLower === 'sold') {
        stats[subdivision].soldHomes++
      } else if (!statusLower.includes('sold')) {
        // Count non-sold as active
        stats[subdivision].activeHomes++
      }
    })
    return stats
  }, [properties])

  // Group contacts by city first, then by division within each city
  const divisionsByCity = useMemo(() => {
    const cityData = {}

    // First pass: collect all contacts by division and track cities
    const divisions = {}
    contacts.forEach(contact => {
      const division = contact.Division || contact.division || 'Unassigned'
      const city = contact.City || contact.city || null

      if (!divisions[division]) {
        divisions[division] = {
          name: division,
          contacts: [],
          cities: new Set()
        }
      }

      divisions[division].contacts.push(contact)
      if (city) {
        divisions[division].cities.add(city)
      }
    })

    // Second pass: assign city to divisions (inherit from contacts with city set)
    // and add property stats
    Object.values(divisions).forEach(div => {
      const cityArray = Array.from(div.cities)
      div.city = cityArray.length > 0 ? cityArray[0] : 'Unknown'
      delete div.cities

      // Add property stats for this division (match by subdivision name)
      const stats = propertyStatsBySubdivision[div.name] || {
        modelHomes: 0,
        activeHomes: 0,
        soldHomes: 0,
        availableHomes: 0,
        total: 0
      }
      div.stats = stats
    })

    // Group divisions by city
    Object.values(divisions).forEach(div => {
      const city = div.city
      if (!cityData[city]) {
        cityData[city] = {
          name: city,
          divisions: [],
          totalContacts: 0,
          totalModelHomes: 0,
          totalActiveHomes: 0,
          totalSoldHomes: 0
        }
      }
      cityData[city].divisions.push(div)
      cityData[city].totalContacts += div.contacts.length
      cityData[city].totalModelHomes += div.stats.modelHomes
      cityData[city].totalActiveHomes += div.stats.activeHomes
      cityData[city].totalSoldHomes += div.stats.soldHomes
    })

    // Sort divisions within each city alphabetically
    Object.values(cityData).forEach(city => {
      city.divisions.sort((a, b) => a.name.localeCompare(b.name))
    })

    return cityData
  }, [contacts, propertyStatsBySubdivision])

  // Filter divisions by search
  const filteredDivisionsByCity = useMemo(() => {
    if (!divisionSearch.trim()) return divisionsByCity

    const search = divisionSearch.toLowerCase()
    const filtered = {}

    Object.entries(divisionsByCity).forEach(([cityName, cityData]) => {
      const matchingDivisions = cityData.divisions.filter(div =>
        div.name.toLowerCase().includes(search) ||
        cityName.toLowerCase().includes(search) ||
        div.contacts.some(c =>
          (c.Name || c.name || '').toLowerCase().includes(search) ||
          (c.Email || c.email || '').toLowerCase().includes(search)
        )
      )
      if (matchingDivisions.length > 0) {
        filtered[cityName] = {
          ...cityData,
          divisions: matchingDivisions
        }
      }
    })

    return filtered
  }, [divisionsByCity, divisionSearch])

  // Get ordered cities (put Unknown at the end)
  const orderedCities = useMemo(() => {
    const cities = Object.keys(filteredDivisionsByCity)
    return cities.sort((a, b) => {
      if (a === 'Unknown') return 1
      if (b === 'Unknown') return -1
      return a.localeCompare(b)
    })
  }, [filteredDivisionsByCity])

  const toggleCity = (cityName) => {
    setExpandedCities(prev => ({
      ...prev,
      [cityName]: !prev[cityName]
    }))
  }

  const toggleDivision = (divisionName) => {
    setExpandedDivisions(prev => ({
      ...prev,
      [divisionName]: !prev[divisionName]
    }))
  }

  const totalDivisions = Object.values(divisionsByCity).reduce((acc, city) => acc + city.divisions.length, 0)
  const totalContacts = contacts.length
  const totalCities = Object.keys(divisionsByCity).length

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-2 bg-gray-800/50 p-1.5 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'contacts'
              ? 'bg-pink-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          <Users className="w-4 h-4" />
          Contacts
        </button>
        <button
          onClick={() => setActiveTab('divisions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'divisions'
              ? 'bg-pink-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Divisions
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'contacts' ? (
          <motion.div
            key="contacts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <DatabaseViewer
              databaseKey="CLIENTS"
              databaseName="Contact"
              highlightedId={highlightedId}
              onClearHighlight={onClearHighlight}
              onNavigate={onNavigate}
              searchTerm={searchTerm}
              onClearSearch={onClearSearch}
            />
          </motion.div>
        ) : (
          <motion.div
            key="divisions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Divisions Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold text-white">Divisions</h2>
                <p className="text-sm text-gray-400">
                  {totalCities} cities · {totalDivisions} divisions · {totalContacts} contacts
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={divisionSearch}
                    onChange={(e) => setDivisionSearch(e.target.value)}
                    placeholder="Search divisions..."
                    className="pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-pink-500 w-48 sm:w-64"
                  />
                  {divisionSearch && (
                    <button
                      onClick={() => setDivisionSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* Layout Toggle */}
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-xl p-1">
                  <button
                    onClick={() => setLayoutMode('card')}
                    className={`p-2 rounded-lg transition-colors ${layoutMode === 'card' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Card View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLayoutMode('list')}
                    className={`p-2 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                {/* Refresh */}
                <button
                  onClick={fetchDivisionsData}
                  className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white transition-colors"
                  title="Refresh"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Loading / Error States */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto"
                  />
                  <p className="mt-4 text-gray-400">Loading divisions...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
                <p className="text-red-400">{error}</p>
                <button onClick={fetchDivisionsData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">
                  Try Again
                </button>
              </div>
            )}

            {/* Divisions by City - Hierarchical View */}
            {!loading && !error && (
              <div className="space-y-4">
                {orderedCities.length === 0 ? (
                  <div className="bg-gray-800 rounded-2xl p-12 text-center">
                    <p className="text-6xl mb-4">🏢</p>
                    <h3 className="text-lg font-semibold text-gray-200">No Divisions Found</h3>
                    <p className="text-gray-500 mt-2">
                      {divisionSearch ? `No divisions match "${divisionSearch}"` : 'No contacts with division information'}
                    </p>
                  </div>
                ) : (
                  orderedCities.map(cityName => {
                    const cityData = filteredDivisionsByCity[cityName]
                    const isExpanded = expandedCities[cityName]

                    return (
                      <motion.div
                        key={cityName}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                      >
                        {/* City Header - Clickable to expand */}
                        <button
                          onClick={() => toggleCity(cityName)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                              <MapPin className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-left">
                              <h3 className="text-lg font-semibold text-white">{cityName}</h3>
                              <p className="text-xs text-gray-500">
                                {cityData.divisions.length} division{cityData.divisions.length !== 1 ? 's' : ''} · {cityData.totalContacts} contact{cityData.totalContacts !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* City Stats */}
                            <div className="hidden sm:flex items-center gap-3">
                              <div className="text-center px-3 py-1 bg-emerald-500/10 rounded-lg">
                                <p className="text-xs text-gray-500">Model</p>
                                <p className="text-sm font-semibold text-emerald-400">{cityData.totalModelHomes}</p>
                              </div>
                              <div className="text-center px-3 py-1 bg-blue-500/10 rounded-lg">
                                <p className="text-xs text-gray-500">Active</p>
                                <p className="text-sm font-semibold text-blue-400">{cityData.totalActiveHomes}</p>
                              </div>
                              <div className="text-center px-3 py-1 bg-violet-500/10 rounded-lg">
                                <p className="text-xs text-gray-500">Sold</p>
                                <p className="text-sm font-semibold text-violet-400">{cityData.totalSoldHomes}</p>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Expanded City Content - Divisions */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden border-t border-gray-700"
                            >
                              <div className="p-4 space-y-3">
                                {layoutMode === 'card' ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {cityData.divisions.map(division => (
                                      <motion.div
                                        key={division.name}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden hover:border-pink-500/50 transition-colors"
                                      >
                                        <div className="h-1 bg-gradient-to-r from-pink-500 to-rose-400" />
                                        <div className="p-4">
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-white">{division.name}</h4>
                                            <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded-full text-xs font-medium">
                                              {division.contacts.length}
                                            </span>
                                          </div>
                                          {/* Division Stats */}
                                          <div className="flex items-center gap-2 mb-3 text-xs">
                                            <span className="flex items-center gap-1 text-emerald-400">
                                              <Home className="w-3 h-3" /> {division.stats.modelHomes} model
                                            </span>
                                            <span className="text-gray-600">·</span>
                                            <span className="flex items-center gap-1 text-blue-400">
                                              {division.stats.activeHomes} active
                                            </span>
                                            <span className="text-gray-600">·</span>
                                            <span className="flex items-center gap-1 text-violet-400">
                                              {division.stats.soldHomes} sold
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => toggleDivision(division.name)}
                                            className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors py-1"
                                          >
                                            <span>View contacts</span>
                                            {expandedDivisions[division.name] ? (
                                              <ChevronDown className="w-4 h-4" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4" />
                                            )}
                                          </button>
                                          <AnimatePresence>
                                            {expandedDivisions[division.name] && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="mt-2 pt-2 border-t border-gray-700 space-y-2 overflow-hidden"
                                              >
                                                {division.contacts.map(contact => (
                                                  <div key={contact.id} className="flex items-center gap-2 text-sm">
                                                    <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-gray-300">
                                                      {(contact.Name || contact.name || '?').charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-gray-200 truncate">{contact.Name || contact.name || 'Unknown'}</p>
                                                      <p className="text-gray-500 text-xs truncate">{contact.Email || contact.email || ''}</p>
                                                    </div>
                                                  </div>
                                                ))}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                ) : (
                                  /* List View */
                                  <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                                    <table className="w-full">
                                      <thead className="bg-gray-950 border-b border-gray-700">
                                        <tr>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Division</th>
                                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Contacts</th>
                                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Model</th>
                                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Active</th>
                                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Sold</th>
                                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Members</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-700">
                                        {cityData.divisions.map(division => (
                                          <tr key={division.name} className="hover:bg-gray-800/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-white">{division.name}</td>
                                            <td className="px-4 py-3 text-center">
                                              <span className="px-2 py-1 bg-pink-500/20 text-pink-400 rounded-full text-xs font-medium">
                                                {division.contacts.length}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-emerald-400 text-sm">{division.stats.modelHomes}</td>
                                            <td className="px-4 py-3 text-center text-blue-400 text-sm">{division.stats.activeHomes}</td>
                                            <td className="px-4 py-3 text-center text-violet-400 text-sm">{division.stats.soldHomes}</td>
                                            <td className="px-4 py-3 text-gray-400 text-sm">
                                              {division.contacts.slice(0, 2).map(c => c.Name || c.name).join(', ')}
                                              {division.contacts.length > 2 && ` +${division.contacts.length - 2}`}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ContactView
