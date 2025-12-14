import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

const ToastContext = createContext(null)

const icons = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle
}

const colors = {
  error: 'bg-red-500/10 border-red-500/50 text-red-400',
  success: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
  info: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
  warning: 'bg-amber-500/10 border-amber-500/50 text-amber-400'
}

function Toast({ id, type = 'info', message, onDismiss }) {
  const Icon = icons[type] || icons.info
  const colorClass = colors[type] || colors.info

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 5000)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorClass} shadow-lg backdrop-blur-sm min-w-[280px] max-w-md`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      <button onClick={() => onDismiss(id)} className="p-1 hover:opacity-70 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((type, message) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, message }])
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    error: (message) => addToast('error', message),
    success: (message) => addToast('success', message),
    info: (message) => addToast('info', message),
    warning: (message) => addToast('warning', message),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(t => (
            <Toast key={t.id} {...t} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default Toast
