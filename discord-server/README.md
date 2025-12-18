# REG Discord WebSocket Server

Real-time Discord integration for the REG Dashboard.

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Copy .env.example to .env and fill in your values
cp .env.example .env

# Build and run
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 2: Node.js directly

```bash
# Install dependencies
npm install

# Copy .env.example to .env and fill in your values
cp .env.example .env

# Run
npm start

# Or with auto-restart on changes (development)
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Your Discord bot token | Required |
| `DISCORD_GUILD_ID` | Your Discord server ID | `1445647668125892620` |
| `FRONTEND_URL` | Dashboard URL for CORS | `https://kryptoxotis-reg.vercel.app` |
| `PORT` | Server port | `3001` |

## API

### Health Check
```
GET /health
```

### Socket.io Events

**Client -> Server:**
- `auth` - Authenticate with Discord user ID: `{ discordId: "123..." }`
- `subscribe` - Subscribe to channel: `{ channelId: "123..." }`
- `unsubscribe` - Unsubscribe from channel: `{ channelId: "123..." }`
- `getChannels` - Get accessible channels
- `getMessages` - Get channel messages: `{ channelId: "123...", limit: 50 }`
- `sendMessage` - Send message: `{ channelId, content, username, avatarUrl }`

**Server -> Client:**
- `authenticated` - Auth success
- `channels` - Channel list: `{ channels: {...} }`
- `messages` - Message list: `{ channelId, messages: [...] }`
- `message` - New message: `{ channelId, message: {...} }`
- `messageSent` - Message sent confirmation
- `error` - Error: `{ message: "..." }`

## Moving to VPS

1. Clone or copy this folder to your VPS
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Copy your `.env` file
4. Run: `docker-compose up -d`
5. Update your dashboard's `REACT_APP_DISCORD_WS_URL` to point to your VPS
