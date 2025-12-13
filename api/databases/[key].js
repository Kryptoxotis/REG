import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

// New consolidated database structure (5 main + 2 virtual views)
const DATABASE_IDS = {
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
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      queryBody,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      }
    )
    const formatted = response.data.results.map(formatPage)
    res.status(200).json(formatted)
  } catch (error) {
    console.error('Error:', error.message, error.response?.data)
    res.status(500).json({ error: 'Failed to fetch data', details: error.message, hasApiKey: !!NOTION_API_KEY })
  }
}
