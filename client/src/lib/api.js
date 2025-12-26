import axios from 'axios'

// Create axios instance with default config
// CSRF protection is handled by SameSite=Lax cookies on Vercel
// The HttpOnly authToken cookie won't be sent with cross-origin requests
const api = axios.create({
  baseURL: '',
  withCredentials: true
})

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Network error - no response received (server down, no internet, CORS)
    if (!error.response) {
      const networkError = new Error('Network error - please check your connection')
      networkError.isNetworkError = true
      networkError.originalError = error
      console.error('Network error:', error.message)
      return Promise.reject(networkError)
    }

    const status = error.response.status

    // 401 Unauthorized - session expired
    if (status === 401) {
      // Only redirect if not already on login page to prevent loop
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // 5xx Server errors - provide user-friendly message
    if (status >= 500) {
      const serverError = new Error(
        error.response.data?.error || 'Server error - please try again later'
      )
      serverError.isServerError = true
      serverError.status = status
      serverError.originalError = error
      console.error(`Server error (${status}):`, error.response.data)
      return Promise.reject(serverError)
    }

    // 4xx Client errors - pass through with original message
    return Promise.reject(error)
  }
)

// Export configured axios instance as default
export default api
