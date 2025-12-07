import axios from 'axios'
import { Readable } from 'stream'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'
const DATABASE_ID = '2bb746b9-e0e8-8163-9afe-cf0c567c2586' // Properties database

// Parse CSV content
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ''
    })
    rows.push(row)
  }

  return rows
}

// Query existing properties from Notion
async function queryDatabase() {
  const response = await axios.post(
    `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )
  return response.data.results
}

// Create a new page in Notion
async function createPage(properties) {
  const response = await axios.post(
    'https://api.notion.com/v1/pages',
    {
      parent: { database_id: DATABASE_ID },
      properties
    },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )
  return response.data
}

// Update an existing page in Notion
async function updatePage(pageId, properties) {
  const response = await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    { properties },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )
  return response.data
}

// Archive a page in Notion
async function archivePage(pageId) {
  const response = await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    { archived: true },
    {
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    }
  )
  return response.data
}

// Extract address from Notion page
function getAddress(page) {
  const titleProp = page.properties.Address || page.properties.Name || page.properties.Title
  if (titleProp?.title?.[0]?.plain_text) {
    return titleProp.title[0].plain_text
  }
  return null
}

// Extract status from Notion page
function getStatus(page) {
  if (page.properties.Status?.select?.name) {
    return page.properties.Status.select.name
  }
  return null
}

// Convert CSV row to Notion properties
function rowToNotionProperties(row) {
  const props = {}

  // Address is the title field
  if (row.Address || row.address) {
    props.Address = {
      title: [{ text: { content: row.Address || row.address } }]
    }
  }

  // Status is a select field
  if (row.Status || row.status) {
    props.Status = {
      select: { name: row.Status || row.status }
    }
  }

  // Add other common fields if present
  if (row.Price || row.price) {
    const price = parseFloat((row.Price || row.price).replace(/[$,]/g, ''))
    if (!isNaN(price)) {
      props.Price = { number: price }
    }
  }

  if (row.Beds || row.beds || row.Bedrooms || row.bedrooms) {
    const beds = parseInt(row.Beds || row.beds || row.Bedrooms || row.bedrooms)
    if (!isNaN(beds)) {
      props.Beds = { number: beds }
    }
  }

  if (row.Baths || row.baths || row.Bathrooms || row.bathrooms) {
    const baths = parseFloat(row.Baths || row.baths || row.Bathrooms || row.bathrooms)
    if (!isNaN(baths)) {
      props.Baths = { number: baths }
    }
  }

  if (row['Sq Ft'] || row.sqft || row.SqFt) {
    const sqft = parseInt((row['Sq Ft'] || row.sqft || row.SqFt).replace(/,/g, ''))
    if (!isNaN(sqft)) {
      props['Sq Ft'] = { number: sqft }
    }
  }

  return props
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

    // Parse CSV
    const csvRows = parseCSV(csvContent)
    if (csvRows.length === 0) {
      return res.status(400).json({ error: 'No valid data rows found in CSV' })
    }

    // Get existing properties from Notion
    const existingPages = await queryDatabase()
    const existingByAddress = new Map()
    existingPages.forEach(page => {
      const addr = getAddress(page)
      if (addr) {
        existingByAddress.set(addr.toLowerCase(), page)
      }
    })

    // Track addresses in CSV
    const csvAddresses = new Set()

    // Process results
    const results = {
      added: 0,
      updated: 0,
      archived: 0,
      errors: []
    }

    // Process each CSV row
    for (const row of csvRows) {
      const address = row.Address || row.address
      if (!address) continue

      csvAddresses.add(address.toLowerCase())
      const existingPage = existingByAddress.get(address.toLowerCase())

      try {
        if (existingPage) {
          // Check if status changed
          const existingStatus = getStatus(existingPage)
          const newStatus = row.Status || row.status

          if (existingStatus !== newStatus) {
            await updatePage(existingPage.id, rowToNotionProperties(row))
            results.updated++
          }
        } else {
          // Create new property
          await createPage(rowToNotionProperties(row))
          results.added++
        }
      } catch (err) {
        results.errors.push(`Error processing ${address}: ${err.message}`)
      }
    }

    // Archive properties not in CSV (optional - only if explicitly requested)
    if (req.body?.archiveMissing) {
      for (const [addr, page] of existingByAddress) {
        if (!csvAddresses.has(addr)) {
          try {
            await archivePage(page.id)
            results.archived++
          } catch (err) {
            results.errors.push(`Error archiving ${addr}: ${err.message}`)
          }
        }
      }
    }

    res.status(200).json({
      message: 'Sync completed!',
      details: {
        added: results.added,
        updated: results.updated,
        deleted: results.archived
      },
      errors: results.errors.length > 0 ? results.errors : undefined
    })
  } catch (error) {
    console.error('Sync error:', error.message, error.response?.data)
    res.status(500).json({
      error: 'Sync failed',
      details: error.message
    })
  }
}
