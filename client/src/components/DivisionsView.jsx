import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, X, MapPin, Building2, RefreshCw } from 'lucide-react'
import api from '../lib/api'

// City to Edwards Co. mapping (same as OfficeOverview)
const OFFICE_MAP = {
  'El Paso': ["Edward's LLC.", "Edwards LLC", "El Paso"],
  'Las Cruces': ["Edward's NM.", "Edwards NM", "Las Cruces", "New Mexico"],
  'McAllen': ["Edward's RGV", "Edwards RGV", "McAllen"],
  'San Antonio': ["San Antonio"]
}

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

function DivisionsView({ initialCity, onClearCity }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedCities, setExpandedCities] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [dataSource, setDataSource] = useState('properties')

  useEffect(() => {
    fetchData()
  }, [dataSource])

  // Auto-expand city when navigating from OfficeOverview
  useEffect(() => {
    if (initialCity) {
      setExpandedCities(prev => ({ ...prev, [initialCity]: true }))
    }
  }, [initialCity])

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
          totalSoldHomes: 0,
          totalUnits: 0,
          totalVolume: 0
        }
      }

      if (!cityData[city].divisions[subdivision]) {
        cityData[city].divisions[subdivision] = {
          name: subdivision,
          stats: { modelHomes: 0, activeHomes: 0, soldHomes: 0, total: 0, units: 0, volume: 0 }
        }
      }

      const div = cityData[city].divisions[subdivision]
      div.stats.total++
      cityData[city].totalItems++

      // Count units and volume
      div.stats.units++
      cityData[city].totalUnits++

      // Get price/volume from various possible fields
      const price = parseFloat(
        item['Sale Price'] || item['SalePrice'] || item['Price'] ||
        item['Loan Amount'] || item['LoanAmount'] || item['Contract Price'] ||
        item['Base Price'] || item['Total Price'] || 0
      ) || 0
      div.stats.volume += price
      cityData[city].totalVolume += price

      const statusLower = status.toLowerCase()
      if (dataSource === 'properties') {
        if (statusLower.includes('model')) {
          div.stats.modelHomes++
          cityData[city].totalModelHomes++
        } else if (statusLower === 'available' || statusLower === 'inventory') {
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

  const totalDivisions = Object.values(divisionsByCity).reduce((acc, city) => acc + city.divisions.length, 0)
  const totalItems = data.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full mx-auto"
          />
          <p className="mt-4 text-gray-400 text-sm">Loading divisions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-semibold text-white">Divisions</h2>
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setDataSource('properties')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                dataSource === 'properties'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Inventory
            </button>
            <button
              onClick={() => setDataSource('pipeline')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                dataSource === 'pipeline'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Pipeline
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-8 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-rose-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {orderedCities.length} cities · {totalDivisions} divisions · {totalItems} {dataSource === 'properties' ? 'properties' : 'deals'}
        </p>
      </div>

      {/* Cities */}
      <div className="space-y-2">
        {orderedCities.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl p-8 text-center">
            <Building2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No divisions found</p>
          </div>
        ) : (
          orderedCities.map((cityName) => {
            const cityData = filteredByCity[cityName]
            const isExpanded = expandedCities[cityName]

            return (
              <div
                key={cityName}
                className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden"
              >
                {/* City Header */}
                <button
                  onClick={() => toggleCity(cityName)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-medium text-white">{cityName}</h3>
                      <p className="text-[10px] text-gray-500">
                        {cityData.divisions.length} subdivisions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-emerald-400">{cityData.totalModelHomes}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-blue-400">{cityData.totalActiveHomes}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-violet-400">{cityData.totalSoldHomes}</span>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </motion.div>
                  </div>
                </button>

                {/* Divisions Table */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-700/50">
                        {/* Table Header */}
                        <div className="grid grid-cols-6 gap-2 px-3 py-2 bg-gray-900/50 text-[10px] text-gray-500 uppercase tracking-wider">
                          <div className="col-span-2 sm:col-span-1">Subdivision</div>
                          <div className="text-center hidden sm:block">Model</div>
                          <div className="text-center hidden sm:block">Active</div>
                          <div className="text-center hidden sm:block">Sold</div>
                          <div className="text-center">Units</div>
                          <div className="text-right">Volume</div>
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-gray-700/30">
                          {cityData.divisions.map((division) => (
                            <div
                              key={division.name}
                              className="grid grid-cols-6 gap-2 px-3 py-2 hover:bg-gray-700/20 transition-colors"
                            >
                              <div className="col-span-2 sm:col-span-1 text-sm text-white truncate">{division.name}</div>
                              <div className="text-center hidden sm:block">
                                <span className="text-sm font-medium text-emerald-400">
                                  {division.stats.modelHomes}
                                </span>
                              </div>
                              <div className="text-center hidden sm:block">
                                <span className="text-sm font-medium text-blue-400">
                                  {division.stats.activeHomes}
                                </span>
                              </div>
                              <div className="text-center hidden sm:block">
                                <span className="text-sm font-medium text-violet-400">
                                  {division.stats.soldHomes}
                                </span>
                              </div>
                              <div className="text-center">
                                <span className="text-sm font-medium text-amber-400">
                                  {division.stats.units}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-medium text-cyan-400">
                                  ${division.stats.volume >= 1000000
                                    ? (division.stats.volume / 1000000).toFixed(1) + 'M'
                                    : division.stats.volume >= 1000
                                      ? (division.stats.volume / 1000).toFixed(0) + 'K'
                                      : division.stats.volume.toFixed(0)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Totals Row */}
                        <div className="grid grid-cols-6 gap-2 px-3 py-2 bg-gray-900/30 border-t border-gray-700/50">
                          <div className="col-span-2 sm:col-span-1 text-xs font-medium text-gray-400">Total</div>
                          <div className="text-center hidden sm:block">
                            <span className="text-xs font-bold text-emerald-400">
                              {cityData.totalModelHomes}
                            </span>
                          </div>
                          <div className="text-center hidden sm:block">
                            <span className="text-xs font-bold text-blue-400">
                              {cityData.totalActiveHomes}
                            </span>
                          </div>
                          <div className="text-center hidden sm:block">
                            <span className="text-xs font-bold text-violet-400">
                              {cityData.totalSoldHomes}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-bold text-amber-400">
                              {cityData.totalUnits}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-cyan-400">
                              ${cityData.totalVolume >= 1000000
                                ? (cityData.totalVolume / 1000000).toFixed(1) + 'M'
                                : cityData.totalVolume >= 1000
                                  ? (cityData.totalVolume / 1000).toFixed(0) + 'K'
                                  : cityData.totalVolume.toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default DivisionsView
