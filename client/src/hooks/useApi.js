import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/api'

// Base API call function using CSRF-protected client
const api = {
  get: async (url) => {
    const { data } = await apiClient.get(url)
    return data
  },
  post: async (url, body) => {
    const { data } = await apiClient.post(url, body)
    return data
  },
  patch: async (url, body) => {
    const { data } = await apiClient.patch(url, body)
    return data
  },
  delete: async (url) => {
    const { data } = await apiClient.delete(url)
    return data
  }
}

// ==================== Dashboard Stats ====================

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/databases/stats'),
    staleTime: 60 * 1000 // Stats can be stale for 1 minute
    // Note: No placeholderData - components should handle loading/error states
  })
}

export function useStatsOverview() {
  return useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => api.get('/api/databases/stats'),
    staleTime: 60 * 1000
    // Note: No placeholderData - components should handle loading/error states
  })
}

// ==================== Database Queries ====================

export function useDatabase(databaseKey, options = {}) {
  return useQuery({
    queryKey: ['database', databaseKey],
    queryFn: async () => {
      const response = await api.get(`/api/databases/${databaseKey}`)
      // Handle paginated response format { data, pagination }
      return response.data || response
    },
    enabled: !!databaseKey,
    ...options
  })
}

export function useDatabaseRefresh(databaseKey) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['database', databaseKey] })
}

// ==================== Pipeline ====================

export function usePipeline() {
  return useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const response = await api.get('/api/databases/PIPELINE')
      return response.data || response
    },
    staleTime: 30 * 1000
  })
}

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await api.get('/api/databases/PROPERTIES')
      return response.data || response
    },
    staleTime: 30 * 1000
  })
}

export function useClosedDeals() {
  return useQuery({
    queryKey: ['closed-deals'],
    queryFn: async () => {
      const response = await api.get('/api/databases/CLOSED_DEALS')
      return response.data || response
    },
    staleTime: 60 * 1000 // Closed deals change less frequently
  })
}

// ==================== Team Members ====================

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const response = await api.get('/api/databases/TEAM_MEMBERS')
      return response.data || response
    },
    staleTime: 2 * 60 * 1000 // Team data is more stable
  })
}

// ==================== Clients ====================

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await api.get('/api/databases/CLIENTS')
      return response.data || response
    },
    staleTime: 60 * 1000
  })
}

// ==================== Schedule ====================

export function useSchedule() {
  return useQuery({
    queryKey: ['schedule'],
    queryFn: async () => {
      const response = await api.get('/api/databases/SCHEDULE')
      return response.data || response
    },
    staleTime: 30 * 1000
  })
}

// ==================== Activity Log ====================

export function useActivityLog() {
  return useQuery({
    queryKey: ['activity-log'],
    queryFn: async () => {
      const response = await api.get('/api/databases/ACTIVITY_LOG')
      return response.data || response
    },
    staleTime: 30 * 1000
  })
}

// ==================== Mutations ====================

export function useCreateRecord(databaseKey) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => api.post('/api/databases/actions', { action: 'create', database: databaseKey, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', databaseKey] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })
}

export function useUpdateRecord(databaseKey) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pageId, data }) => api.post('/api/databases/actions', { action: 'update', pageId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', databaseKey] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })
}

// ==================== Invalidation Helpers ====================

export function useInvalidateAll() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

export function useInvalidateDatabase(databaseKey) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['database', databaseKey] })
}
