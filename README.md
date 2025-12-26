# REG Dashboard

A real estate CRM dashboard integrating with Notion databases, featuring role-based authentication, pipeline management, and team KPI tracking.

## Features

- **Authentication**: Secure login with bcrypt password hashing and session management
- **Role-Based Access**: Admin and Employee dashboards with different permissions
- **Pipeline Management**: Track deals through submission, pending, and closed stages
- **Team KPIs**: View team member performance metrics
- **Database Integration**: View and manage multiple Notion databases
- **Responsive Design**: Works on desktop, tablet, and mobile (PWA-ready)

## Prerequisites

- Node.js v22+ installed
- Notion account with API access
- Notion API key
- (Optional) Upstash Redis for production session storage

## Quick Start

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
# Required
NOTION_API_KEY=your_notion_api_key
SESSION_SECRET=your_secure_random_string_min_32_chars

# Optional - Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Optional - Redis for production sessions
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Optional - Production mode
NODE_ENV=development
PORT=3000
```

### 3. Run the Application

```bash
# Start both server and client
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Server
npm run server

# Terminal 2 - Client
cd client && npm run dev
```

### 4. Access the Dashboard

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Project Structure

```
REG/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   │   ├── pipeline/   # Pipeline-specific components
│   │   │   ├── Toast.jsx   # Toast notification system
│   │   │   └── ...
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities and API client
│   │   └── App.jsx         # Main app component
│   ├── vitest.config.js    # Vitest test configuration
│   └── package.json
├── server/                 # Express backend
│   ├── routes/
│   │   ├── auth.js         # Authentication routes
│   │   ├── databases.js    # Database CRUD routes
│   │   └── discord.js      # Discord integration
│   ├── middleware/         # Express middleware
│   ├── utils/
│   │   ├── notion.js       # Notion API client
│   │   ├── logger.js       # Winston logger
│   │   └── sessionStore.js # Redis session store
│   ├── __tests__/          # Jest tests
│   └── index.js            # Server entry point
├── jest.config.js          # Jest test configuration
├── .env                    # Environment variables
└── package.json
```

## Testing

### Server Tests (Jest)

```bash
# Run all server tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Client Tests (Vitest)

```bash
cd client

# Run all client tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/check-email` | Check user status by email |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/create-password` | Create password for pending users |
| GET | `/api/auth/check` | Check authentication status |
| GET | `/api/auth/verify-permissions` | Verify user permissions |
| POST | `/api/auth/logout` | Logout current session |

### Databases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/databases/:key` | Get database records (paginated) |
| GET | `/api/databases/stats` | Get dashboard statistics |
| GET | `/api/databases/team-kpis` | Get team KPI data |
| PUT | `/api/databases/:key/:pageId` | Update a record |
| DELETE | `/api/databases/:key/:pageId` | Delete (archive) a record |
| POST | `/api/databases/actions` | Perform database actions |

### Pagination

Database endpoints support pagination via query parameters:

```
GET /api/databases/PIPELINE?limit=50&offset=0
```

Response format:
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

## Security Features

- **Password Policy**: Minimum 8 characters with uppercase, lowercase, number, and special character
- **Session Fixation Protection**: Sessions are regenerated on login
- **CSRF Protection**: SameSite cookies + Origin validation
- **Rate Limiting**: 10 auth attempts per 15 minutes, 100 API requests per minute
- **Input Validation**: UUID validation for page IDs, field whitelisting for updates
- **Secure Sessions**: HttpOnly cookies, optional Redis session store for production

## Production Deployment

### Environment Variables

```env
NODE_ENV=production
SESSION_SECRET=<secure-random-string-64-chars>
FRONTEND_URL=https://your-domain.com
UPSTASH_REDIS_REST_URL=<your-upstash-url>
UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
```

### Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a secure `SESSION_SECRET` (64+ random characters)
- [ ] Configure Redis for session storage
- [ ] Set up HTTPS
- [ ] Configure proper CORS origins in `FRONTEND_URL`
- [ ] Set up proper logging/monitoring

## User Roles

### Admin
- Full access to all databases
- View and edit detailed records
- Access to admin dashboard with all views
- Manage team members and pipeline

### Employee
- Limited dashboard view
- View personal statistics and KPIs
- Access to assigned deals only
- Cannot access admin-only features

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, React Query, Framer Motion
- **Backend**: Node.js, Express 5
- **Database**: Notion API
- **Authentication**: Express Sessions, bcrypt
- **Session Store**: Upstash Redis (production) / Memory (development)
- **Testing**: Jest (server), Vitest (client)

## Troubleshooting

### "Failed to fetch stats"
- Check that Notion integration has access to all databases
- Verify database IDs in `server/utils/notion.js`
- Check Notion API key in `.env`

### "Invalid password" or login issues
- Passwords must meet the new policy (8+ chars, uppercase, lowercase, number, special char)
- For legacy plaintext passwords, users need to reset via admin

### Session issues in production
- Ensure Redis is configured with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check that `SESSION_SECRET` is set and consistent across restarts

### Rate limiting errors
- Auth endpoints: 10 attempts per 15 minutes
- API endpoints: 100 requests per minute
- Wait for the window to reset or adjust limits in `server/index.js`
