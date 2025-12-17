// Centralized database configuration
// All Notion database IDs in one place
// Uses environment variables with fallback to defaults for development

export const DATABASE_IDS = {
  TEAM_MEMBERS: process.env.NOTION_DB_TEAM_MEMBERS || '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5',
  PROPERTIES: process.env.NOTION_DB_PROPERTIES || '2bb746b9-e0e8-8163-9afe-cf0c567c2586',
  PIPELINE: process.env.NOTION_DB_PIPELINE || '2bb746b9-e0e8-81f3-90c9-d2d317085a50',
  CLIENTS: process.env.NOTION_DB_CLIENTS || '2bb746b9-e0e8-8176-b5ed-dfe744fc0246',
  SCHEDULE: process.env.NOTION_DB_SCHEDULE || '2bb746b9-e0e8-81a9-80db-000b8268b9d6',
  ACTIVITY_LOG: process.env.NOTION_DB_ACTIVITY_LOG || '2c8746b9-e0e8-804a-8214-da6c76e7af4e',
  CLOSED_DEALS: process.env.NOTION_DB_CLOSED_DEALS || '2c8746b9-e0e8-8050-9cb1-d9445440a513'
}

export const NOTION_VERSION = '2022-06-28'

// Get database ID by key (case-insensitive)
export function getDatabaseId(key) {
  if (!key) return null
  const upperKey = key.toUpperCase().replace(/-/g, '_')
  return DATABASE_IDS[upperKey] || null
}

// Token configuration - required env var
export const TOKEN_SECRET = process.env.TOKEN_SECRET
if (!TOKEN_SECRET) {
  throw new Error('TOKEN_SECRET environment variable is required')
}

// Notion API key - required env var
export const NOTION_API_KEY = process.env.NOTION_API_KEY
if (!NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY environment variable is required')
}

// Cities configuration (shared across components)
export const CITIES = ['Temple', 'Killeen', 'Belton', 'Harker Heights', 'Troy', 'Rockdale', 'Copperas Cove', 'Cameron', 'Lampasas', 'Salado']

// City to Edwards office mapping
export const CITY_TO_EDWARDS = {
  'Temple': 'Temple',
  'Belton': 'Temple',
  'Troy': 'Temple',
  'Killeen': 'Killeen',
  'Harker Heights': 'Killeen',
  'Copperas Cove': 'Killeen'
}

export default DATABASE_IDS
