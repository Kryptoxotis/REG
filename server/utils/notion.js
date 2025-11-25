import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

// Database IDs
export const DATABASE_IDS = {
  AVAILABILITY: '2b1746b9-e0e8-80b9-a2c8-c3bc260c87bc',
  DIRECTORY: '2b1746b9-e0e8-804e-8470-e355350e7d69',
  SCOREBOARD: '2b1746b9-e0e8-800a-8666-e4f67622b49f',
  MODEL_HOMES: '2b1746b9-e0e8-8008-a80c-c65a1a4b21f9',
  SELLER_INQUIRY: '2b1746b9-e0e8-802b-b0a5-e141f0a9d88b',
  MORTGAGE_CALC: '2b1746b9-e0e8-803a-96fc-f817797d0fe2',
  STATUS_REPORT: '2b1746b9-e0e8-80b3-be1b-dc643e4da6cf',
  MASTER_CALENDAR: '2b1746b9-e0e8-80b6-a586-dcb228bc5797'
}

// Query a database
export async function queryDatabase(databaseId, filter = {}, sorts = []) {
  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        filter: filter.value ? filter : undefined,
        sorts: sorts.length > 0 ? sorts : undefined
      },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data.results
  } catch (error) {
    console.error('Error querying database:', error.message)
    throw error
  }
}

// Get database info
export async function getDatabaseInfo(databaseId) {
  try {
    const response = await axios.get(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION
        }
      }
    )
    return response.data
  } catch (error) {
    console.error('Error retrieving database:', error.message)
    throw error
  }
}

// Extract plain text from Notion rich text
export function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
}

// Format database page to simple object
export function formatPage(page) {
  const properties = {}

  for (const [key, value] of Object.entries(page.properties)) {
    switch (value.type) {
      case 'title':
        properties[key] = extractPlainText(value.title)
        break
      case 'rich_text':
        properties[key] = extractPlainText(value.rich_text)
        break
      case 'number':
        properties[key] = value.number
        break
      case 'select':
        properties[key] = value.select?.name || null
        break
      case 'multi_select':
        properties[key] = value.multi_select.map(item => item.name)
        break
      case 'date':
        properties[key] = value.date
        break
      case 'checkbox':
        properties[key] = value.checkbox
        break
      case 'email':
        properties[key] = value.email
        break
      case 'phone_number':
        properties[key] = value.phone_number
        break
      case 'url':
        properties[key] = value.url
        break
      case 'status':
        properties[key] = value.status?.name || null
        break
      default:
        properties[key] = value
    }
  }

  return {
    id: page.id,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    ...properties
  }
}

// Update a page in Notion
export async function updatePage(pageId, properties) {
  try {
    const response = await axios.patch(
      `https://api.notion.com/v1/pages/${pageId}`,
      { properties },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data
  } catch (error) {
    console.error('Error updating page:', error.message)
    throw error
  }
}

// Create a new page in Notion database
export async function createPage(databaseId, properties) {
  try {
    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: databaseId },
        properties
      },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data
  } catch (error) {
    console.error('Error creating page:', error.message)
    throw error
  }
}

// Archive (delete) a page in Notion
export async function deletePage(pageId) {
  try {
    const response = await axios.patch(
      `https://api.notion.com/v1/pages/${pageId}`,
      { archived: true },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data
  } catch (error) {
    console.error('Error deleting page:', error.message)
    throw error
  }
}
