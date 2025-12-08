// Vercel API proxy to n8n webhook for CSV sync
// This proxies requests to the n8n workflow that handles the actual Notion sync logic

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // n8n webhook URL - using environment variable with fallback
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://100.89.5.69:5678/webhook/properties-sync'

  try {
    // Get CSV content from request body
    let csvContent = ''

    if (typeof req.body === 'string') {
      csvContent = req.body
    } else if (req.body?.csv) {
      csvContent = req.body.csv
    } else if (req.body?.data) {
      csvContent = req.body.data
    } else {
      return res.status(400).json({ error: 'No CSV content provided. Send CSV as string in body or in "csv" field.' })
    }

    // Create FormData-like body for n8n webhook
    // n8n expects the file content, we'll send it as JSON with the CSV data
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        csv: csvContent,
        source: 'vercel-proxy'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('n8n webhook error:', response.status, errorText)
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }

    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    console.error('Proxy error:', error.message)
    res.status(500).json({
      error: 'Sync failed',
      details: error.message
    })
  }
}
