// Vercel API proxy to n8n webhook for file sync
// Parses xlsx/csv file and sends CSV data to n8n

import * as XLSX from 'xlsx'
import { verifyToken, handleCors } from '../../config/utils.js'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

export const config = {
  api: {
    bodyParser: false
  }
}

// Parse multipart form data manually
async function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const contentType = req.headers['content-type'] || ''
      const boundary = contentType.split('boundary=')[1]

      if (!boundary) {
        reject(new Error('No boundary found in content-type'))
        return
      }

      const parts = buffer.toString('binary').split('--' + boundary)
      let fileBuffer = null
      let filename = 'upload.xlsx'

      for (const part of parts) {
        if (part.includes('Content-Disposition')) {
          const filenameMatch = part.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }

          const nameMatch = part.match(/name="([^"]+)"/)
          if (nameMatch && nameMatch[1] === 'file') {
            // Find the start of file content (after double CRLF)
            const headerEnd = part.indexOf('\r\n\r\n')
            if (headerEnd !== -1) {
              const content = part.slice(headerEnd + 4)
              // Remove trailing \r\n--
              const cleanContent = content.replace(/\r\n$/, '')
              fileBuffer = Buffer.from(cleanContent, 'binary')
            }
          }
        }
      }

      if (!fileBuffer) {
        reject(new Error('No file found in request'))
        return
      }

      resolve({ fileBuffer, filename })
    })
    req.on('error', reject)
  })
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
  if (handleCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check - require admin role for file uploads
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const user = verifyToken(token)

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required for file sync' })
  }

  // Check content-length for file size limit
  const contentLength = parseInt(req.headers['content-length'] || '0', 10)
  if (contentLength > MAX_FILE_SIZE) {
    return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' })
  }

  // n8n webhook URL
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.kryptoxotis.com/webhook/properties-sync'

  try {
    // Parse multipart form data
    const { fileBuffer, filename } = await parseMultipartForm(req)

    // Double-check actual file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' })
    }

    // Parse file to CSV
    const csvContent = parseFileToCSV(fileBuffer, filename)

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
