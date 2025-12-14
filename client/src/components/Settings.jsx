import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon } from 'lucide-react'
import CSVSync from './CSVSync'
import FieldSettings from './FieldSettings'

function Settings() {
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* CSV Sync Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <CSVSync />
      </motion.div>

      {/* Field Display Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800 rounded-2xl border border-gray-700 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-xl">
              <SettingsIcon className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Field Display Settings</h2>
              <p className="text-sm text-gray-400">Configure which fields show in each database view</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFieldSettingsOpen(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
          >
            Configure Fields
          </motion.button>
        </div>
      </motion.div>

      {/* Field Settings Modal */}
      <FieldSettings
        isOpen={fieldSettingsOpen}
        onClose={() => setFieldSettingsOpen(false)}
      />
    </div>
  )
}

export default Settings
