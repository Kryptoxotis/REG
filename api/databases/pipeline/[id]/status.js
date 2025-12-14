import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { loanStatus } = req.body

  if (!id) {
    return res.status(400).json({ error: 'Deal ID is required' })
  }

  if (!loanStatus) {
    return res.status(400).json({ error: 'Loan status is required' })
  }

  try {
    const response = await axios.patch(
      `https://api.notion.com/v1/pages/${id}`,
      {
        properties: {
          'Loan Status': {
            select: { name: loanStatus }
          }
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

    res.status(200).json({
      success: true,
      id: response.data.id
    })
  } catch (error) {
    console.error('Status update error:', error.response?.data || error.message)
    res.status(500).json({
      error: 'Failed to update loan status',
      details: error.response?.data?.message || error.message
    })
  }
}
