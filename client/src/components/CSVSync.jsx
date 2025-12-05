import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function CSVSync() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const N8N_WEBHOOK_URL = 'http://100.89.5.69:5678/webhook/properties-sync'

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const fileName = droppedFile.name.toLowerCase()
      if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        setFile(droppedFile)
        setError(null)
      } else {
        setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)')
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data)
      setFile(null)
    } catch (err) {
      setError(err.message || 'Upload failed. Make sure n8n is running and the workflow is active.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📤</span>
        <div>
          <h3 className="text-lg font-semibold text-white">Sync Properties from Spreadsheet</h3>
          <p className="text-sm text-gray-400">Upload a CSV or Excel file to sync with Notion database</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive
            ? 'border-indigo-500 bg-indigo-500/10'
            : file
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-gray-600 hover:border-gray-500'
        }`}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {file ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <span className="text-4xl mb-2 block">📄</span>
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-sm text-gray-400 mt-1">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </motion.div>
        ) : (
          <div>
            <span className="text-4xl mb-2 block text-gray-500">📁</span>
            <p className="text-gray-300">Drag & drop your file here</p>
            <p className="text-sm text-gray-500 mt-1">CSV or Excel (.xlsx, .xls)</p>
          </div>
        )}
      </div>

      {/* Upload button */}
      <motion.button
        onClick={handleUpload}
        disabled={!file || uploading}
        whileHover={{ scale: file && !uploading ? 1.02 : 1 }}
        whileTap={{ scale: file && !uploading ? 0.98 : 1 }}
        className={`w-full mt-4 py-3 px-4 rounded-xl font-medium transition-all ${
          file && !uploading
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            />
            Syncing...
          </span>
        ) : (
          'Sync Properties'
        )}
      </motion.button>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl"
          >
            <div className="flex items-center gap-2 text-emerald-400 font-medium mb-2">
              <span>✓</span>
              <span>{result.message || 'Sync completed!'}</span>
            </div>
            {result.details && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
                  <p className="text-emerald-300 font-bold">{result.details.added || 0}</p>
                  <p className="text-gray-400">Added</p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                  <p className="text-blue-300 font-bold">{result.details.updated || 0}</p>
                  <p className="text-gray-400">Updated</p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-2 text-center">
                  <p className="text-red-300 font-bold">{result.details.deleted || 0}</p>
                  <p className="text-gray-400">Deleted</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl"
          >
            <div className="flex items-center gap-2 text-red-400">
              <span>✕</span>
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info */}
      <div className="mt-4 p-3 bg-gray-700/30 rounded-lg text-xs text-gray-400">
        <p className="font-medium text-gray-300 mb-1">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Properties in CSV but not in database will be <span className="text-emerald-400">added</span></li>
          <li>Properties with different status will be <span className="text-blue-400">updated</span></li>
          <li>Properties in database but not in CSV will be <span className="text-red-400">archived</span></li>
          <li>Address is used as the unique identifier</li>
        </ul>
      </div>
    </div>
  )
}

export default CSVSync
