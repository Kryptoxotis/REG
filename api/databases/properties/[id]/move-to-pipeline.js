import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { address, closedDate, executeDate, edwardsCo, salesPrice, agent, buyerName } = req.body

  if (!id) {
    return res.status(400).json({ error: 'Property ID is required' })
  }

  if (!closedDate) {
    return res.status(400).json({ error: 'Closed date is required' })
  }

  try {
    // Create new entry in PIPELINE database
    const properties = {
      Address: {
        title: [{ type: 'text', text: { content: address || 'Unknown' } }]
      },
      'Loan Status': {
        select: { name: 'Loan Application Received' }
      },
      'Scheduled Closing': {
        date: { start: closedDate }
      }
    }

    // Add optional fields if provided
    if (executeDate) {
      properties['Execution Date'] = { date: { start: executeDate } }
    }

    if (salesPrice) {
      properties['Sales Price'] = { number: parseFloat(salesPrice) || 0 }
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

    // Create page in PIPELINE database
    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: DATABASE_IDS.PIPELINE },
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

    // Optionally update the original property status to indicate it's been moved
    // (uncomment if you want to mark original as sold/moved)
    // await axios.patch(
    //   `https://api.notion.com/v1/pages/${id}`,
    //   { properties: { Status: { select: { name: 'Sold' } } } },
    //   { headers: { 'Authorization': `Bearer ${NOTION_API_KEY}`, 'Notion-Version': NOTION_VERSION } }
    // )

    res.status(200).json({
      success: true,
      pipelineId: response.data.id,
      message: 'Property moved to pipeline successfully'
    })
  } catch (error) {
    console.error('Move to pipeline error:', error.response?.data || error.message)
    res.status(500).json({
      error: 'Failed to move property to pipeline',
      details: error.response?.data?.message || error.message
    })
  }
}
