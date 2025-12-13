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

// Get team KPIs with aggregated pipeline data - MUST come before /:databaseKey route
router.get('/team-kpis', requireAuth, async (req, res) => {
  try {
    // Fetch team members
    const teamMembers = await queryDatabase(DATABASE_IDS.TEAM_MEMBERS)

    // Fetch pipeline data
    const pipelineData = await queryDatabase(DATABASE_IDS.PIPELINE)

    // Process each team member and calculate their KPIs
    const teamKPIs = teamMembers.map(member => {
      const formatted = formatPage(member)
      const memberName = formatted.Name || formatted.name || ''

      // Find all pipeline deals for this team member
      const memberDeals = pipelineData.filter(deal => {
        const dealFormatted = formatPage(deal)
        const agent = dealFormatted.Agent || dealFormatted.agent || ''
        return agent.toLowerCase().includes(memberName.toLowerCase()) ||
               memberName.toLowerCase().includes(agent.toLowerCase())
      }).map(deal => formatPage(deal))

      // Calculate KPIs
      const closedStatuses = ['closed', 'sold', 'completed', 'won']
      const executedStatuses = ['executed', 'under contract']
      const pendingStatuses = ['pending', 'active', 'in progress', 'new', 'prospect']

      const closedDeals = memberDeals.filter(d => {
        const status = (d.Status || d.status || '').toLowerCase()
        return closedStatuses.some(s => status.includes(s))
      })

      const executedDeals = memberDeals.filter(d => {
        const status = (d.Status || d.status || '').toLowerCase()
        return executedStatuses.some(s => status.includes(s))
      })

      const pendingDeals = memberDeals.filter(d => {
        const status = (d.Status || d.status || '').toLowerCase()
        return pendingStatuses.some(s => status.includes(s)) || !closedStatuses.some(s => status.includes(s))
      })

      // Calculate volumes
      const getVolume = (deal) => {
        const price = deal.Price || deal.price || deal['Sale Price'] || deal['Contract Price'] || deal.Volume || 0
        return typeof price === 'number' ? price : parseFloat(price) || 0
      }

      const totalVolume = memberDeals.reduce((sum, d) => sum + getVolume(d), 0)
      const closedVolume = closedDeals.reduce((sum, d) => sum + getVolume(d), 0)

      // Recent deals (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const recentDeals = memberDeals.filter(d => {
        const date = new Date(d['Created At'] || d.createdAt || d.Date || 0)
        return date >= thirtyDaysAgo
      }).length

      const totalDealsCount = memberDeals.length
      const closedDealsCount = closedDeals.length
      const avgDealSize = totalDealsCount > 0 ? Math.round(totalVolume / totalDealsCount) : 0
      const closingRate = totalDealsCount > 0 ? Math.round((closedDealsCount / totalDealsCount) * 100) : 0

      // Format deal data for frontend display
      const formatDealForDisplay = (deal) => ({
        id: deal.id,
        address: deal.Address || deal.address || deal['Property Address'] || 'No Address',
        buyerName: deal['Buyer Name'] || deal.buyerName || deal.Client || '',
        salesPrice: getVolume(deal),
        loanStatus: deal['Loan Status'] || deal.loanStatus || '',
        scheduledClosing: deal['Scheduled Closing'] || deal.scheduledClosing || deal['Closing Date'] || null,
        executed: executedStatuses.some(s => (deal.Status || deal.status || '').toLowerCase().includes(s)),
        status: deal.Status || deal.status || ''
      })

      return {
        id: member.id,
        name: formatted.Name || formatted.name || 'Unknown',
        role: formatted.Role || formatted.role || formatted.Position || 'Agent',
        status: formatted.Status || formatted.status || 'Active',
        phone: formatted.Phone || formatted.phone || formatted['Phone Number'] || '',
        email: formatted.Email || formatted.email || '',
        // Include all other fields from Notion for the detail view
        allFields: formatted,
        kpis: {
          totalDeals: totalDealsCount,
          closedDeals: closedDealsCount,
          executedDeals: executedDeals.length,
          pendingDeals: pendingDeals.length,
          totalVolume,
          closedVolume,
          avgDealSize,
          closingRate,
          recentDeals
        },
        // Include actual deals for clickable KPIs
        deals: {
          all: memberDeals.map(formatDealForDisplay),
          closed: closedDeals.map(formatDealForDisplay),
          executed: executedDeals.map(formatDealForDisplay),
          pending: pendingDeals.map(formatDealForDisplay)
        }
      }
    })

    res.json(teamKPIs)
  } catch (error) {
    console.error('Error fetching team KPIs:', error)
    res.status(500).json({ error: 'Failed to fetch team KPIs' })
  }
})

// Get overview stats (for dashboard) - MUST come before /:databaseKey route
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = {}

    // Get counts from each database
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

