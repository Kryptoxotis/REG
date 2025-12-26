import { updatePage, formatPage } from '../../utils/notion.js'
import { validatePageId } from '../../utils/validation.js'

export async function updateStatus(req, res) {
  const { dealId, loanStatus } = req.body

  const dealIdCheck = validatePageId(dealId, 'dealId')
  if (!dealIdCheck.valid) {
    return res.status(400).json({ error: dealIdCheck.error })
  }

  if (!loanStatus) {
    return res.status(400).json({ error: 'loanStatus required' })
  }

  const properties = {
    'Loan Status': { select: { name: loanStatus } }
  }
  const result = await updatePage(dealId, properties)
  return res.json({ success: true, data: formatPage(result) })
}
