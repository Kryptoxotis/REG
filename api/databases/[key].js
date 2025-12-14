import axios from 'axios'
import { DATABASE_IDS as BASE_DB_IDS, NOTION_VERSION } from '../../config/databases.js'
import { handleCors, verifyToken } from '../../config/utils.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY

// Extend base IDs with virtual views (same DB with filters)
const DATABASE_IDS = {
  ...BASE_DB_IDS,
  MODEL_HOMES: BASE_DB_IDS.PROPERTIES,
  SCOREBOARD: BASE_DB_IDS.PIPELINE
}

// Filters for virtual views
const VIEW_FILTERS = {
  MODEL_HOMES: {
    property: 'Status',
    select: { equals: 'Model Home' }
  }
}

function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
}

function formatPage(page) {
  const properties = {}
  for (const [key, value] of Object.entries(page.properties)) {
    switch (value.type) {
      case 'title': properties[key] = extractPlainText(value.title); break
      case 'rich_text': properties[key] = extractPlainText(value.rich_text); break
      case 'number': properties[key] = value.number; break
      case 'select': properties[key] = value.select?.name || null; break
      case 'multi_select': properties[key] = value.multi_select.map(item => item.name); break
      case 'date': properties[key] = value.date; break
      case 'checkbox': properties[key] = value.checkbox; break
      case 'email': properties[key] = value.email; break
      case 'phone_number': properties[key] = value.phone_number; break
      case 'url': properties[key] = value.url; break
      case 'status': properties[key] = value.status?.name || null; break
      case 'relation':
        properties[key] = value.relation?.map(rel => rel.id) || []
        break
      case 'formula':
        if (value.formula.type === 'number') properties[key] = value.formula.number
        else if (value.formula.type === 'string') properties[key] = value.formula.string
        else if (value.formula.type === 'boolean') properties[key] = value.formula.boolean
        else if (value.formula.type === 'date') properties[key] = value.formula.date
        else properties[key] = null
        break
      case 'rollup':
        if (value.rollup.type === 'number') properties[key] = value.rollup.number
        else if (value.rollup.type === 'array') properties[key] = value.rollup.array
        else properties[key] = null
        break
      default: properties[key] = value
    }
  }
  return { id: page.id, created_time: page.created_time, last_edited_time: page.last_edited_time, ...properties }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  // Auth check - all database reads require authentication
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const user = verifyToken(token)

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { key } = req.query
  const upperKey = key.toUpperCase()
  const databaseId = DATABASE_IDS[upperKey]

  if (!databaseId) {
    return res.status(404).json({ error: 'Database not found' })
  }

  // Build query body with optional filters for virtual views
  const queryBody = {}
  if (VIEW_FILTERS[upperKey]) {
    queryBody.filter = VIEW_FILTERS[upperKey]
  }

  try {
    // Paginate through ALL results
    let allResults = []
    let hasMore = true
    let startCursor = undefined

    while (hasMore) {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        { ...queryBody, start_cursor: startCursor, page_size: 100 },
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        }
      )
      allResults = allResults.concat(response.data.results)
      hasMore = response.data.has_more
      startCursor = response.data.next_cursor
    }

    const formatted = allResults.map(formatPage)
    res.status(200).json(formatted)
  } catch (error) {
    console.error('Error:', error.message, error.response?.data)
    res.status(500).json({ error: 'Failed to fetch data', details: error.message, hasApiKey: !!NOTION_API_KEY })
  }
}
