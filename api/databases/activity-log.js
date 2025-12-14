import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  ACTIVITY_LOG: '2c8746b9-e0e8-804a-8214-da6c76e7af4e'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, dealAddress, oldStatus, newStatus, notes } = req.body

  if (!action) {
    return res.status(400).json({ error: 'Action is required' })
  }

  try {
    const properties = {
      Action: {
        title: [{ type: 'text', text: { content: action } }]
      }
    }

    if (dealAddress) {
      properties['Deal Address'] = {
        rich_text: [{ type: 'text', text: { content: dealAddress } }]
      }
    }

    if (oldStatus) {
      properties['Old Status'] = {
        rich_text: [{ type: 'text', text: { content: oldStatus } }]
      }
    }

    if (newStatus) {
      properties['New Status'] = {
        rich_text: [{ type: 'text', text: { content: newStatus } }]
      }
    }

    if (notes) {
      properties['Notes'] = {
        rich_text: [{ type: 'text', text: { content: notes } }]
      }
    }

    // Add timestamp
    properties['Timestamp'] = {
      date: { start: new Date().toISOString() }
    }

    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: DATABASE_IDS.ACTIVITY_LOG },
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

    res.status(200).json({
      success: true,
      logId: response.data.id
    })
  } catch (error) {
    console.error('Activity log error:', error.response?.data || error.message)
    // Don't fail the request if logging fails - just return success
    res.status(200).json({
      success: true,
      warning: 'Activity logged with errors',
      details: error.response?.data?.message || error.message
    })
  }
}
