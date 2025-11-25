# REG Dashboard

A web dashboard integrating with Notion databases, featuring role-based authentication (Admin vs Employee).

## Features

- **Authentication**: Login system using Notion database
- **Role-Based Access**: Admin and Employee dashboards with different permissions
- **Database Integration**: View and manage 8 Notion databases
- **Responsive Design**: Works on desktop, tablet, and mobile

## Prerequisites

- Node.js v22+ installed
- Notion account with API access
- Notion API key

## Quick Start

### 1. Create Users Database in Notion

Before running the app, you need to create a "Users" database in Notion:

1. Go to Notion and create a new database
2. Add the following properties:
   - **Full Name** (Title type)
   - **Email** (Email type)
   - **Password** (Text type) - Store plain text passwords for testing
   - **Role** (Select type) - Add options: "admin" and "employee"

3. Add at least one user:
   - Full Name: Admin User
   - Email: admin@example.com
   - Password: admin123
   - Role: admin

4. Copy the database ID from the URL:
   - The URL looks like: `https://www.notion.so/xxxxxx?v=yyyy`
   - The `xxxxxx` part is your database ID

5. Update `server/routes/auth.js`:
   - Replace `REPLACE_WITH_YOUR_USERS_DATABASE_ID` with your actual database ID

### 2. Grant Notion Permissions

1. Go to Notion → Settings → Integrations
2. Find your integration (or create one at https://www.notion.so/my-integrations)
3. Connect the integration to:
   - Your Users database
   - All 8 existing databases you want to display

### 3. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 4. Configure Environment

The `.env` file is already created with your Notion API key. If needed, update:

```
NOTION_API_KEY=your_notion_api_key
SESSION_SECRET=your_secret_key
PORT=3000
```

### 5. Run the Application

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

### 6. Access the Dashboard

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Default Login Credentials

After creating your Users database, use:
- **Email**: admin@example.com (or whatever you added)
- **Password**: admin123 (or whatever you added)

## Project Structure

```
REG/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── utils/          # Utility functions
│   │   └── App.jsx         # Main app component
│   └── index.html
├── server/                 # Express backend
│   ├── routes/             # API routes
│   ├── utils/              # Server utilities
│   └── index.js            # Server entry point
├── tasks/                  # Project documentation
├── .env                    # Environment variables
└── package.json
```

## Integrated Databases

1. **Availability Schedule** - Team member availability
2. **Directory** - Forms and sheets
3. **Team Scoreboard** - Sales performance
4. **Model Homes** - Model home availability
5. **Seller Inquiries** - Seller inquiry responses
6. **Mortgage Calculator** - Mortgage calculations
7. **Status Report** - Construction tracking
8. **Master Calendar** - Master calendar/scheduling

## User Roles

### Admin
- Full access to all databases
- View detailed records from all databases
- See overview statistics
- Navigate between all database views

### Employee
- Limited dashboard view
- See overview statistics
- Quick links to common tasks
- Cannot access detailed database records

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, React Router
- **Backend**: Node.js, Express
- **Database**: Notion API
- **Authentication**: Express Sessions

## Development

### Adding New Databases

1. Add the database ID to `server/utils/notion.js` in `DATABASE_IDS`
2. Update the databases array in `client/src/pages/AdminDashboard.jsx`
3. Grant Notion integration access to the new database

### Security Notes

- Passwords are stored in plain text in Notion (for development)
- In production, implement proper password hashing (bcrypt)
- Use HTTPS in production
- Update `SESSION_SECRET` to a secure random string
- Enable secure cookies in production

## Troubleshooting

### "Failed to fetch stats"
- Check that Notion integration has access to all databases
- Verify database IDs in `server/utils/notion.js`
- Check Notion API key in `.env`

### "Invalid credentials"
- Verify Users database exists in Notion
- Check database ID in `server/routes/auth.js`
- Ensure user exists with correct email/password

### "Not authenticated"
- Clear browser cookies
- Check session configuration in `server/index.js`

## Next Steps

- Set up GitHub MCP server for version control
- Deploy to production
- Add more features (data editing, filtering, search)
- Implement password hashing
- Add email notifications
