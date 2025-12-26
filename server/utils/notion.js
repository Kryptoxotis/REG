import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

// Database IDs - New consolidated 5-database structure
export const DATABASE_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5',
  PROPERTIES: '2bb746b9-e0e8-8163-9afe-cf0c567c2586',
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50',
  CLIENTS: '2bb746b9-e0e8-8176-b5ed-dfe744fc0246',
  SCHEDULE: '2bb746b9-e0e8-810a-b85d-e1a517ca1349',
  CLOSED_DEALS: '2c8746b9-e0e8-8050-9cb1-d9445440a513',
  ACTIVITY_LOG: '2c8746b9-e0e8-804a-8214-da6c76e7af4e',
  // Virtual views (same DB with filters)
  MODEL_HOMES: '2bb746b9-e0e8-8163-9afe-cf0c567c2586',
  SCOREBOARD: '2bb746b9-e0e8-81f3-90c9-d2d317085a50'
}

// Query a database with pagination support
// maxPages limits pagination to prevent timeouts (default 10 = 1000 items max)
export async function queryDatabase(databaseId, filter = {}, sorts = [], maxPages = 10) {
  try {
    let allResults = []
    let hasMore = true
    let startCursor = undefined
    let pageNum = 0

    while (hasMore && pageNum < maxPages) {
      pageNum++
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          sorts: sorts.length > 0 ? sorts : undefined,
          start_cursor: startCursor,
          page_size: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        }
      )

      const pageResults = response.data.results.length
      allResults = allResults.concat(response.data.results)
      hasMore = response.data.has_more
      startCursor = response.data.next_cursor

      console.log(`DB ${databaseId.slice(0,8)}... page ${pageNum}/${maxPages}: ${pageResults} items, total: ${allResults.length}, hasMore: ${hasMore}`)
    }

    if (hasMore) {
      console.warn(`DB ${databaseId.slice(0,8)}... stopped at ${maxPages} pages (${allResults.length} items) - more data exists`)
    }

    return allResults
  } catch (error) {
    console.error(`Error querying database ${databaseId}:`, error.message)
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
