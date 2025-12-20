import { useCallback, useRef } from 'react'
import api from '../lib/api'

/**
 * Hook for lightweight permission verification on navigation
 * Checks user status and role against the database
 * Handles terminated accounts, pending accounts, and role changes
 */
export function usePermissionCheck({ onLogout, onRoleChange, onPendingAccount }) {
  const lastCheckRef = useRef(0)
  const THROTTLE_MS = 5000 // Don't check more than once every 5 seconds

  const verifyPermissions = useCallback(async () => {
    const now = Date.now()

    // Throttle requests to avoid hammering the server
    if (now - lastCheckRef.current < THROTTLE_MS) {
      return { valid: true, throttled: true }
    }

    lastCheckRef.current = now

    try {
      const response = await api.get('/auth/verify-permissions')
      const result = response.data

      if (!result.valid) {
        // Handle invalid states
        if (result.action === 'logout') {
          if (onLogout) {
            onLogout(result.message || 'Your session has ended.')
          }
          return result
        }

        if (result.action === 'create-password') {
          if (onPendingAccount) {
            onPendingAccount(result.message || 'Please complete account setup.')
          }
          return result
        }
      }

      // Handle role changes
      if (result.roleChanged && onRoleChange) {
        onRoleChange(result.newRole, result.message)
      }

      return result
    } catch (error) {
      // On 401, trigger logout
      if (error.response?.status === 401) {
        if (onLogout) {
          onLogout('Session expired. Please log in again.')
        }
        return { valid: false, action: 'logout' }
      }

      // On other errors, don't block navigation
      console.error('Permission check failed:', error)
      return { valid: true, error: error.message }
    }
  }, [onLogout, onRoleChange, onPendingAccount])

  return { verifyPermissions }
}

export default usePermissionCheck
