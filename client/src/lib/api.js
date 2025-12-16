import axios from 'axios'

// Create axios instance with default config
const api = axios.create({
  baseURL: '',
  withCredentials: true
})

// CSRF token storage
let csrfToken = null

// Fetch CSRF token from server
export async function fetchCsrfToken() {
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    })
    if (response.ok) {
      const data = await response.json()
      csrfToken = data.csrfToken
      return csrfToken
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error)
  }
  return null
}

// Get current CSRF token (fetch if not cached)
export async function getCsrfToken() {
  if (!csrfToken) {
    await fetchCsrfToken()
  }
  return csrfToken
}

// Add CSRF token to request headers
api.interceptors.request.use(async (config) => {
  // Only add CSRF token for mutating requests
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    if (!csrfToken) {
      await fetchCsrfToken()
    }
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
  }
  return config
})

// Handle CSRF token errors (refresh token and retry)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.error === 'Invalid CSRF token') {
      // Refresh CSRF token
      await fetchCsrfToken()

      // Retry original request with new token
      const originalRequest = error.config
      if (csrfToken) {
        originalRequest.headers['X-CSRF-Token'] = csrfToken
        return api(originalRequest)
      }
    }
    return Promise.reject(error)
  }
)

// Export configured axios instance as default
export default api