// Get stats grouped by office location - MUST come before /:databaseKey route
router.get('/stats/by-office', requireAuth, async (req, res) => {
  try {
    // Fetch pipeline data
    const pipelineData = await queryDatabase(DATABASE_IDS.PIPELINE)
    const formattedPipeline = pipelineData.map(formatPage)

    // Office locations
    const offices = ['El Paso', 'Las Cruces', 'McAllen', 'San Antonio']

    // Status categories
    const statusCategories = {
      active: ['active', 'new', 'prospect', 'in progress'],
      pending: ['pending', 'under contract', 'awaiting'],
      sold: ['sold', 'closed', 'completed', 'won'],
      executed: ['executed']
    }

    // Helper to categorize status
    const getStatusCategory = (status) => {
      const s = (status || '').toLowerCase()
      for (const [category, keywords] of Object.entries(statusCategories)) {
        if (keywords.some(kw => s.includes(kw))) return category
      }
      return 'active' // default
    }

    // Helper to get volume
    const getVolume = (deal) => {
      const price = deal.Price || deal.price || deal['Sale Price'] || deal['Contract Price'] || deal.Volume || 0
      return typeof price === 'number' ? price : parseFloat(price) || 0
    }

    // Helper to detect office from deal data
    const getOffice = (deal) => {
      // Check common field names for office/market/location
      const officeField = deal.Office || deal.office || deal.Market || deal.market ||
                          deal.Location || deal.location || deal.City || deal.city || ''
      const address = deal.Address || deal.address || deal['Property Address'] || ''

      const combined = `${officeField} ${address}`.toLowerCase()

      for (const office of offices) {
        if (combined.includes(office.toLowerCase())) return office
      }

      // Try to match by city names in address
      if (combined.includes('el paso')) return 'El Paso'
      if (combined.includes('las cruces')) return 'Las Cruces'
      if (combined.includes('mcallen') || combined.includes('mc allen')) return 'McAllen'
      if (combined.includes('san antonio')) return 'San Antonio'

      return 'Other'
    }

    // Build office stats
    const officeStats = {}

    for (const office of [...offices, 'Other']) {
      officeStats[office] = {
        active: 0,
        pending: 0,
        sold: 0,
        executed: 0,
        closes: 0,
        volume: 0,
        deals: []
      }
    }

    // Process each deal
    for (const deal of formattedPipeline) {
      const office = getOffice(deal)
      const category = getStatusCategory(deal.Status || deal.status)
      const volume = getVolume(deal)

      officeStats[office][category]++
      officeStats[office].volume += volume

      // Count closes (sold + executed)
      if (category === 'sold' || category === 'executed') {
        officeStats[office].closes++
      }
    }

    // Calculate totals
    const totals = {
      active: 0,
      pending: 0,
      sold: 0,
      executed: 0,
      closes: 0,
      volume: 0
    }

    for (const office of Object.keys(officeStats)) {
      totals.active += officeStats[office].active
      totals.pending += officeStats[office].pending
      totals.sold += officeStats[office].sold
      totals.executed += officeStats[office].executed
      totals.closes += officeStats[office].closes
      totals.volume += officeStats[office].volume
    }

    res.json({
      offices: officeStats,
      totals,
      officeList: offices
    })
  } catch (error) {
    console.error('Error fetching office stats:', error)
    res.status(500).json({ error: 'Failed to fetch office stats' })
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

// Update pipeline deal status (for drag-drop - any authenticated user)
router.patch('/pipeline/:pageId/status', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.params
    const { loanStatus } = req.body

    if (!loanStatus) {
      return res.status(400).json({ error: 'loanStatus required' })
    }

    const properties = {
      'Loan Status': { select: { name: loanStatus } }
    }

    const result = await updatePage(pageId, properties)
    res.json({ success: true, data: formatPage(result) })
  } catch (error) {
    console.error('Error updating deal status:', error)
    res.status(500).json({ error: 'Failed to update deal status' })
  }
})

// Create closed deal entry (auto-triggered when deal moves to Closed/Funded)
router.post('/closed-deals', requireAuth, async (req, res) => {
  try {
    const { address, edwardsCo, closeDate, finalSalePrice, agent, buyerName, commission } = req.body

    if (!address) {
      return res.status(400).json({ error: 'Address required' })
    }

    const properties = {
      'Property Address': { title: [{ text: { content: address } }] },
      'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
      'Close Date': closeDate ? { date: { start: closeDate } } : undefined,
      'Final Sale Price': finalSalePrice ? { number: finalSalePrice } : undefined,
      'Agent': agent ? { rich_text: [{ text: { content: agent } }] } : undefined,
      'Buyer Name': buyerName ? { rich_text: [{ text: { content: buyerName } }] } : undefined,
      'Commission': commission ? { number: commission } : undefined
    }

    // Remove undefined values
    Object.keys(properties).forEach(key => properties[key] === undefined && delete properties[key])

    const result = await createPage(DATABASE_IDS.CLOSED_DEALS, properties)
    res.json({ success: true, data: formatPage(result) })
  } catch (error) {
    console.error('Error creating closed deal:', error)
    res.status(500).json({ error: 'Failed to create closed deal entry' })
  }
})

export default router
