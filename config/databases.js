// Centralized database configuration
// All Notion database IDs in one place
// All database IDs MUST be set via environment variables

// Helper to get required env var or throw
function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}

export const DATABASE_IDS = {
  TEAM_MEMBERS: requireEnv('NOTION_DB_TEAM_MEMBERS'),
  PROPERTIES: requireEnv('NOTION_DB_PROPERTIES'),
  PIPELINE: requireEnv('NOTION_DB_PIPELINE'),
  CLIENTS: requireEnv('NOTION_DB_CLIENTS'),
  SCHEDULE: requireEnv('NOTION_DB_SCHEDULE'),
  ACTIVITY_LOG: requireEnv('NOTION_DB_ACTIVITY_LOG'),
  CLOSED_DEALS: requireEnv('NOTION_DB_CLOSED_DEALS')
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
