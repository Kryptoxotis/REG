// Vercel API proxy to n8n webhook for file sync
// Parses xlsx/csv file and sends CSV data to n8n

import formidable from 'formidable'
import fs from 'fs'
import * as XLSX from 'xlsx'

export const config = {
  api: {
    bodyParser: false // Disable body parser to handle file uploads
  }
}

// Parse file to CSV string
function parseFileToCSV(buffer, filename) {
  const isCSV = filename.toLowerCase().endsWith('.csv')

  if (isCSV) {
    return buffer.toString('utf-8')
  }

  // Parse XLSX/XLS with xlsx library
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Convert to JSON first to process
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (jsonData.length === 0) throw new Error('Spreadsheet is empty')

  // Get headers
  const headers = jsonData[0].map(h => String(h || '').trim())

  // Check for Stnum/Stname columns and add Address
  const stnumIdx = headers.findIndex(h => h.toLowerCase() === 'stnum')
  const stnameIdx = headers.findIndex(h => h.toLowerCase() === 'stname')

  if (stnumIdx !== -1 && stnameIdx !== -1) {
    headers.push('Address')
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (row && row.length > 0) {
        const stnum = String(row[stnumIdx] || '').trim()
        const stname = String(row[stnameIdx] || '').trim()
        row.push(stnum && stname ? stnum + ' ' + stname : stnum || stname)
      }
    }
    jsonData[0] = headers
  }

  const newSheet = XLSX.utils.aoa_to_sheet(jsonData)
  return XLSX.utils.sheet_to_csv(newSheet)
}

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

  // n8n webhook URL
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.kryptoxotis.com/webhook/properties-sync'

  try {
    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024 // 10MB limit
    })

    const [fields, files] = await form.parse(req)

    const uploadedFile = files.file?.[0]
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Read the file
    const fileBuffer = fs.readFileSync(uploadedFile.filepath)
    const filename = fields.filename?.[0] || uploadedFile.originalFilename || 'upload.xlsx'

    // Parse file to CSV
    const csvContent = parseFileToCSV(fileBuffer, filename)

    // Clean up temp file
    fs.unlinkSync(uploadedFile.filepath)

    // Send CSV to n8n webhook as JSON (matches existing workflow)
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        csv: csvContent,
        source: 'vercel-proxy',
        filename: filename
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
