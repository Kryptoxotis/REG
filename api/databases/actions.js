import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../../config/databases.js'
import { handleCors, verifyRequestToken, verifyTokenVersion, isValidEmail, isValidPhone, isValidUUID } from '../../config/utils.js'

// Actions that require admin role
const ADMIN_ONLY_ACTIONS = ['move-to-submitted', 'move-to-pending', 'move-to-pipeline', 'move-to-closed', 'send-back-to-properties']

const NOTION_API_KEY = process.env.NOTION_API_KEY

// Move property to Submitted stage (creates Pipeline record linked to Property)
async function moveToSubmitted(data) {
  console.log('moveToSubmitted called with:', JSON.stringify(data))
  const {
    propertyId, address, salesPrice,
    // Required fields for Submitted
    foreman, subdivision, agentAssist, buyerName
  } = data

  if (!propertyId) throw new Error('Property ID is required')
  if (!isValidUUID(propertyId)) throw new Error('Invalid property ID format')
  if (!buyerName) throw new Error('Buyer name is required')

  const properties = {
    Address: {
      title: [{ type: 'text', text: { content: address || 'Unknown' } }]
    },
    'Loan Status': {
      select: { name: 'Submitted' }
    },
    'Linked Property': {
      relation: [{ id: propertyId }]
    },
    'Buyer Name': { rich_text: [{ type: 'text', text: { content: buyerName } }] },
    'Submitted Date': { date: { start: new Date().toISOString().split('T')[0] } }
  }

  // Optional fields
  if (foreman) properties['Notes'] = { rich_text: [{ type: 'text', text: { content: `Foreman: ${foreman}` } }] }
  if (subdivision) properties['Notes'] = {
    rich_text: [{ type: 'text', text: { content: `${foreman ? `Foreman: ${foreman}\n` : ''}Subdivision: ${subdivision}` } }]
  }
  if (agentAssist) properties['Assisting Agent'] = { rich_text: [{ type: 'text', text: { content: agentAssist } }] }
  if (salesPrice) properties['Sales Price'] = { number: parseFloat(salesPrice) || 0 }

  // Create new record in Pipeline with Submitted status
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

  // Do NOT archive the Property - it stays in Properties database
  // The address can still be edited while in Submitted status

  return { success: true, pipelineId: response.data.id, message: 'Property moved to Submitted successfully' }
}

