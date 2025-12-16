import { motion } from 'framer-motion'

function StatusState({ type, onBack }) {
  const isTerminated = type === 'terminated'

  const config = {
    terminated: {
      icon: (
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      iconBg: 'bg-red-500/10',
      message: 'Your account access has been revoked. If you believe this is an error, please contact your administrator.'
    },
    'not-found': {
      icon: (
        <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      iconBg: 'bg-yellow-500/10',
      message: 'No account found with this email address. Please contact your administrator to create an account.'
    }
  }

  const { icon, iconBg, message } = config[type] || config['not-found']

  return (
    <motion.div
      key={`${type}-view`}
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="space-y-4 sm:space-y-5"
    >
      <div className="text-center py-6">
        <div className={`w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          {icon}
        </div>
        <p className="text-gray-400 text-sm">
          {message}
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onBack}
        className="w-full bg-gray-700 text-white py-3 px-4 rounded-xl font-semibold hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all"
      >
        Try Different Email
      </motion.button>
    </motion.div>
  )
}

export default StatusState
