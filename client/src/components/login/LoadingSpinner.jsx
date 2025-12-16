import { motion } from 'framer-motion'

function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full inline-block"
      />
      {text}
    </span>
  )
}

export default LoadingSpinner