// Move from Submitted to Pending (full form, copies address, archives Property)
async function moveToPending(data) {
  console.log('moveToPending called with:', JSON.stringify(data))
  const {
    dealId, propertyId,
    // Form fields from Submitted → Pending
    submittedBy, agentRole, streetAddress, city, state, zipCode,
    lot, block, subdivision, floorPlan,
    // Buyer info
    agent, buyerName, buyerEmail, buyerPhone,
    // Optional fields
    assistingAgent, brokerName,
    loName, loEmail, loPhone,
    loanAmount, loanType,
    realtorPartner, realtorEmail, realtorPhone,
    notes, closedDate, executeDate, salesPrice
  } = data

  if (!dealId) throw new Error('Deal ID is required')
  if (!isValidUUID(dealId)) throw new Error('Invalid deal ID format')
  if (!streetAddress) throw new Error('Street address is required')
  if (!buyerName) throw new Error('Buyer name is required')
  if (!buyerEmail) throw new Error('Buyer email is required')
  if (!isValidEmail(buyerEmail)) throw new Error('Invalid buyer email format')
  if (!buyerPhone) throw new Error('Buyer phone is required')
  if (!isValidPhone(buyerPhone)) throw new Error('Invalid buyer phone format')

  // Build full address
  const fullAddress = `${streetAddress}${city ? ', ' + city : ''}${state ? ', ' + state : ''}${zipCode ? ' ' + zipCode : ''}`

  const properties = {
    Address: {
      title: [{ type: 'text', text: { content: fullAddress } }]
    },
    'Loan Status': {
      select: { name: 'Loan Application Received' }
    },
    'Address Locked': { checkbox: true },
    'Linked Property': { relation: [] }, // Clear the relation
    'Buyer Name': { rich_text: [{ type: 'text', text: { content: buyerName } }] },
    'Buyer Email': { email: buyerEmail },
    'Buyer Phone': { phone_number: buyerPhone }
  }

  // Build notes with form data
  let notesContent = ''
  if (submittedBy) notesContent += `Submitted By: ${submittedBy}\n`
  if (agentRole) notesContent += `Agent Role: ${agentRole}\n`
  if (lot) notesContent += `Lot: ${lot}\n`
  if (block) notesContent += `Block: ${block}\n`
  if (subdivision) notesContent += `Subdivision: ${subdivision}\n`
  if (floorPlan) notesContent += `Floor Plan: ${floorPlan}\n`
  if (notes) notesContent += `\n${notes}`

  if (notesContent) properties['Notes'] = { rich_text: [{ type: 'text', text: { content: notesContent.trim() } }] }
  if (agent) properties['Agent'] = { rich_text: [{ type: 'text', text: { content: agent } }] }
  if (assistingAgent) properties['Assisting Agent'] = { rich_text: [{ type: 'text', text: { content: assistingAgent } }] }
  if (brokerName) properties['Broker Name'] = { rich_text: [{ type: 'text', text: { content: brokerName } }] }
  if (loName) properties['LO Name'] = { rich_text: [{ type: 'text', text: { content: loName } }] }
  if (loEmail && isValidEmail(loEmail)) properties['LO Email'] = { email: loEmail }
  if (loPhone && isValidPhone(loPhone)) properties['LO Phone'] = { phone_number: loPhone }
  if (loanAmount) properties['Loan Amount'] = { number: parseFloat(loanAmount) || 0 }
  if (loanType) properties['Loan Type'] = { select: { name: loanType } }
  if (realtorPartner) properties['Realtor Partner'] = { rich_text: [{ type: 'text', text: { content: realtorPartner } }] }
  if (realtorEmail && isValidEmail(realtorEmail)) properties['Realtor Email'] = { email: realtorEmail }
  if (realtorPhone && isValidPhone(realtorPhone)) properties['Realtor Phone'] = { phone_number: realtorPhone }
  if (closedDate) properties['Scheduled Closing'] = { date: { start: closedDate } }
  if (executeDate) properties['Execution Date'] = { date: { start: executeDate } }
  if (salesPrice) properties['Sales Price'] = { number: parseFloat(salesPrice) || 0 }

  // Update the Pipeline record
  await axios.patch(
    `https://api.notion.com/v1/pages/${dealId}`,
    { properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )

  // Archive the original Property (if propertyId provided)
  if (propertyId && isValidUUID(propertyId)) {
    await axios.patch(
      `https://api.notion.com/v1/pages/${propertyId}`,
      { archived: true },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      }
    )
  }

  return { success: true, dealId, message: 'Deal moved to Pending successfully, Property archived' }
}

