import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  CLOSED_DEALS: '2c8746b9-e0e8-8050-9cb1-d9445440a513'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { address, edwardsCo, closeDate, finalSalePrice, agent, buyerName, commission } = req.body

  if (!id) {
    return res.status(400).json({ error: 'Deal ID is required' })
  }

  try {
    // Create entry in CLOSED_DEALS database
    const properties = {
      Address: {
        title: [{ type: 'text', text: { content: address || 'Unknown' } }]
      }
    }

    if (closeDate) {
      properties['Close Date'] = { date: { start: closeDate } }
    }

    if (finalSalePrice) {
      properties['Final Sale Price'] = { number: parseFloat(finalSalePrice) || 0 }
    }

    if (agent) {
      properties['Agent'] = {
        rich_text: [{ type: 'text', text: { content: agent } }]
      }
    }

    if (buyerName) {
      properties['Buyer Name'] = {
        rich_text: [{ type: 'text', text: { content: buyerName } }]
      }
    }

    if (commission) {
      properties['Commission'] = { number: parseFloat(commission) || 0 }
    }

    // Create page in CLOSED_DEALS database
    const createResponse = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: DATABASE_IDS.CLOSED_DEALS },
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

    // Archive the original deal from PIPELINE
    await axios.patch(
      `https://api.notion.com/v1/pages/${id}`,
      { archived: true },
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
      closedDealId: createResponse.data.id,
      message: 'Deal moved to Closed Deals successfully'
    })
  } catch (error) {
    console.error('Move to closed error:', error.response?.data || error.message)
    res.status(500).json({
      error: 'Failed to move deal to closed',
      details: error.response?.data?.message || error.message
    })
  }
}
