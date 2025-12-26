import { updatePage, formatPage } from '../../utils/notion.js'

export async function updateStatus(req, res) {
  const { dealId, loanStatus } = req.body
  if (!dealId || !loanStatus) {
    return res.status(400).json({ error: 'dealId and loanStatus required' })
  }

  const properties = {
    'Loan Status': { select: { name: loanStatus } }
  }
  const result = await updatePage(dealId, properties)
  return res.json({ success: true, data: formatPage(result) })
}
