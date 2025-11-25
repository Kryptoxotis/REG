function StatsOverview({ stats }) {
  if (!stats) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-gray-400">No statistics available</p>
      </div>
    )
  }

  const statsList = Object.entries(stats)

  const cardData = {
    availability: { icon: '📅', gradient: 'from-blue-500 to-cyan-400', bg: 'bg-blue-500/20' },
    directory: { icon: '📁', gradient: 'from-violet-500 to-purple-400', bg: 'bg-violet-500/20' },
    scoreboard: { icon: '🏆', gradient: 'from-amber-500 to-orange-400', bg: 'bg-amber-500/20' },
    model_homes: { icon: '🏠', gradient: 'from-emerald-500 to-green-400', bg: 'bg-emerald-500/20' },
    seller_inquiry: { icon: '💼', gradient: 'from-pink-500 to-rose-400', bg: 'bg-pink-500/20' },
    mortgage_calc: { icon: '💰', gradient: 'from-indigo-500 to-blue-400', bg: 'bg-indigo-500/20' },
    status_report: { icon: '📊', gradient: 'from-red-500 to-pink-400', bg: 'bg-red-500/20' },
    master_calendar: { icon: '📆', gradient: 'from-teal-500 to-cyan-400', bg: 'bg-teal-500/20' }
  }

  const totalRecords = statsList.reduce((sum, [_, data]) => sum + data.count, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Overview</h2>
          <p className="text-gray-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-gray-800 rounded-xl px-4 py-2 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Databases</p>
            <p className="text-xl font-bold text-white">{statsList.length}</p>
          </div>
          <div className="bg-gray-800 rounded-xl px-4 py-2 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Records</p>
            <p className="text-xl font-bold text-indigo-400">{totalRecords.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsList.map(([key, data]) => {
          const card = cardData[key.toLowerCase()] || { icon: '📋', gradient: 'from-gray-500 to-gray-400', bg: 'bg-gray-500/20' }
          return (
            <div key={key} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all duration-300 group">
              <div className={`h-1.5 bg-gradient-to-r ${card.gradient}`}></div>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`${card.bg} w-12 h-12 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                    {card.icon}
                  </div>
                  <span className="text-3xl font-bold text-white">{data.count}</span>
                </div>
                <h3 className="mt-4 font-semibold text-gray-200 capitalize">{data.name.replace(/_/g, ' ')}</h3>
                <p className="text-sm text-gray-500">{data.count === 1 ? 'record' : 'records'}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🗄️</span>
            </div>
            <div>
              <p className="text-white/80 text-sm">Active Databases</p>
              <p className="text-3xl font-bold">{statsList.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
            <div>
              <p className="text-white/80 text-sm">Total Records</p>
              <p className="text-3xl font-bold">{totalRecords.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <p className="text-white/80 text-sm">System Status</p>
              <p className="text-3xl font-bold">Online</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatsOverview
