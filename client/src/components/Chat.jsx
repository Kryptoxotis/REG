import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import api from '../lib/api'

function Chat({ isAdmin = false }) {
  const [discordStatus, setDiscordStatus] = useState({ connected: false, loading: true })
  const [channels, setChannels] = useState({})
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageCache, setMessageCache] = useState({}) // Cache messages per channel
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const pollIntervalRef = useRef(null)

  // Check Discord connection status
  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await api.get('/api/discord/status', { withCredentials: true })
        setDiscordStatus({ ...response.data, loading: false })
        if (response.data.connected) {
          fetchChannels()
        }
      } catch (err) {
        setDiscordStatus({ connected: false, loading: false })
      }
    }
    checkStatus()
  }, [])

  // Fetch channels
  async function fetchChannels() {
    try {
      const response = await api.get('/api/discord/channels', { withCredentials: true })
      setChannels(response.data.channels)

      // Auto-select first channel (general if available)
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
  }

  // Fetch messages when channel changes
  useEffect(() => {
    if (activeChannel) {
      // Load from cache immediately if available
      if (messageCache[activeChannel.id]) {
        setMessages(messageCache[activeChannel.id])
      }

      fetchMessages()

      // Set up polling for new messages (15 seconds)
      pollIntervalRef.current = setInterval(fetchMessages, 15000)

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
      }
    }
  }, [activeChannel])

  // Fetch messages
  async function fetchMessages() {
    if (!activeChannel) return

    const channelId = activeChannel.id
    const cachedMessages = messageCache[channelId] || []

    try {
      setLoading(cachedMessages.length === 0 && messages.length === 0)
      const response = await api.get(`/api/discord/messages?channelId=${channelId}`, { withCredentials: true })
      const newMessages = response.data.messages

      // Only update if messages actually changed (compare last message ID)
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
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Connect Discord account
  async function handleConnectDiscord() {
    try {
      const response = await api.get('/api/discord/auth/url', { withCredentials: true })
      window.location.href = response.data.url
    } catch (err) {
      setError('Failed to start Discord connection')
    }
  }

  // Disconnect Discord
  async function handleDisconnect() {
    try {
      await api.post('/api/discord/disconnect', {}, { withCredentials: true })
      setDiscordStatus({ connected: false, loading: false })
      setChannels({})
      setActiveChannel(null)
      setMessages([])
    } catch (err) {
      setError('Failed to disconnect')
    }
  }

  // Send message
  async function handleSendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !activeChannel || sending) return

    try {
      setSending(true)
      await api.post(`/api/discord/messages?channelId=${activeChannel.id}`, {
        content: newMessage
      }, { withCredentials: true })

      setNewMessage('')
      // Immediately fetch new messages
      await fetchMessages()
    } catch (err) {
      setError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Format timestamp
  function formatTime(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Loading state
  if (discordStatus.loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 rounded-xl">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"
          />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Not connected state
  if (!discordStatus.connected) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Team Chat</h2>
            <p className="text-sm text-gray-400">Connect your Discord to chat with the team</p>
          </div>
        </div>

        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Connect Discord</h3>
            <p className="text-gray-400 mb-6">
              Link your Discord account to access team channels. You'll only see channels you have permission to view.
            </p>
            <button
              onClick={handleConnectDiscord}
              className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Connect Discord
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Connected state - full chat interface
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Team Chat</h2>
          <p className="text-sm text-gray-400">
            Connected as {discordStatus.discordUsername}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Disconnect
          </button>
          <a
            href="https://discord.gg/your-invite-link"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Open Discord
          </a>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:text-red-300">×</button>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 flex overflow-hidden min-h-[500px]">
        {/* Channel sidebar */}
        <div className="w-56 bg-gray-950 border-r border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400">Channels</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {Object.entries(channels).map(([category, categoryChannels]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {category}
                </div>
                {categoryChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                      activeChannel?.id === channel.id
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="text-gray-500">#</span>
                    {channel.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          {/* Channel header */}
          {activeChannel && (
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span className="text-gray-500">#</span>
                {activeChannel.name}
              </h3>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"
                />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No messages yet
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex gap-3 group">
                  <img
                    src={msg.author.avatar}
                    alt={msg.author.username}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-white">{msg.author.username}</span>
                      <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
                    </div>
                    <p className="text-gray-300 break-words whitespace-pre-wrap">{msg.content}</p>
                    {msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.attachments.map((att, i) => (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline text-sm block"
                          >
                            {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          {activeChannel && (
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message #${activeChannel.name}`}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {sending ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Chat