// Move property from Presale to Pipeline (legacy - kept for backwards compatibility)
async function moveToPipeline(data) {
  console.log('moveToPipeline called with:', JSON.stringify(data))
  const {
    propertyId, address, closedDate, executeDate, salesPrice,
    // Required fields
    agent, buyerName, buyerEmail, buyerPhone,
    // Optional fields
    assistingAgent, brokerName,
    loName, loEmail, loPhone,
    loanAmount, loanType,
    realtorPartner, realtorEmail, realtorPhone,
    notes
  } = data

  if (!propertyId) throw new Error('Property ID is required')
  if (!isValidUUID(propertyId)) throw new Error('Invalid property ID format')
  if (!agent) throw new Error('Agent is required')
  if (!buyerName) throw new Error('Buyer name is required')
  if (!buyerEmail) throw new Error('Buyer email is required')
  if (!isValidEmail(buyerEmail)) throw new Error('Invalid buyer email format')
  if (!buyerPhone) throw new Error('Buyer phone is required')
  if (!isValidPhone(buyerPhone)) throw new Error('Invalid buyer phone format')

  const properties = {
    Address: {
      title: [{ type: 'text', text: { content: address || 'Unknown' } }]
    },
    'Loan Status': {
      select: { name: 'Loan Application Received' }
    },
    'Agent': { rich_text: [{ type: 'text', text: { content: agent } }] },
    'Buyer Name': { rich_text: [{ type: 'text', text: { content: buyerName } }] },
    'Buyer Email': { email: buyerEmail },
    'Buyer Phone': { phone_number: buyerPhone }
  }

  // Optional date fields
  if (closedDate) properties['Scheduled Closing'] = { date: { start: closedDate } }
  if (executeDate) properties['Execution Date'] = { date: { start: executeDate } }

  // Optional number fields
  if (salesPrice) properties['Sales Price'] = { number: parseFloat(salesPrice) || 0 }
  if (loanAmount) properties['Loan Amount'] = { number: parseFloat(loanAmount) || 0 }

  // Optional text fields
  if (assistingAgent) properties['Assisting Agent'] = { rich_text: [{ type: 'text', text: { content: assistingAgent } }] }
  if (brokerName) properties['Broker Name'] = { rich_text: [{ type: 'text', text: { content: brokerName } }] }
  if (loName) properties['LO Name'] = { rich_text: [{ type: 'text', text: { content: loName } }] }
  if (loEmail) {
    if (!isValidEmail(loEmail)) throw new Error('Invalid LO email format')
    properties['LO Email'] = { email: loEmail }
  }
  if (loPhone) {
    if (!isValidPhone(loPhone)) throw new Error('Invalid LO phone format')
    properties['LO Phone'] = { phone_number: loPhone }
  }
  if (loanType) properties['Loan Type'] = { select: { name: loanType } }
  if (realtorPartner) properties['Realtor Partner'] = { rich_text: [{ type: 'text', text: { content: realtorPartner } }] }
  if (realtorEmail) {
    if (!isValidEmail(realtorEmail)) throw new Error('Invalid realtor email format')
    properties['Realtor Email'] = { email: realtorEmail }
  }
  if (realtorPhone) {
    if (!isValidPhone(realtorPhone)) throw new Error('Invalid realtor phone format')
    properties['Realtor Phone'] = { phone_number: realtorPhone }
  }
  if (notes) properties['Notes'] = { rich_text: [{ type: 'text', text: { content: notes } }] }

  // Create new record in Pipeline
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

  // Archive the original property from Properties database (Fix 7)
  await axios.patch(
    `https://api.notion.com/v1/pages/${propertyId}`,
    { archived: true },
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

// Send deal back to Properties (reverse of move-to-pipeline)
async function sendBackToProperties(data) {
  console.log('sendBackToProperties called with:', JSON.stringify(data))
  const { dealId, address, salesPrice, status } = data

  if (!dealId) throw new Error('Deal ID is required')
  if (!isValidUUID(dealId)) throw new Error('Invalid deal ID format')

  const properties = {
    Address: {
      title: [{ type: 'text', text: { content: address || 'Unknown' } }]
    },
    'Status': {
      select: { name: status || 'Inventory' }
    }
  }

  if (salesPrice) properties['List Price'] = { number: parseFloat(salesPrice) || 0 }

  // Create record back in Properties
  const response = await axios.post(
    'https://api.notion.com/v1/pages',
    { parent: { database_id: DATABASE_IDS.PROPERTIES }, properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )

  // Archive the deal from Pipeline
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

  return { success: true, propertyId: response.data.id, message: 'Deal sent back to Properties successfully' }
}

// Update loan status in Pipeline
async function updateStatus(data) {
  const { dealId, loanStatus } = data

  if (!dealId) throw new Error('Deal ID is required')
  if (!isValidUUID(dealId)) throw new Error('Invalid deal ID format')
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
  if (!isValidUUID(dealId)) throw new Error('Invalid deal ID format')

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
  const { logAction, dealAddress, oldStatus, newStatus, entityType, actionType } = data

  if (!logAction) throw new Error('Log action is required')

  const properties = {
    Action: {
      title: [{ type: 'text', text: { content: logAction } }]
    },
    Timestamp: {
      date: { start: new Date().toISOString() }
    }
  }

  if (dealAddress) properties['Entity Title'] = { rich_text: [{ type: 'text', text: { content: dealAddress } }] }
  if (oldStatus) properties['From Value'] = { rich_text: [{ type: 'text', text: { content: oldStatus } }] }
  if (newStatus) properties['To Value'] = { rich_text: [{ type: 'text', text: { content: newStatus } }] }
  if (entityType) properties['Entity Type'] = { select: { name: entityType } }
  if (actionType) properties['Action Type'] = { select: { name: actionType } }

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
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check - all actions require authentication (supports header or cookie)
  const user = verifyRequestToken(req)

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { action, ...data } = req.body

  if (!action) {
    return res.status(400).json({ error: 'Action is required' })
  }

  // Check if action requires admin role
  if (ADMIN_ONLY_ACTIONS.includes(action)) {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for this action' })
    }
    // For admin actions, verify token hasn't been invalidated
    const isValidVersion = await verifyTokenVersion(user.id, user.tokenVersion || 0)
    if (!isValidVersion) {
      return res.status(401).json({ error: 'Session expired. Please login again.' })
    }
  }

  try {
    let result

    switch (action) {
      case 'move-to-submitted':
        result = await moveToSubmitted(data)
        break
      case 'move-to-pending':
        result = await moveToPending(data)
        break
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
      case 'send-back-to-properties':
        result = await sendBackToProperties(data)
        break
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    res.status(200).json(result)
  } catch (error) {
    console.error(`Action ${action} error:`, JSON.stringify({
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    }))
    res.status(500).json({ error: 'Operation failed' })
  }
}
