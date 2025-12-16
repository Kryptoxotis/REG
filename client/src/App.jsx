import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ToastProvider } from './components/Toast'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Use credentials to send HttpOnly cookie automatically
      const response = await fetch('/api/auth/check', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        // Token invalid or expired
        localStorage.removeItem('authToken') // Clean up legacy storage
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('authToken')
    } finally {
      setLoading(false)
    }
  }

  const handleSetUser = (userData, token) => {
    if (userData && token) {
      // Token is now set via HttpOnly cookie by server
      // Keep localStorage for backward compatibility during migration
      localStorage.setItem('authToken', token)
      setUser(userData)
    } else if (userData === null) {
      localStorage.removeItem('authToken')
      setUser(null)
    } else {
      setUser(userData)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={!user ? <Login setUser={handleSetUser} /> : <Navigate to="/" />}
              />
              <Route
                path="/"
                element={
                  user ? (
                    user.role === 'admin' ? <AdminDashboard user={user} setUser={handleSetUser} /> : <EmployeeDashboard user={user} setUser={handleSetUser} />
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
