import validator from 'validator'
import { updatePage, deletePage, formatPage } from '../../utils/notion.js'
import { validatePageId } from '../../utils/validation.js'
import logger from '../../utils/logger.js'

export async function moveToPending(req, res) {
  // Submitted → Pending (full form, archives Property, locks address)
  const {
    dealId, propertyId,
    submittedBy, agentRole, streetAddress, city, state, zipCode,
    lot, block, subdivision, floorPlan,
    agent, buyerName, buyerEmail, buyerPhone,
    assistingAgent, brokerName, loName, loEmail, loPhone,
    loanAmount, loanType, realtorPartner, realtorEmail, realtorPhone, notes
  } = req.body

  // Validate dealId format (UUID)
  const dealIdCheck = validatePageId(dealId, 'dealId')
  if (!dealIdCheck.valid) {
    return res.status(400).json({ error: dealIdCheck.error })
  }

  // Validate propertyId if provided
  if (propertyId) {
    const propertyIdCheck = validatePageId(propertyId, 'propertyId')
    if (!propertyIdCheck.valid) {
      return res.status(400).json({ error: propertyIdCheck.error })
    }
  }

  // Validate required fields (replaces Tally form)
  const requiredFields = { agent, buyerName, buyerEmail, buyerPhone, streetAddress, city, state, zipCode, subdivision, floorPlan }
  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => !value)
    .map(([key]) => key)

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: `Required: ${missingFields.join(', ')}`
    })
  }

  // Validate email format
  if (!validator.isEmail(buyerEmail)) {
    return res.status(400).json({ error: 'Invalid buyer email format' })
  }
  if (loEmail && !validator.isEmail(loEmail)) {
    return res.status(400).json({ error: 'Invalid LO email format' })
  }
  if (realtorEmail && !validator.isEmail(realtorEmail)) {
    return res.status(400).json({ error: 'Invalid realtor email format' })
  }

  // Validate phone format
  const phoneDigits = buyerPhone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return res.status(400).json({ error: 'Phone must have 10-15 digits' })
  }

  // Build full address
  const fullAddress = streetAddress

  // Update Pipeline record with all form data and lock address
  const pipelineProps = {
    'Address': { title: [{ text: { content: fullAddress } }] },
    'Loan Status': { select: { name: 'Loan Application Received' } }, // Move to first Pending status
    'Submitted By': submittedBy ? { rich_text: [{ text: { content: submittedBy } }] } : undefined,
    'Agent Role': agentRole ? { rich_text: [{ text: { content: agentRole } }] } : undefined,
    'City': city ? { select: { name: city } } : undefined,
    'State': state ? { select: { name: state } } : undefined,
    'ZIP Code': zipCode ? { rich_text: [{ text: { content: zipCode } }] } : undefined,
    'Lot': lot ? { rich_text: [{ text: { content: lot } }] } : undefined,
    'Block': block ? { rich_text: [{ text: { content: block } }] } : undefined,
    'Subdivision': subdivision ? { rich_text: [{ text: { content: subdivision } }] } : undefined,
    'Floor Plan': floorPlan ? { rich_text: [{ text: { content: floorPlan } }] } : undefined,
    'Agent': { rich_text: [{ text: { content: agent } }] },
    'Buyer Name': { rich_text: [{ text: { content: buyerName } }] },
    'Buyer Email': { email: buyerEmail },
    'Buyer Phone': { phone_number: buyerPhone },
    'Assisting Agent': assistingAgent ? { rich_text: [{ text: { content: assistingAgent } }] } : undefined,
    'Broker Name': brokerName ? { rich_text: [{ text: { content: brokerName } }] } : undefined,
    'LO Name': loName ? { rich_text: [{ text: { content: loName } }] } : undefined,
    'LO Email': loEmail ? { email: loEmail } : undefined,
    'LO Phone': loPhone ? { phone_number: loPhone } : undefined,
    'Loan Amount': loanAmount ? { number: parseFloat(loanAmount) } : undefined,
    'Loan Type': loanType ? { select: { name: loanType } } : undefined,
    'Realtor Partner': realtorPartner ? { rich_text: [{ text: { content: realtorPartner } }] } : undefined,
    'Realtor Email': realtorEmail ? { email: realtorEmail } : undefined,
    'Realtor Phone': realtorPhone ? { phone_number: realtorPhone } : undefined,
    'Notes': notes ? { rich_text: [{ text: { content: notes } }] } : undefined,
    // Lock address and clear Property link
    'Address Locked': { checkbox: true },
    'Linked Property': { rich_text: [] }, // Clear the link
    'Executed': { checkbox: true }
  }

  Object.keys(pipelineProps).forEach(key =>
    pipelineProps[key] === undefined && delete pipelineProps[key]
  )

  // Update the Pipeline record
  const result = await updatePage(dealId, pipelineProps)

  // Delete the Property record (address is now locked on Pipeline)
  if (propertyId) {
    try {
      await deletePage(propertyId)
    } catch (deleteErr) {
      logger.warn('Could not delete linked property:', deleteErr.message)
      // Continue anyway - the Pipeline record is updated
    }
  }

  return res.json({ success: true, data: formatPage(result) })
}
