// Centralized database configuration
// All Notion database IDs in one place

export const DATABASE_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5',
  PROPERTIES: '2bb746b9-e0e8-8163-9afe-cf0c567c2586',
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50',
  CLIENTS: '2bb746b9-e0e8-8176-b5ed-dfe744fc0246',
  SCHEDULE: '2bb746b9-e0e8-810a-b85d-e1a517ca1349',
  ACTIVITY_LOG: '2c8746b9-e0e8-804a-8214-da6c76e7af4e',
  CLOSED_DEALS: '2c8746b9-e0e8-8050-9cb1-d9445440a513'
}

export const NOTION_VERSION = '2022-06-28'

// Get database ID by key (case-insensitive)
export function getDatabaseId(key) {
  if (!key) return null
  const upperKey = key.toUpperCase().replace(/-/g, '_')
  return DATABASE_IDS[upperKey] || null
}

// Token configuration
export const TOKEN_SECRET = process.env.TOKEN_SECRET || 'reg-dashboard-secret-key-change-in-production'

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
