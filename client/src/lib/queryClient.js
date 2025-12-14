import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 30 seconds before data is considered stale
      staleTime: 30 * 1000,
      // Cache time: 5 minutes before cache is garbage collected
      gcTime: 5 * 60 * 1000,
      // Retry failed requests twice
      retry: 2,
      // Don't refetch on window focus in development
      refetchOnWindowFocus: import.meta.env.PROD,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
  },
})
