import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-811a-abaf-000bf8cf1640',
  PROPERTIES: '2bb746b9-e0e8-812c-8811-000b420455d9',
  PIPELINE: '2bb746b9-e0e8-815d-94e0-000bfd1091e1',
  CLIENTS: '2bb746b9-e0e8-8152-b94a-000ba17c67bf',
  SCHEDULE: '2bb746b9-e0e8-81a9-80db-000b8268b9d6'
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
