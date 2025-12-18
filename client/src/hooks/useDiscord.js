import { useState, useEffect, useRef, useCallback } from 'react'
import Pusher from 'pusher-js'
import api from '../lib/api'

// Pusher config
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'us2'

export function useDiscord() {
  const [connectionMode, setConnectionMode] = useState('connecting') // 'realtime' | 'polling' | 'connecting' | 'disconnected'
  const [discordStatus, setDiscordStatus] = useState({ connected: false, loading: true })
  const [channels, setChannels] = useState({})
  const [messages, setMessages] = useState([])
  const [messageCache, setMessageCache] = useState({})
  const [activeChannel, setActiveChannel] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const pusherRef = useRef(null)
  const pusherChannelRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const discordUserRef = useRef(null)

  // Check Discord connection status via REST
  const checkDiscordStatus = useCallback(async () => {
    try {
      const response = await api.get('/api/discord/status', { withCredentials: true })
      setDiscordStatus({ ...response.data, loading: false })
      discordUserRef.current = response.data.connected ? response.data : null
      return response.data
    } catch (err) {
      setDiscordStatus({ connected: false, loading: false })
      return { connected: false }
    }
  }, [])

  // Initialize connection
  useEffect(() => {
    async function init() {
      const status = await checkDiscordStatus()

      if (!status.connected) {
        setConnectionMode('disconnected')
        return
      }

      // Initialize Pusher if configured
      if (PUSHER_KEY) {
        try {
          const pusher = new Pusher(PUSHER_KEY, {
            cluster: PUSHER_CLUSTER,
            forceTLS: true
          })

          pusher.connection.bind('connected', () => {
            console.log('Pusher connected')
            setConnectionMode('realtime')
          })

          pusher.connection.bind('error', (err) => {
            console.error('Pusher error:', err)
            setConnectionMode('polling')
          })

          pusherRef.current = pusher
        } catch (err) {
          console.log('Pusher setup failed, using polling')
          setConnectionMode('polling')
        }
      } else {
        // No Pusher configured, use polling only
        setConnectionMode('polling')
      }

      // Fetch channels
      fetchChannelsREST()
    }

    init()

    return () => {
      if (pusherRef.current) {
        pusherRef.current.disconnect()
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  // Fetch channels via REST
  const fetchChannelsREST = useCallback(async () => {
    try {
      const response = await api.get('/api/discord/channels', { withCredentials: true })
      setChannels(response.data.channels)

      // Auto-select first channel
      const allChannels = Object.values(response.data.channels).flat()
      const generalChannel = allChannels.find(c => c.name === 'general')
      if (generalChannel) {
        setActiveChannel(generalChannel)
      } else if (allChannels.length > 0) {
        setActiveChannel(allChannels[0])
      }
    } catch (err) {
      setError('Failed to load channels')
    }
  }, [])

  // Fetch messages via REST
  const fetchMessagesREST = useCallback(async (channelId, isInitial = false) => {
    if (!channelId) return

    try {
      if (isInitial) setLoading(true)
      const response = await api.get(`/api/discord/messages?channelId=${channelId}`, { withCredentials: true })
      const newMessages = response.data.messages

      setMessages(prev => {
        // Only update if actually different (compare last message id)
        const lastPrevId = prev[prev.length - 1]?.id
        const lastNewId = newMessages[newMessages.length - 1]?.id
        if (lastPrevId === lastNewId && prev.length === newMessages.length) {
          return prev // No change, don't trigger re-render
        }
        return newMessages
      })
      setMessageCache(prev => ({ ...prev, [channelId]: newMessages }))
      setError(null)
    } catch (err) {
      if (isInitial) setError('Failed to load messages')
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  // Handle channel change - subscribe to Pusher channel
  useEffect(() => {
    if (!activeChannel) return

    // Clear previous polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    // Unsubscribe from previous Pusher channel
    if (pusherChannelRef.current && pusherRef.current) {
      pusherRef.current.unsubscribe(pusherChannelRef.current.name)
      pusherChannelRef.current = null
    }

    // Load from cache immediately
    if (messageCache[activeChannel.id]) {
      setMessages(messageCache[activeChannel.id])
    } else {
      setMessages([])
    }

    // Fetch initial messages
    fetchMessagesREST(activeChannel.id, true)

    // Subscribe to Pusher channel for real-time updates (if Pusher is connected)
    if (pusherRef.current) {
      const channelName = `discord-${activeChannel.id}`
      const pusherChannel = pusherRef.current.subscribe(channelName)

      pusherChannel.bind('new-message', (data) => {
        // Add message if not already present
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev
          return [...prev, data]
        })
        setMessageCache(prev => {
          const cached = prev[activeChannel.id] || []
          if (cached.some(m => m.id === data.id)) return prev
          return { ...prev, [activeChannel.id]: [...cached, data] }
        })
      })

      pusherChannelRef.current = pusherChannel
    }

    // Set up polling as backup (poll every 3s to catch Discord-only messages)
    pollIntervalRef.current = setInterval(() => {
      fetchMessagesREST(activeChannel.id, false)
    }, 3000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (pusherChannelRef.current && pusherRef.current) {
        pusherRef.current.unsubscribe(`discord-${activeChannel.id}`)
      }
    }
  }, [activeChannel?.id])

  // Send message with optimistic update
  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || !activeChannel) return false

    const user = discordUserRef.current

    // Optimistic update - add message immediately
    const tempId = `temp-${Date.now()}`
    const optimisticMessage = {
      id: tempId,
      content: content,
      author: {
        id: user?.discordId || 'unknown',
        username: user?.discordUsername || 'You',
        avatar: user?.discordAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'
      },
      timestamp: Date.now(),
      attachments: [],
      pending: true
    }

    setMessages(prev => [...prev, optimisticMessage])

    try {
      const response = await api.post(`/api/discord/messages?channelId=${activeChannel.id}`, {
        content
      }, { withCredentials: true })

      // Replace temp message with real one
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...response.data.message, pending: false } : m
      ))
      setMessageCache(prev => ({
        ...prev,
        [activeChannel.id]: prev[activeChannel.id]?.map(m =>
          m.id === tempId ? { ...response.data.message, pending: false } : m
        ) || []
      }))

      return true
    } catch (err) {
      // Remove failed message
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setError('Failed to send message')
      return false
    }
  }, [activeChannel])

  // Connect Discord (redirect to OAuth)
  const connectDiscord = useCallback(async () => {
    try {
      const response = await api.get('/api/discord/auth/url', { withCredentials: true })
      window.location.href = response.data.url
    } catch (err) {
      setError('Failed to start Discord connection')
    }
  }, [])

  // Disconnect Discord
  const disconnectDiscord = useCallback(async () => {
    try {
      await api.post('/api/discord/disconnect', {}, { withCredentials: true })
      if (pusherRef.current) {
        pusherRef.current.disconnect()
      }
      setDiscordStatus({ connected: false, loading: false })
      setChannels({})
      setActiveChannel(null)
      setMessages([])
      setConnectionMode('disconnected')
    } catch (err) {
      setError('Failed to disconnect')
    }
  }, [])

  return {
    // Connection state
    connectionMode,
    discordStatus,
    error,
    loading,
    setError,

    // Channel state
    channels,
    activeChannel,
    setActiveChannel,

    // Message state
    messages,

    // Actions
    sendMessage,
    connectDiscord,
    disconnectDiscord
  }
}
