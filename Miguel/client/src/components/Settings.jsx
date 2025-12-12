import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'

function Settings() {
  const [ipData, setIpData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newIP, setNewIP] = useState('')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchIPData()
  }, [])

  const fetchIPData = async () => {
    try {
      const response = await axios.get('/api/auth/ip-whitelist', { withCredentials: true })
      setIpData(response.data)
    } catch (err) {
      console.error('Failed to fetch IP data:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: 'Copied to clipboard!' })
    setTimeout(() => setMessage(null), 2000)
  }

  const handleAddIP = () => {
    if (!newIP.trim()) return
    // Show instructions since we need to update the code
    setMessage({
      type: 'info',
      text: `To add ${newIP}, update api/auth/check-ip.js and api/auth/ip-whitelist.js, then redeploy.`
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="text-2xl">🔐</span>
            IP Whitelist Settings
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Whitelisted IPs can skip the login screen
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Your Current IP */}
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Your Current IP</p>
                <p className="text-lg font-mono text-white mt-1">{ipData?.yourIP || 'Unknown'}</p>
              </div>
              <div className="flex items-center gap-2">
                {ipData?.isWhitelisted ? (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                    Whitelisted
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium">
                    Not Whitelisted
                  </span>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyToClipboard(ipData?.yourIP)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Whitelisted IPs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Whitelisted IP Addresses</h3>
            <div className="space-y-2">
              {ipData?.whitelistedIPs?.length > 0 ? (
                ipData.whitelistedIPs.map((ip, idx) => (
                  <motion.div
                    key={ip}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      <span className="font-mono text-white">{ip}</span>
                      {ip === ipData?.yourIP && (
                        <span className="text-xs text-gray-500">(You)</span>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => copyToClipboard(ip)}
                      className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </motion.button>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No IPs whitelisted</p>
              )}
            </div>
          </div>

          {/* Add New IP */}
          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Add New IP</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="Enter IP address (e.g., 192.168.1.1)"
                className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddIP}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                Add IP
              </motion.button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Note: Adding/removing IPs requires updating the code and redeploying.
            </p>
          </div>

          {/* Message */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl ${
                message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                'bg-blue-500/10 text-blue-400 border border-blue-500/30'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Instructions Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800 rounded-2xl border border-gray-700 p-6"
      >
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <span>📝</span> How to Manage IPs
        </h3>
        <div className="space-y-3 text-sm text-gray-400">
          <p>To add or remove IP addresses:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Edit <code className="bg-gray-900 px-2 py-0.5 rounded text-indigo-400">api/auth/check-ip.js</code></li>
            <li>Edit <code className="bg-gray-900 px-2 py-0.5 rounded text-indigo-400">api/auth/ip-whitelist.js</code></li>
            <li>Add/remove IPs from the <code className="text-indigo-400">WHITELISTED_IPS</code> array</li>
            <li>Commit and push to GitHub</li>
            <li>Vercel will automatically redeploy</li>
          </ol>
        </div>
      </motion.div>
    </div>
  )
}

export default Settings
