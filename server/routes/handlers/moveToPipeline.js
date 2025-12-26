import validator from 'validator'
import { createPage, deletePage, formatPage, DATABASE_IDS } from '../../utils/notion.js'
import logger from '../../utils/logger.js'

export async function moveToPipeline(req, res) {
  const {
    propertyId, address, salesPrice, edwardsCo, agent, buyerName,
    buyerEmail, buyerPhone, assistingAgent, brokerName, loName,
    loEmail, loPhone, loanAmount, loanType, realtorPartner,
    realtorEmail, realtorPhone, notes, closedDate, executeDate
  } = req.body

  // Validate required fields
  if (!propertyId || !address || !agent || !buyerName || !buyerEmail || !buyerPhone) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'propertyId, address, agent, buyerName, buyerEmail, and buyerPhone are required'
    })
  }

  // Validate email format using validator.js
  if (!validator.isEmail(buyerEmail)) {
    return res.status(400).json({ error: 'Invalid buyer email format' })
  }
  if (loEmail && !validator.isEmail(loEmail)) {
    return res.status(400).json({ error: 'Invalid LO email format' })
  }
  if (realtorEmail && !validator.isEmail(realtorEmail)) {
    return res.status(400).json({ error: 'Invalid realtor email format' })
  }

  // Validate phone format - must have 10-15 digits with optional formatting
  const phoneDigits = buyerPhone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return res.status(400).json({ error: 'Phone must have 10-15 digits' })
  }
  // Only allow digits and common phone formatting chars
  if (!/^[\d\s\-\(\)\+\.]+$/.test(buyerPhone)) {
    return res.status(400).json({ error: 'Invalid phone format - use digits, spaces, dashes, parentheses, or plus' })
  }

  // Create pipeline entry
  const pipelineProps = {
    'Address': { title: [{ text: { content: address } }] },
    'Sales Price': { number: parseFloat(salesPrice) || 0 },
    'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
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
    'Scheduled Closing': closedDate ? { date: { start: closedDate } } : undefined,
    'Execute Date': executeDate ? { date: { start: executeDate } } : undefined,
    'Loan Status': { select: { name: 'Loan Application Received' } },
    'Executed': { checkbox: true }
  }

  Object.keys(pipelineProps).forEach(key =>
    pipelineProps[key] === undefined && delete pipelineProps[key]
  )

  // Create pipeline entry first
  let result
  try {
    result = await createPage(DATABASE_IDS.PIPELINE, pipelineProps)
  } catch (createErr) {
    logger.error('Failed to create pipeline entry:', { error: createErr.message, propertyId, address })
    return res.status(500).json({ error: 'Failed to create pipeline entry', details: createErr.message })
  }

  // Only delete property if create succeeded
  try {
    await deletePage(propertyId)
  } catch (deleteErr) {
    // CRITICAL: Log for manual cleanup - record exists in both databases
    logger.error('CRITICAL: Failed to delete property after pipeline creation. Duplicate exists!', {
      propertyId,
      newPipelineId: result.id,
      address,
      error: deleteErr.message
    })
    // Return success but warn about the duplicate
    return res.json({
      success: true,
      data: formatPage(result),
      warning: 'Property was not archived. Please manually remove from Properties to avoid duplicates.',
      requiresManualCleanup: true,
      duplicatePropertyId: propertyId
    })
  }

  return res.json({ success: true, data: formatPage(result) })
}
