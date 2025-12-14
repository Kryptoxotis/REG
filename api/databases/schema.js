import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5',
  PROPERTIES: '2bb746b9-e0e8-8163-9afe-cf0c567c2586',
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50',
  CLIENTS: '2bb746b9-e0e8-8176-b5ed-dfe744fc0246',
  SCHEDULE: '2bb746b9-e0e8-810a-b85d-e1a517ca1349',
  ACTIVITY_LOG: '2c8746b9-e0e8-804a-8214-da6c76e7af4e',
  CLOSED_DEALS: '2c8746b9-e0e8-8050-9cb1-d9445440a513'
}

export default async function handler(req, res) {
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
