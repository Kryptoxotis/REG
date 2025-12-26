import { createPage, deletePage, formatPage, DATABASE_IDS } from '../../utils/notion.js'
import logger from '../../utils/logger.js'

export async function moveToClosed(req, res) {
  const { dealId, address, closeDate, finalSalePrice, agent, buyerName, commission, edwardsCo } = req.body

  if (!dealId || !address) {
    return res.status(400).json({ error: 'dealId and address required' })
  }

  const closedDealProps = {
    'Property Address': { title: [{ text: { content: address } }] },
    'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
    'Close Date': closeDate ? { date: { start: closeDate } } : undefined,
    'Final Sale Price': finalSalePrice ? { number: parseFloat(finalSalePrice) } : undefined,
    'Agent': agent ? { rich_text: [{ text: { content: agent } }] } : undefined,
    'Buyer Name': buyerName ? { rich_text: [{ text: { content: buyerName } }] } : undefined,
    'Commission': commission ? { number: parseFloat(commission) } : undefined
  }

  Object.keys(closedDealProps).forEach(key =>
    closedDealProps[key] === undefined && delete closedDealProps[key]
  )

  // Create closed deal entry first
  let result
  try {
    result = await createPage(DATABASE_IDS.CLOSED_DEALS, closedDealProps)
  } catch (createErr) {
    logger.error('Failed to create closed deal entry:', { error: createErr.message, dealId, address })
    return res.status(500).json({ error: 'Failed to create closed deal entry', details: createErr.message })
  }

  // Only delete from pipeline if create succeeded
  try {
    await deletePage(dealId)
  } catch (deleteErr) {
    logger.error('CRITICAL: Failed to delete deal after closing. Duplicate exists!', {
      dealId,
      newClosedDealId: result.id,
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
