import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'

function DiscordCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Processing...')
  const [error, setError] = useState(null)

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const errorParam = searchParams.get('error')

      if (errorParam) {
        setError(`Discord authorization failed: ${errorParam}`)
        setTimeout(() => navigate('/'), 3000)
        return
      }

      if (!code) {
        setError('No authorization code received')
        setTimeout(() => navigate('/'), 3000)
        return
      }

      try {
        setStatus('Connecting your Discord account...')

        const response = await api.post('/api/discord/auth/callback', {
          code,
          state
        }, { withCredentials: true })

        if (response.data.success) {
          setStatus(`Connected as ${response.data.discordUsername}!`)
          setTimeout(() => navigate('/'), 1500)
        } else {
          setError('Failed to connect Discord account')
          setTimeout(() => navigate('/'), 3000)
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to connect Discord')
        setTimeout(() => navigate('/'), 3000)
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 text-center">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
            <p className="text-red-400">{error}</p>
            <p className="text-gray-500 text-sm mt-4">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Discord</h2>
            <p className="text-gray-400">{status}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default DiscordCallback
