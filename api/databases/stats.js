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

export default async function handler(req, res) {
  try {
    const stats = {}

    for (const [key, id] of Object.entries(DATABASE_IDS)) {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${id}/query`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        }
      )
      stats[key] = {
        count: response.data.results.length,
        name: key.replace(/_/g, ' ').toLowerCase()
      }
    }

    res.status(200).json(stats)
  } catch (error) {
    console.error('Error:', error.message)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
}
