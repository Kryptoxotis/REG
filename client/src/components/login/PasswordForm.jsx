import { motion } from 'framer-motion'
import LoadingSpinner from './LoadingSpinner'
import ErrorAlert from './ErrorAlert'

function PasswordForm({ email, password, setPassword, error, loading, onSubmit, onBack }) {
  return (
    <motion.form
      key="password-form"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      onSubmit={onSubmit}
      className="space-y-4 sm:space-y-5"
    >
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Email
        </label>
        <div className="px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-400 text-sm sm:text-base">
          {email}
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-gray-300 mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm sm:text-base"
          placeholder="Enter your password"
        />
      </div>

      <ErrorAlert error={error} />

      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onBack}
          className="px-4 py-3 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all"
        >
          Back
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
        >
          {loading ? <LoadingSpinner text="Signing in..." /> : 'Sign In'}
        </motion.button>
      </div>
    </motion.form>
  )
}

export default PasswordForm
