import { createPage, formatPage, DATABASE_IDS } from '../../utils/notion.js'

export async function moveToSubmitted(req, res) {
  // Properties → Submitted (first Pipeline stage)
  // Creates Pipeline record linked to Property, does NOT delete Property yet
  const { propertyId, address, salesPrice, foreman, subdivision, agentAssist, buyerName } = req.body

  if (!propertyId || !address) {
    return res.status(400).json({ error: 'propertyId and address required' })
  }
  if (!buyerName) {
    return res.status(400).json({ error: 'Buyer Name is required' })
  }

  // Create Pipeline record with status "Submitted" and link to Property
  const pipelineProps = {
    'Address': { title: [{ text: { content: address } }] },
    'Loan Status': { select: { name: 'Submitted' } },
    'Buyer Name': { rich_text: [{ text: { content: buyerName } }] },
    'Sales Price': salesPrice ? { number: parseFloat(salesPrice) } : undefined,
    'Foreman': foreman ? { rich_text: [{ text: { content: foreman } }] } : undefined,
    'Subdivision': subdivision ? { rich_text: [{ text: { content: subdivision } }] } : undefined,
    'Agent Assist': agentAssist ? { rich_text: [{ text: { content: agentAssist } }] } : undefined,
    // Store Property ID for dynamic address linking
    'Linked Property': { rich_text: [{ text: { content: propertyId } }] },
    'Address Locked': { checkbox: false }
  }

  Object.keys(pipelineProps).forEach(key =>
    pipelineProps[key] === undefined && delete pipelineProps[key]
  )

  const result = await createPage(DATABASE_IDS.PIPELINE, pipelineProps)
  // Do NOT delete Property - it stays linked until move to Pending

  return res.json({ success: true, data: formatPage(result) })
}
