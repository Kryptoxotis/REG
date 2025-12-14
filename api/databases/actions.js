import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50',
  CLOSED_DEALS: '2c8746b9-e0e8-8050-9cb1-d9445440a513',
  ACTIVITY_LOG: '2c8746b9-e0e8-804a-8214-da6c76e7af4e'
}

// Move property from Presale to Pipeline
async function moveToPipeline(data) {
  const { propertyId, address, closedDate, executeDate, salesPrice, agent, buyerName } = data

  if (!propertyId) throw new Error('Property ID is required')
  if (!closedDate) throw new Error('Closed date is required')

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

  if (executeDate) properties['Execution Date'] = { date: { start: executeDate } }
  if (salesPrice) properties['Sales Price'] = { number: parseFloat(salesPrice) || 0 }
  if (agent) properties['Agent'] = { rich_text: [{ type: 'text', text: { content: agent } }] }
  if (buyerName) properties['Buyer Name'] = { rich_text: [{ type: 'text', text: { content: buyerName } }] }

  const response = await axios.post(
    'https://api.notion.com/v1/pages',
    { parent: { database_id: DATABASE_IDS.PIPELINE }, properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )

  return { success: true, pipelineId: response.data.id, message: 'Property moved to pipeline successfully' }
}

// Update loan status in Pipeline
async function updateStatus(data) {
  const { dealId, loanStatus } = data

  if (!dealId) throw new Error('Deal ID is required')
  if (!loanStatus) throw new Error('Loan status is required')

  const response = await axios.patch(
    `https://api.notion.com/v1/pages/${dealId}`,
    {
      properties: {
        'Loan Status': { select: { name: loanStatus } }
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )

  return { success: true, id: response.data.id }
}

// Move deal from Pipeline to Closed Deals
async function moveToClosed(data) {
  const { dealId, address, closeDate, finalSalePrice, agent, buyerName, commission } = data

  if (!dealId) throw new Error('Deal ID is required')

  const properties = {
    Address: {
      title: [{ type: 'text', text: { content: address || 'Unknown' } }]
    }
  }

  if (closeDate) properties['Close Date'] = { date: { start: closeDate } }
  if (finalSalePrice) properties['Final Sale Price'] = { number: parseFloat(finalSalePrice) || 0 }
  if (agent) properties['Agent'] = { rich_text: [{ type: 'text', text: { content: agent } }] }
  if (buyerName) properties['Buyer Name'] = { rich_text: [{ type: 'text', text: { content: buyerName } }] }
  if (commission) properties['Commission'] = { number: parseFloat(commission) || 0 }

  // Create in CLOSED_DEALS
  const createResponse = await axios.post(
    'https://api.notion.com/v1/pages',
    { parent: { database_id: DATABASE_IDS.CLOSED_DEALS }, properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )

  // Archive original from Pipeline
  await axios.patch(
    `https://api.notion.com/v1/pages/${dealId}`,
    { archived: true },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )

  return { success: true, closedDealId: createResponse.data.id, message: 'Deal moved to Closed Deals successfully' }
}

// Log activity
async function logActivity(data) {
  const { logAction, dealAddress, oldStatus, newStatus, notes } = data

  if (!logAction) throw new Error('Log action is required')

  const properties = {
    Action: {
      title: [{ type: 'text', text: { content: logAction } }]
    },
    Timestamp: {
      date: { start: new Date().toISOString() }
    }
  }

  if (dealAddress) properties['Deal Address'] = { rich_text: [{ type: 'text', text: { content: dealAddress } }] }
  if (oldStatus) properties['Old Status'] = { rich_text: [{ type: 'text', text: { content: oldStatus } }] }
  if (newStatus) properties['New Status'] = { rich_text: [{ type: 'text', text: { content: newStatus } }] }
  if (notes) properties['Notes'] = { rich_text: [{ type: 'text', text: { content: notes } }] }

  const response = await axios.post(
    'https://api.notion.com/v1/pages',
    { parent: { database_id: DATABASE_IDS.ACTIVITY_LOG }, properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )

  return { success: true, logId: response.data.id }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, ...data } = req.body

  if (!action) {
    return res.status(400).json({ error: 'Action is required' })
  }

  try {
    let result

    switch (action) {
      case 'move-to-pipeline':
        result = await moveToPipeline(data)
        break
      case 'update-status':
        result = await updateStatus(data)
        break
      case 'move-to-closed':
        result = await moveToClosed(data)
        break
      case 'log-activity':
        result = await logActivity(data)
        break
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    res.status(200).json(result)
  } catch (error) {
    console.error(`Action ${action} error:`, error.response?.data || error.message)
    res.status(500).json({
      error: `Failed to execute ${action}`,
      details: error.response?.data?.message || error.message
    })
  }
}
