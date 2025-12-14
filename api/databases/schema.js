import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../config/databases.js'
import { handleCors } from '../config/utils.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  const { key } = req.query
  const upperKey = key?.toUpperCase()
  const databaseId = DATABASE_IDS[upperKey]

  if (!databaseId) {
    return res.status(404).json({ error: 'Database not found' })
  }

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

    // Extract field names and types from properties
    const fields = Object.entries(response.data.properties).map(([name, prop]) => ({
      name,
      type: prop.type,
      id: prop.id
    }))

    res.status(200).json({
      databaseKey: upperKey,
      title: response.data.title?.[0]?.plain_text || upperKey,
      fields
    })
  } catch (error) {
    console.error('Error fetching schema:', error.message, error.response?.data)
    res.status(500).json({ error: 'Failed to fetch schema', details: error.message })
  }
}
