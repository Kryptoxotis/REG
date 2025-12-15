import express from 'express'
import { queryDatabase, getDatabaseInfo, formatPage, DATABASE_IDS, updatePage, createPage, deletePage } from '../utils/notion.js'

const router = express.Router()

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

// Middleware to check admin role
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

// Get all database info (admin only)
router.get('/info', requireAuth, requireAdmin, async (req, res) => {
  try {
    const databases = {}
    for (const [key, id] of Object.entries(DATABASE_IDS)) {
      databases[key] = await getDatabaseInfo(id)
    }
    res.json(databases)
  } catch (error) {
    console.error('Error fetching database info:', error)
    res.status(500).json({ error: 'Failed to fetch database info' })
  }
})

// Get overview stats (for dashboard) - MUST come before /:databaseKey route
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { type } = req.query

    // Handle office-level stats for OfficeOverview component
    if (type === 'by-office') {
      const pipelineId = DATABASE_IDS.PIPELINE
      const results = await queryDatabase(pipelineId)
      const formatted = results.map(formatPage)

      // Office mapping based on Edwards Co. field
      const officeMap = {
        'El Paso': ["Edward's LLC.", "Edwards LLC", "El Paso"],
        'Las Cruces': ["Edward's NM.", "Edwards NM", "Las Cruces", "New Mexico"],
        'McAllen': ["Edward's RGV", "Edwards RGV", "McAllen"],
        'San Antonio': ["San Antonio"]
      }

      const officeList = ['El Paso', 'Las Cruces', 'McAllen', 'San Antonio']
      const offices = {}
      const totals = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0 }

      // Initialize office stats
      officeList.forEach(office => {
        offices[office] = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0 }
      })
      offices['Other'] = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0 }

      // Categorize each deal
      formatted.forEach(deal => {
        const officeField = deal['Edwards Co.'] || deal['Edwards Co'] || deal.Office || ''
        const status = (deal['Loan Status'] || deal.Status || '').toLowerCase()
        const salesPrice = deal['Sales Price'] || deal.SalesPrice || 0

        // Find matching office
        let matchedOffice = 'Other'
        for (const [officeName, terms] of Object.entries(officeMap)) {
          if (terms.some(term => officeField.toLowerCase().includes(term.toLowerCase()))) {
            matchedOffice = officeName
            break
          }
        }

        // Categorize by status
        const officeStats = offices[matchedOffice]
        if (status.includes('active') || status.includes('application') || status.includes('processing')) {
          officeStats.active++
          totals.active++
        } else if (status.includes('pending') || status.includes('conditions')) {
          officeStats.pending++
          totals.pending++
        } else if (status.includes('sold') || status.includes('back on market')) {
          officeStats.sold++
          totals.sold++
        } else if (status.includes('executed') || status.includes('funded')) {
          officeStats.executed++
          totals.executed++
        } else if (status.includes('closed') || status.includes('close')) {
          officeStats.closes++
          totals.closes++
        } else {
          // Default to pending for unknown statuses
          officeStats.pending++
          totals.pending++
        }

        // Add volume
        if (typeof salesPrice === 'number') {
          officeStats.volume += salesPrice
          totals.volume += salesPrice
        }
      })

      return res.json({ offices, totals, officeList })
    }

    // Default: return basic stats for all databases
    const stats = {}
    for (const [key, id] of Object.entries(DATABASE_IDS)) {
      const results = await queryDatabase(id)
      stats[key] = {
        count: results.length,
        name: key.replace(/_/g, ' ').toLowerCase()
      }
    }

    res.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Get city-level pipeline stats for overview
