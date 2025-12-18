import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import api from '../lib/api'

// WebSocket server URL - set this to your Discord server URL when running
const WS_URL = import.meta.env.VITE_DISCORD_WS_URL || null

export function useDiscord() {
  const [connectionMode, setConnectionMode] = useState('connecting') // 'websocket' | 'polling' | 'connecting' | 'disconnected'
  const [discordStatus, setDiscordStatus] = useState({ connected: false, loading: true })
  const [channels, setChannels] = useState({})
  const [messages, setMessages] = useState([])
  const [messageCache, setMessageCache] = useState({})
  const [activeChannel, setActiveChannel] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const socketRef = useRef(null)
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

      // Try WebSocket connection first
      if (WS_URL) {
        try {
          const socket = io(WS_URL, {
            transports: ['websocket'],
            timeout: 5000
          })

          socket.on('connect', () => {
            console.log('WebSocket connected')
            // Authenticate with Discord ID
            socket.emit('auth', { discordId: status.discordId })
          })

          socket.on('authenticated', () => {
            console.log('WebSocket authenticated')
            setConnectionMode('websocket')
            socket.emit('getChannels')
          })

          socket.on('channels', (data) => {
            setChannels(data.channels)
          })

          socket.on('messages', (data) => {
            if (data.channelId === activeChannel?.id) {
              setMessages(data.messages)
              setMessageCache(prev => ({ ...prev, [data.channelId]: data.messages }))
            }
          })

          socket.on('message', (data) => {
            // New message received
            if (data.channelId === activeChannel?.id) {
              setMessages(prev => [...prev, data.message])
              setMessageCache(prev => ({
                ...prev,
                [data.channelId]: [...(prev[data.channelId] || []), data.message]
              }))
            }
          })

          socket.on('error', (data) => {
            console.error('WebSocket error:', data.message)
          })

          socket.on('connect_error', () => {
            console.log('WebSocket connection failed, falling back to polling')
            socket.disconnect()
            setConnectionMode('polling')
            fetchChannelsREST()
          })

          socket.on('disconnect', () => {
            console.log('WebSocket disconnected')
            if (connectionMode === 'websocket') {
              setConnectionMode('polling')
            }
          })

          socketRef.current = socket

        } catch (err) {
          console.log('WebSocket setup failed, using polling')
          setConnectionMode('polling')
          fetchChannelsREST()
        }
      } else {
        // No WebSocket URL configured, use polling
        setConnectionMode('polling')
        fetchChannelsREST()
      }
    }

    init()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  // Fetch channels via REST (polling fallback)
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

  // Fetch messages via REST (polling fallback)
  const fetchMessagesREST = useCallback(async (channelId) => {
    if (!channelId) return

    const cachedMessages = messageCache[channelId] || []

    try {
      setLoading(cachedMessages.length === 0 && messages.length === 0)
      const response = await api.get(`/api/discord/messages?channelId=${channelId}`, { withCredentials: true })
      const newMessages = response.data.messages

      // Only update if changed
      const lastCachedId = cachedMessages[cachedMessages.length - 1]?.id
      const lastNewId = newMessages[newMessages.length - 1]?.id

      if (lastCachedId !== lastNewId || cachedMessages.length !== newMessages.length) {
        setMessages(newMessages)
        setMessageCache(prev => ({ ...prev, [channelId]: newMessages }))
      }
      setError(null)
    } catch (err) {
      if (cachedMessages.length === 0 && messages.length === 0) {
        setError('Failed to load messages')
      }
    } finally {
      setLoading(false)
    }
  }, [messageCache, messages.length])

  // Handle channel change
  useEffect(() => {
    if (!activeChannel) return

    // Clear polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    // Load from cache immediately
    if (messageCache[activeChannel.id]) {
      setMessages(messageCache[activeChannel.id])
    }

    if (connectionMode === 'websocket' && socketRef.current) {
      // WebSocket mode
      socketRef.current.emit('subscribe', { channelId: activeChannel.id })
      socketRef.current.emit('getMessages', { channelId: activeChannel.id })
    } else if (connectionMode === 'polling') {
      // Polling mode
      fetchMessagesREST(activeChannel.id)
      pollIntervalRef.current = setInterval(() => {
        fetchMessagesREST(activeChannel.id)
      }, 3000)
    }

    return () => {
      if (connectionMode === 'websocket' && socketRef.current) {
        socketRef.current.emit('unsubscribe', { channelId: activeChannel.id })
      }
    }
  }, [activeChannel, connectionMode])

  // Send message
  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || !activeChannel) return false

    const user = discordUserRef.current

    if (connectionMode === 'websocket' && socketRef.current) {
      // WebSocket mode
      socketRef.current.emit('sendMessage', {
        channelId: activeChannel.id,
        content,
        username: user?.discordUsername,
        avatarUrl: user?.discordAvatar
      })
      return true
    } else {
      // REST mode
      try {
        await api.post(`/api/discord/messages?channelId=${activeChannel.id}`, {
          content
        }, { withCredentials: true })
        await fetchMessagesREST(activeChannel.id)
        return true
      } catch (err) {
        setError('Failed to send message')
        return false
      }
    }
  }, [activeChannel, connectionMode, fetchMessagesREST])

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
      if (socketRef.current) {
        socketRef.current.disconnect()
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
