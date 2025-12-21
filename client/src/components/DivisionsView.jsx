import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ChevronDown, ChevronRight, Search, X, LayoutGrid, List, Home, MapPin } from 'lucide-react'
import api from '../lib/api'

function DivisionsView() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedCities, setExpandedCities] = useState({})
  const [expandedDivisions, setExpandedDivisions] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [layoutMode, setLayoutMode] = useState('card')

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/databases/PROPERTIES')
      const data = response.data?.data || response.data || []
      setProperties(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch properties:', err)
      setError(err.response?.data?.error || 'Failed to fetch properties')
    } finally {
      setLoading(false)
    }
  }

  // Group properties by subdivision/division, then determine city
  const divisionsByCity = useMemo(() => {
    const divisions = {}

    // First pass: group properties by subdivision and collect cities
    properties.forEach(prop => {
      const subdivision = prop.Subdivision || prop.subdivision || prop.Division || prop.division || 'Unknown'
      const city = prop.City || prop.city || null
      const status = prop.Status || prop['Sold/Available'] || ''

      if (!divisions[subdivision]) {
        divisions[subdivision] = {
          name: subdivision,
          properties: [],
          cities: new Set(),
          stats: {
            modelHomes: 0,
            activeHomes: 0,
            soldHomes: 0,
            availableHomes: 0,
            total: 0
          }
        }
      }

      divisions[subdivision].properties.push(prop)
      if (city) {
        divisions[subdivision].cities.add(city)
      }

      // Update stats
      divisions[subdivision].stats.total++
      const statusLower = status.toLowerCase()
      if (statusLower.includes('model')) {
        divisions[subdivision].stats.modelHomes++
      } else if (statusLower === 'available' || statusLower === 'inventory') {
        divisions[subdivision].stats.availableHomes++
        divisions[subdivision].stats.activeHomes++
      } else if (statusLower === 'sold') {
        divisions[subdivision].stats.soldHomes++
      } else if (!statusLower.includes('sold')) {
        divisions[subdivision].stats.activeHomes++
      }
    })

    // Second pass: assign city to each division
    // If division has no city, inherit from divisions with matching name that have a city
    const divisionCityMap = {}
    Object.values(divisions).forEach(div => {
      const cityArray = Array.from(div.cities)
      if (cityArray.length > 0) {
        divisionCityMap[div.name] = cityArray[0]
      }
    })

    // Assign cities (inherit if blank)
    Object.values(divisions).forEach(div => {
      const cityArray = Array.from(div.cities)
      div.city = cityArray.length > 0 ? cityArray[0] : (divisionCityMap[div.name] || 'Unknown')
      delete div.cities
    })

    // Group divisions by city
    const cityData = {}
    Object.values(divisions).forEach(div => {
      const city = div.city
      if (!cityData[city]) {
        cityData[city] = {
          name: city,
          divisions: [],
          totalProperties: 0,
          totalModelHomes: 0,
          totalActiveHomes: 0,
          totalSoldHomes: 0
        }
      }
      cityData[city].divisions.push(div)
      cityData[city].totalProperties += div.stats.total
      cityData[city].totalModelHomes += div.stats.modelHomes
      cityData[city].totalActiveHomes += div.stats.activeHomes
      cityData[city].totalSoldHomes += div.stats.soldHomes
    })

    // Sort divisions within each city alphabetically
    Object.values(cityData).forEach(city => {
      city.divisions.sort((a, b) => a.name.localeCompare(b.name))
    })

    return cityData
  }, [properties])

  // Filter by search
  const filteredByCity = useMemo(() => {
    if (!searchTerm.trim()) return divisionsByCity

    const search = searchTerm.toLowerCase()
    const filtered = {}

    Object.entries(divisionsByCity).forEach(([cityName, cityData]) => {
      const matchingDivisions = cityData.divisions.filter(div =>
        div.name.toLowerCase().includes(search) ||
        cityName.toLowerCase().includes(search)
      )
      if (matchingDivisions.length > 0 || cityName.toLowerCase().includes(search)) {
        filtered[cityName] = {
          ...cityData,
          divisions: matchingDivisions.length > 0 ? matchingDivisions : cityData.divisions
        }
      }
    })

    return filtered
  }, [divisionsByCity, searchTerm])

  // Order cities (Unknown at end)
  const orderedCities = useMemo(() => {
    const cities = Object.keys(filteredByCity)
    return cities.sort((a, b) => {
      if (a === 'Unknown') return 1
      if (b === 'Unknown') return -1
      return a.localeCompare(b)
    })
  }, [filteredByCity])

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
  const totalProperties = properties.length
  const totalCities = Object.keys(divisionsByCity).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto"
          />
          <p className="mt-4 text-gray-400">Loading divisions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchProperties} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Divisions</h2>
          <p className="text-sm text-gray-400">
            {totalCities} cities · {totalDivisions} divisions · {totalProperties} properties
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search divisions..."
              className="pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-pink-500 w-48 sm:w-64"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
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
            onClick={fetchProperties}
            className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Divisions by City */}
      <div className="space-y-4">
        {orderedCities.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center">
            <p className="text-6xl mb-4">🏢</p>
            <h3 className="text-lg font-semibold text-gray-200">No Divisions Found</h3>
            <p className="text-gray-500 mt-2">
              {searchTerm ? `No divisions match "${searchTerm}"` : 'No properties with division information'}
            </p>
          </div>
        ) : (
          orderedCities.map(cityName => {
            const cityData = filteredByCity[cityName]
            const isExpanded = expandedCities[cityName]

            return (
              <motion.div
                key={cityName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
              >
                {/* City Header */}
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
                        {cityData.divisions.length} division{cityData.divisions.length !== 1 ? 's' : ''} · {cityData.totalProperties} properties
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

                {/* Expanded Content - Divisions */}
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
                                      {division.stats.total}
                                    </span>
                                  </div>
                                  {/* Division Stats */}
                                  <div className="flex items-center gap-2 mb-3 text-xs">
                                    <span className="flex items-center gap-1 text-emerald-400">
                                      <Home className="w-3 h-3" /> {division.stats.modelHomes} model
                                    </span>
                                    <span className="text-gray-600">·</span>
                                    <span className="text-blue-400">{division.stats.activeHomes} active</span>
                                    <span className="text-gray-600">·</span>
                                    <span className="text-violet-400">{division.stats.soldHomes} sold</span>
                                  </div>
                                  <button
                                    onClick={() => toggleDivision(division.name)}
                                    className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors py-1"
                                  >
                                    <span>View properties</span>
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
                                        className="mt-2 pt-2 border-t border-gray-700 space-y-2 overflow-hidden max-h-48 overflow-y-auto"
                                      >
                                        {division.properties.slice(0, 10).map(prop => (
                                          <div key={prop.id} className="text-sm bg-gray-800 rounded-lg p-2">
                                            <p className="text-gray-200 truncate">
                                              {prop.FullAddress || prop.Address || prop.Stname || 'No Address'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {prop.Status || prop['Sold/Available'] || 'No Status'}
                                            </p>
                                          </div>
                                        ))}
                                        {division.properties.length > 10 && (
                                          <p className="text-xs text-gray-500 text-center">
                                            +{division.properties.length - 10} more
                                          </p>
                                        )}
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
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Total</th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Model</th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Active</th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Sold</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-700">
                                {cityData.divisions.map(division => (
                                  <tr key={division.name} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-white">{division.name}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="px-2 py-1 bg-pink-500/20 text-pink-400 rounded-full text-xs font-medium">
                                        {division.stats.total}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-emerald-400 text-sm">{division.stats.modelHomes}</td>
                                    <td className="px-4 py-3 text-center text-blue-400 text-sm">{division.stats.activeHomes}</td>
                                    <td className="px-4 py-3 text-center text-violet-400 text-sm">{division.stats.soldHomes}</td>
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
    </div>
  )
}

export default DivisionsView
