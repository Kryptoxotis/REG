import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Search, X, LayoutGrid, List, Home, MapPin, Building2, TrendingUp, RefreshCw } from 'lucide-react'
import api from '../lib/api'

// City to Edwards Co. mapping (same as OfficeOverview)
const OFFICE_MAP = {
  'El Paso': ["Edward's LLC.", "Edwards LLC", "El Paso"],
  'Las Cruces': ["Edward's NM.", "Edwards NM", "Las Cruces", "New Mexico"],
  'McAllen': ["Edward's RGV", "Edwards RGV", "McAllen"],
  'San Antonio': ["San Antonio"]
}

// Determine city from Edwards Co. field
function getCityFromItem(item) {
  const officeField = item['Edwards Co.'] || item['Edwards Co'] || item.Office || ''
  const address = item.FullAddress || item.Address || item['Property Address'] || ''

  for (const [city, terms] of Object.entries(OFFICE_MAP)) {
    if (terms.some(term =>
      officeField.toLowerCase().includes(term.toLowerCase()) ||
      address.toLowerCase().includes(term.toLowerCase())
    )) {
      return city
    }
  }
  return 'Other'
}

function DivisionsView() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedCities, setExpandedCities] = useState({})
  const [expandedDivisions, setExpandedDivisions] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [layoutMode, setLayoutMode] = useState('card')
  const [dataSource, setDataSource] = useState('properties')

  useEffect(() => {
    fetchData()
  }, [dataSource])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = dataSource === 'properties' ? '/api/databases/PROPERTIES' : '/api/databases/PIPELINE'
      const response = await api.get(endpoint)
      const result = response.data?.data || response.data || []
      setData(Array.isArray(result) ? result : [])
    } catch (err) {
      console.error(`Failed to fetch ${dataSource}:`, err)
      setError(err.response?.data?.error || `Failed to fetch ${dataSource}`)
    } finally {
      setLoading(false)
    }
  }

  // Group data by city (from Edwards Co.), then by subdivision
  const divisionsByCity = useMemo(() => {
    const cityData = {}

    data.forEach(item => {
      const city = getCityFromItem(item)
      const subdivision = item.Subdivision || item.subdivision || item.Division || item.division || 'Unknown'
      const status = dataSource === 'properties'
        ? (item.Status || item['Sold/Available'] || '')
        : (item['Loan Status'] || '')

      if (!cityData[city]) {
        cityData[city] = {
          name: city,
          divisions: {},
          totalItems: 0,
          totalModelHomes: 0,
          totalActiveHomes: 0,
          totalSoldHomes: 0
        }
      }

      if (!cityData[city].divisions[subdivision]) {
        cityData[city].divisions[subdivision] = {
          name: subdivision,
          items: [],
          stats: { modelHomes: 0, activeHomes: 0, soldHomes: 0, availableHomes: 0, total: 0 }
        }
      }

      const div = cityData[city].divisions[subdivision]
      div.items.push(item)
      div.stats.total++
      cityData[city].totalItems++

      const statusLower = status.toLowerCase()
      if (dataSource === 'properties') {
        if (statusLower.includes('model')) {
          div.stats.modelHomes++
          cityData[city].totalModelHomes++
        } else if (statusLower === 'available' || statusLower === 'inventory') {
          div.stats.availableHomes++
          div.stats.activeHomes++
          cityData[city].totalActiveHomes++
        } else if (statusLower === 'sold') {
          div.stats.soldHomes++
          cityData[city].totalSoldHomes++
        } else if (!statusLower.includes('sold')) {
          div.stats.activeHomes++
          cityData[city].totalActiveHomes++
        }
      } else {
        if (statusLower.includes('closed') || statusLower.includes('sold')) {
          div.stats.soldHomes++
          cityData[city].totalSoldHomes++
        } else {
          div.stats.activeHomes++
          cityData[city].totalActiveHomes++
        }
      }
    })

    Object.values(cityData).forEach(city => {
      city.divisions = Object.values(city.divisions).sort((a, b) => a.name.localeCompare(b.name))
    })

    return cityData
  }, [data, dataSource])

  const filteredByCity = useMemo(() => {
    if (!searchTerm.trim()) return divisionsByCity

    const search = searchTerm.toLowerCase()
    const filtered = {}

    Object.entries(divisionsByCity).forEach(([cityName, cityData]) => {
      const matchingDivisions = cityData.divisions.filter(div =>
        div.name.toLowerCase().includes(search) || cityName.toLowerCase().includes(search)
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

  const orderedCities = useMemo(() => {
    const cities = Object.keys(filteredByCity)
    return cities.sort((a, b) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
  }, [filteredByCity])

  const toggleCity = (cityName) => {
    setExpandedCities(prev => ({ ...prev, [cityName]: !prev[cityName] }))
  }

  const toggleDivision = (divisionName) => {
    setExpandedDivisions(prev => ({ ...prev, [divisionName]: !prev[divisionName] }))
  }

  const totalDivisions = Object.values(divisionsByCity).reduce((acc, city) => acc + city.divisions.length, 0)
  const totalItems = data.length
  const totalCities = Object.keys(divisionsByCity).length
  const totalModel = Object.values(divisionsByCity).reduce((acc, city) => acc + city.totalModelHomes, 0)
  const totalActive = Object.values(divisionsByCity).reduce((acc, city) => acc + city.totalActiveHomes, 0)
  const totalSold = Object.values(divisionsByCity).reduce((acc, city) => acc + city.totalSoldHomes, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full mx-auto"
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
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Friendly */}
      <div className="space-y-4">
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-rose-500" />
              Divisions
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {totalCities} cities · {totalDivisions} divisions · {totalItems} {dataSource === 'properties' ? 'properties' : 'deals'}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="p-2 sm:p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Row - Stacks on mobile */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Data Source Toggle */}
          <div className="flex bg-gray-800/80 border border-gray-700 rounded-xl p-1 backdrop-blur-sm">
            <button
              onClick={() => setDataSource('properties')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dataSource === 'properties'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Inventory
            </button>
            <button
              onClick={() => setDataSource('pipeline')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dataSource === 'pipeline'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Pipeline
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search divisions..."
              className="w-full pl-10 pr-10 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 backdrop-blur-sm transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Layout Toggle */}
          <div className="flex bg-gray-800/80 border border-gray-700 rounded-xl p-1 backdrop-blur-sm self-start sm:self-auto">
            <button
              onClick={() => setLayoutMode('card')}
              className={`p-2 rounded-lg transition-all ${layoutMode === 'card' ? 'bg-rose-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode('list')}
              className={`p-2 rounded-lg transition-all ${layoutMode === 'list' ? 'bg-rose-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats - Mobile Friendly Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-800 to-gray-800/50 rounded-xl p-4 border border-gray-700"
        >
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-gray-400">Cities</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalCities}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl p-4 border border-emerald-500/20"
        >
          <div className="flex items-center gap-2 mb-1">
            <Home className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Model</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{totalModel}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-4 border border-blue-500/20"
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Active</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{totalActive}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-xl p-4 border border-violet-500/20"
        >
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-gray-400">Sold</span>
          </div>
          <p className="text-2xl font-bold text-violet-400">{totalSold}</p>
        </motion.div>
      </div>

      {/* Divisions by City */}
      <div className="space-y-3">
        {orderedCities.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 sm:p-12 text-center border border-gray-700">
            <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-200">No Divisions Found</h3>
            <p className="text-gray-500 mt-2 text-sm">
              {searchTerm ? `No divisions match "${searchTerm}"` : 'No properties with division information'}
            </p>
          </div>
        ) : (
          orderedCities.map((cityName, cityIndex) => {
            const cityData = filteredByCity[cityName]
            const isExpanded = expandedCities[cityName]

            return (
              <motion.div
                key={cityName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cityIndex * 0.05 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
              >
                {/* City Header */}
                <button
                  onClick={() => toggleCity(cityName)}
                  className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                      <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base sm:text-lg font-semibold text-white">{cityName}</h3>
                      <p className="text-xs text-gray-500">
                        {cityData.divisions.length} division{cityData.divisions.length !== 1 ? 's' : ''} · {cityData.totalItems} {dataSource === 'properties' ? 'properties' : 'deals'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Mobile: Compact stats */}
                    <div className="flex sm:hidden items-center gap-1.5 text-xs">
                      <span className="text-emerald-400 font-medium">{cityData.totalModelHomes}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-blue-400 font-medium">{cityData.totalActiveHomes}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-violet-400 font-medium">{cityData.totalSoldHomes}</span>
                    </div>
                    {/* Desktop: Full stats */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="text-center px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Model</p>
                        <p className="text-sm font-bold text-emerald-400">{cityData.totalModelHomes}</p>
                      </div>
                      <div className="text-center px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Active</p>
                        <p className="text-sm font-bold text-blue-400">{cityData.totalActiveHomes}</p>
                      </div>
                      <div className="text-center px-3 py-1.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sold</p>
                        <p className="text-sm font-bold text-violet-400">{cityData.totalSoldHomes}</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </motion.div>
                  </div>
                </button>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-gray-700"
                    >
                      <div className="p-3 sm:p-4">
                        {layoutMode === 'card' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {cityData.divisions.map((division, divIndex) => (
                              <motion.div
                                key={division.name}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: divIndex * 0.03 }}
                                className="bg-gray-900/80 rounded-xl border border-gray-700 overflow-hidden hover:border-rose-500/40 transition-all group"
                              >
                                <div className="h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="p-3 sm:p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-white text-sm sm:text-base truncate pr-2">{division.name}</h4>
                                    <span className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold shrink-0">
                                      {division.stats.total}
                                    </span>
                                  </div>

                                  {/* Stats Grid */}
                                  <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
                                      <p className="text-[10px] text-gray-500 uppercase">Model</p>
                                      <p className="text-sm font-bold text-emerald-400">{division.stats.modelHomes}</p>
                                    </div>
                                    <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                                      <p className="text-[10px] text-gray-500 uppercase">Active</p>
                                      <p className="text-sm font-bold text-blue-400">{division.stats.activeHomes}</p>
                                    </div>
                                    <div className="bg-violet-500/10 rounded-lg p-2 text-center">
                                      <p className="text-[10px] text-gray-500 uppercase">Sold</p>
                                      <p className="text-sm font-bold text-violet-400">{division.stats.soldHomes}</p>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => toggleDivision(division.name)}
                                    className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors py-2 px-3 bg-gray-800/50 rounded-lg"
                                  >
                                    <span>View {dataSource === 'properties' ? 'properties' : 'deals'}</span>
                                    <motion.div animate={{ rotate: expandedDivisions[division.name] ? 180 : 0 }}>
                                      <ChevronDown className="w-4 h-4" />
                                    </motion.div>
                                  </button>

                                  <AnimatePresence>
                                    {expandedDivisions[division.name] && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-3 space-y-2 max-h-48 overflow-y-auto"
                                      >
                                        {division.items.slice(0, 10).map((item, idx) => (
                                          <div key={item.id || idx} className="text-xs bg-gray-800 rounded-lg p-2.5 border border-gray-700/50">
                                            <p className="text-gray-200 truncate font-medium">
                                              {item.FullAddress || item.Address || item['Property Address'] || item.Stname || 'No Address'}
                                            </p>
                                            <p className="text-gray-500 mt-0.5">
                                              {dataSource === 'properties'
                                                ? (item.Status || item['Sold/Available'] || 'No Status')
                                                : (item['Loan Status'] || item.Status || 'No Status')}
                                            </p>
                                          </div>
                                        ))}
                                        {division.items.length > 10 && (
                                          <p className="text-xs text-gray-500 text-center py-1">
                                            +{division.items.length - 10} more
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
                          /* List View - Mobile Friendly */
                          <div className="bg-gray-900/80 rounded-xl border border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[400px]">
                                <thead className="bg-gray-950/80">
                                  <tr>
                                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Division</th>
                                    <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-16">Total</th>
                                    <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-16">Model</th>
                                    <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-16">Active</th>
                                    <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-16">Sold</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/50">
                                  {cityData.divisions.map(division => (
                                    <tr key={division.name} className="hover:bg-gray-800/50 transition-colors">
                                      <td className="px-3 sm:px-4 py-3 font-medium text-white text-sm">{division.name}</td>
                                      <td className="px-3 sm:px-4 py-3 text-center">
                                        <span className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold">
                                          {division.stats.total}
                                        </span>
                                      </td>
                                      <td className="px-3 sm:px-4 py-3 text-center text-emerald-400 text-sm font-medium">{division.stats.modelHomes}</td>
                                      <td className="px-3 sm:px-4 py-3 text-center text-blue-400 text-sm font-medium">{division.stats.activeHomes}</td>
                                      <td className="px-3 sm:px-4 py-3 text-center text-violet-400 text-sm font-medium">{division.stats.soldHomes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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
