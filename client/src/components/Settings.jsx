import { motion } from 'framer-motion'
import CSVSync from './CSVSync'

function Settings() {
  return (
    <div className="space-y-6">
      {/* CSV Sync Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CSVSync />
      </motion.div>
    </div>
  )
}

export default Settings
