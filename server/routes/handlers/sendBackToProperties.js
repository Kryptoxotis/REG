import { createPage, deletePage, formatPage, DATABASE_IDS } from '../../utils/notion.js'
import logger from '../../utils/logger.js'

export async function sendBackToProperties(req, res) {
  const { dealId, address, salesPrice, status, edwardsCo } = req.body

  if (!dealId || !address) {
    return res.status(400).json({ error: 'dealId and address required' })
  }

  const propertyProps = {
    'Address': { title: [{ text: { content: address } }] },
    'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
    'Price': salesPrice ? { number: parseFloat(salesPrice) } : undefined,
    'Status': status ? { select: { name: status } } : { select: { name: 'Available' } }
  }

  Object.keys(propertyProps).forEach(key =>
    propertyProps[key] === undefined && delete propertyProps[key]
  )

  // Create property entry first
  let result
  try {
    result = await createPage(DATABASE_IDS.PROPERTIES, propertyProps)
  } catch (createErr) {
    logger.error('Failed to create property entry:', { error: createErr.message, dealId, address })
    return res.status(500).json({ error: 'Failed to create property entry', details: createErr.message })
  }

  // Only delete from pipeline if create succeeded
  try {
    await deletePage(dealId)
  } catch (deleteErr) {
    logger.error('CRITICAL: Failed to delete deal after sending back to properties. Duplicate exists!', {
      dealId,
      newPropertyId: result.id,
      address,
      error: deleteErr.message
    })
    return res.json({
      success: true,
      data: formatPage(result),
      warning: 'Deal was not archived from Pipeline. Please manually remove to avoid duplicates.',
      requiresManualCleanup: true,
      duplicateDealId: dealId
    })
  }

  return res.json({ success: true, data: formatPage(result) })
}
