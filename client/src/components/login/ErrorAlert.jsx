import { motion, AnimatePresence } from 'framer-motion'

function ErrorAlert({ error }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ErrorAlert
