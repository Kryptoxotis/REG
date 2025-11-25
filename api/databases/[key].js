import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  AVAILABILITY: '2b1746b9-e0e8-80b9-a2c8-c3bc260c87bc',
  DIRECTORY: '2b1746b9-e0e8-804e-8470-e355350e7d69',
  SCOREBOARD: '2b1746b9-e0e8-800a-8666-e4f67622b49f',
  MODEL_HOMES: '2b1746b9-e0e8-8008-a80c-c65a1a4b21f9',
  SELLER_INQUIRY: '2b1746b9-e0e8-802b-b0a5-e141f0a9d88b',
  MORTGAGE_CALC: '2b1746b9-e0e8-803a-96fc-f817797d0fe2',
  STATUS_REPORT: '2b1746b9-e0e8-80b3-be1b-dc643e4da6cf',
  MASTER_CALENDAR: '2b1746b9-e0e8-80b6-a586-dcb228bc5797'
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
      default: properties[key] = value
    }
  }
  return { id: page.id, created_time: page.created_time, last_edited_time: page.last_edited_time, ...properties }
}

export default async function handler(req, res) {
  const { key } = req.query
  const databaseId = DATABASE_IDS[key.toUpperCase()]

  if (!databaseId) {
    return res.status(404).json({ error: 'Database not found' })
  }

  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {},
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
