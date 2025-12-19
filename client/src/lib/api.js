import axios from 'axios'

// Create axios instance with default config
// CSRF protection is handled by SameSite=Lax cookies on Vercel
// The HttpOnly authToken cookie won't be sent with cross-origin requests
const api = axios.create({
  baseURL: '',
  withCredentials: true
})

// Handle 401 errors (session expired)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If we get 401 Unauthorized, redirect to login
    if (error.response?.status === 401) {
      // Only redirect if not already on login page to prevent loop
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Export configured axios instance as default
export default api
