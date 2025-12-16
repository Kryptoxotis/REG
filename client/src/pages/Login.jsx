import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api'
import { ActivityLogger } from '../utils/activityLogger'
import {
  LeftBrandingPanel,
  EmailForm,
  PasswordForm,
  CreatePasswordForm,
  StatusState
} from '../components/login'

function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('email') // email, password, create-password, terminated, not-found
  const [userStatus, setUserStatus] = useState(null)

  // Handle email submission to check status
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await api.post('/api/auth/login', { email, action: 'check-email' }, { withCredentials: true })
      const { status, message } = response.data

      setUserStatus(status)
      setMessage(message)

      if (status === 'active') {
        setStep('password')
      } else if (status === 'pending') {
        setStep('create-password')
      } else if (status === 'terminated') {
        setStep('terminated')
      } else {
        setStep('not-found')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to check email')
    } finally {
      setLoading(false)
    }
  }

  // Handle login for active users
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/api/auth/login', { email, password }, { withCredentials: true })
      setUser(response.data.user, response.data.token)
      ActivityLogger.login(response.data.user?.fullName || response.data.user?.email || email)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // Handle password creation for pending users
  const handleCreatePassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const response = await api.post('/api/auth/create-password', {
        email,
        password,
        confirmPassword
      }, { withCredentials: true })
      setUser(response.data.user, response.data.token)
      ActivityLogger.login(response.data.user?.fullName || response.data.user?.email || email)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create password')
    } finally {
      setLoading(false)
    }
  }

  // Go back to email step
  const handleBack = () => {
    setStep('email')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setMessage('')
    setUserStatus(null)
  }

  // Get the title based on current step
  const getTitle = () => {
    switch (step) {
      case 'email': return 'Welcome back'
      case 'password': return 'Enter Password'
      case 'create-password': return 'Create Password'
      case 'terminated': return 'Access Denied'
      case 'not-found': return 'Account Not Found'
      default: return 'Welcome'
    }
  }

  // Get the subtitle based on current step
  const getSubtitle = () => {
    switch (step) {
      case 'email': return 'Sign in to access your dashboard'
      case 'password': return message || 'Enter your password to continue'
      case 'create-password': return message || 'Create a password to activate your account'
      case 'terminated': return message || 'You do not have access'
      case 'not-found': return message || 'Please contact admin to create an account'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-900">
      {/* Left Side - Branding */}
      <LeftBrandingPanel />

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-gray-900">
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-center gap-3 mb-8 lg:hidden"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">REG Portal</span>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800 rounded-2xl border border-gray-700 p-6 sm:p-8"
          >
            <div className="text-center mb-6 sm:mb-8">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={step + '-title'}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xl sm:text-2xl font-bold text-white"
                >
                  {getTitle()}
                </motion.h2>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={step + '-subtitle'}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className={`mt-2 text-sm sm:text-base ${step === 'terminated' || step === 'not-found' ? 'text-red-400' : 'text-gray-400'}`}
                >
                  {getSubtitle()}
                </motion.p>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {step === 'email' && (
                <EmailForm
                  email={email}
                  setEmail={setEmail}
                  error={error}
                  loading={loading}
                  onSubmit={handleEmailSubmit}
                />
              )}

              {step === 'password' && (
                <PasswordForm
                  email={email}
                  password={password}
                  setPassword={setPassword}
                  error={error}
                  loading={loading}
                  onSubmit={handleLogin}
                  onBack={handleBack}
                />
              )}

              {step === 'create-password' && (
                <CreatePasswordForm
                  email={email}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  error={error}
                  loading={loading}
                  onSubmit={handleCreatePassword}
                  onBack={handleBack}
                />
              )}

              {(step === 'terminated' || step === 'not-found') && (
                <StatusState type={step} onBack={handleBack} />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