router.get('/stats/cities', requireAuth, async (req, res) => {
  try {
    const pipelineId = DATABASE_IDS.PIPELINE
    const results = await queryDatabase(pipelineId)
    const formatted = results.map(formatPage)

    // Aggregate deals by city/subdivision
    const cityStats = {}

    formatted.forEach(deal => {
      // Try to extract city from Subdivision, City field, or parse from Address
      let city = deal.Subdivision || deal.City || deal['Builder/City'] || 'Other'

      // If no city found, try to extract from address (last part before state/zip)
      if (city === 'Other' && deal.Address) {
        const addressParts = deal.Address.split(',')
        if (addressParts.length >= 2) {
          city = addressParts[addressParts.length - 2]?.trim() || 'Other'
        }
      }

      if (!cityStats[city]) {
        cityStats[city] = {
          name: city,
          dealCount: 0,
          totalVolume: 0,
          deals: [],
          statuses: {}
        }
      }

      cityStats[city].dealCount++

      // Add to total volume if Sales Price exists
      const salesPrice = deal['Sales Price'] || deal.SalesPrice || 0
      if (typeof salesPrice === 'number') {
        cityStats[city].totalVolume += salesPrice
      }

      // Track deal statuses
      const status = deal['Loan Status'] || deal.Status || 'Unknown'
      cityStats[city].statuses[status] = (cityStats[city].statuses[status] || 0) + 1

      // Store deal details (limit to avoid huge payload)
      if (cityStats[city].deals.length < 20) {
        cityStats[city].deals.push({
          id: deal.id,
          address: deal.Address || 'N/A',
          buyerName: deal['Buyer Name'] || 'N/A',
          agent: deal.Agent || 'N/A',
          salesPrice: salesPrice,
          status: status,
          scheduledClosing: deal['Scheduled Closing'] || null,
          executed: deal.Executed
        })
      }
    })

    // Convert to array and sort by deal count
    const citiesArray = Object.values(cityStats)
      .sort((a, b) => b.dealCount - a.dealCount)
      .slice(0, 10) // Top 10 cities

    res.json({
      cities: citiesArray,
      totalDeals: formatted.length
    })
  } catch (error) {
    console.error('Error fetching city stats:', error)
    res.status(500).json({ error: 'Failed to fetch city stats' })
  }
})

// Get data from a specific database
router.get('/:databaseKey', requireAuth, async (req, res) => {
  try {
    const { databaseKey } = req.params
    const databaseId = DATABASE_IDS[databaseKey.toUpperCase()]

    if (!databaseId) {
      return res.status(404).json({ error: 'Database not found' })
    }

    const results = await queryDatabase(databaseId)
    const formatted = results.map(formatPage)

    res.json(formatted)
  } catch (error) {
    console.error('Error fetching database data:', error)
    res.status(500).json({ error: 'Failed to fetch data' })
  }
})

// Get raw data for debugging field names
router.get('/:databaseKey/raw', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { databaseKey } = req.params
    const databaseId = DATABASE_IDS[databaseKey.toUpperCase()]

    if (!databaseId) {
      return res.status(404).json({ error: 'Database not found' })
    }

    const results = await queryDatabase(databaseId)
    // Return first item with all properties for debugging
    if (results.length > 0) {
      res.json({
        sample: results[0],
        propertyNames: Object.keys(results[0].properties),
        formatted: formatPage(results[0])
      })
    } else {
      res.json({ message: 'No data in database' })
    }
  } catch (error) {
    console.error('Error fetching raw data:', error)
    res.status(500).json({ error: 'Failed to fetch raw data' })
  }
})

// Update a record in Notion
router.put('/:databaseKey/:pageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { pageId } = req.params
    const { properties } = req.body

    if (!properties) {
      return res.status(400).json({ error: 'Properties required' })
    }

    const result = await updatePage(pageId, properties)
    res.json({ success: true, data: formatPage(result) })
  } catch (error) {
    console.error('Error updating page:', error)
    res.status(500).json({ error: 'Failed to update record' })
  }
})

// Create a new record in Notion
router.post('/:databaseKey', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { databaseKey } = req.params
    const databaseId = DATABASE_IDS[databaseKey.toUpperCase()]
    const { properties } = req.body

    if (!databaseId) {
      return res.status(404).json({ error: 'Database not found' })
    }

    if (!properties) {
      return res.status(400).json({ error: 'Properties required' })
    }

    const result = await createPage(databaseId, properties)
    res.json({ success: true, data: formatPage(result) })
  } catch (error) {
    console.error('Error creating page:', error)
    res.status(500).json({ error: 'Failed to create record' })
  }
})

// Delete (archive) a record in Notion
router.delete('/:databaseKey/:pageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { pageId } = req.params

    await deletePage(pageId)
    res.json({ success: true, message: 'Record archived' })
  } catch (error) {
    console.error('Error deleting page:', error)
    res.status(500).json({ error: 'Failed to delete record' })
  }
})

export default router
