import express from 'express'
import validator from 'validator'
import { queryDatabase, getDatabaseInfo, formatPage, DATABASE_IDS, updatePage, createPage, deletePage } from '../utils/notion.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import { actionHandlers } from './handlers/index.js'

const router = express.Router()

// Notion page ID validation (UUID format with or without hyphens)
function isValidPageId(pageId) {
  if (!pageId || typeof pageId !== 'string') return false
  // UUID with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // UUID without hyphens: 32 hex characters
  const uuidWithHyphens = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const uuidWithoutHyphens = /^[0-9a-f]{32}$/i
  return uuidWithHyphens.test(pageId) || uuidWithoutHyphens.test(pageId)
}

// In-memory cache for stats endpoint (60 second TTL)
const statsCache = { data: null, expires: 0 }

// Editable fields whitelist per database - server-side validation
// Only these fields can be updated via the API (prevents system field tampering)
const EDITABLE_FIELDS = {
  TEAM_MEMBERS: ['Phone', 'Email', 'Address', 'Notes', 'Name', 'Role', 'Status'],
  PIPELINE: ['Status', 'Agent', 'Notes', 'Scheduled Closing', 'Sales Price', 'Closed Date'],
  PROPERTIES: ['Status', 'Notes', 'Price', 'Address'],
  CLIENTS: ['Name', 'Email', 'Phone', 'Notes', 'Status'],
  SCHEDULE: ['Date', 'Time', 'Notes', 'Status', 'Attendees'],
  CLOSED_DEALS: ['Notes'], // Very limited editing on closed deals
  ACTIVITY_LOG: [] // No editing allowed
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
    logger.error('Error fetching database info:', error)
    res.status(500).json({ error: 'Failed to fetch database info' })
  }
})

// Get team KPIs with aggregated pipeline data - MUST come before /:databaseKey route
router.get('/team-kpis', requireAuth, async (req, res) => {
  try {
    // Pagination params with sensible defaults
    const limit = Math.min(parseInt(req.query.limit) || 50, 100) // Max 100
    const offset = parseInt(req.query.offset) || 0

    // Fetch team members
    const allTeamMembers = await queryDatabase(DATABASE_IDS.TEAM_MEMBERS)
    const total = allTeamMembers.length

    // Apply pagination to team members
    const teamMembers = allTeamMembers.slice(offset, offset + limit)

    // Fetch pipeline data
    const pipelineData = await queryDatabase(DATABASE_IDS.PIPELINE)

    // Pre-process pipeline data: format once and index by agent name (O(m) instead of O(n*m))
    const formattedPipelineDeals = pipelineData.map(deal => formatPage(deal))
    const pipelineByAgent = new Map()

    for (const deal of formattedPipelineDeals) {
      const agent = (deal.Agent || deal.agent || '').toLowerCase().trim()
      if (agent) {
        if (!pipelineByAgent.has(agent)) {
          pipelineByAgent.set(agent, [])
        }
        pipelineByAgent.get(agent).push(deal)
      }
    }

    // Process each team member and calculate their KPIs
    const teamKPIs = teamMembers.map(member => {
      const formatted = formatPage(member)
      const memberName = formatted.Name || formatted.name || ''
      const memberNameLower = memberName.toLowerCase().trim()

      // Find all pipeline deals for this team member using pre-built index
      // Check exact match first, then partial matches
      let memberDeals = pipelineByAgent.get(memberNameLower) || []

      // Also check for partial matches (agent name contains member name or vice versa)
      if (memberNameLower) {
        for (const [agentName, deals] of pipelineByAgent.entries()) {
          if (agentName !== memberNameLower &&
              (agentName.includes(memberNameLower) || memberNameLower.includes(agentName))) {
            memberDeals = [...memberDeals, ...deals]
          }
        }
      }

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

    // Return paginated response
    res.json({
      data: teamKPIs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    logger.error('Error fetching team KPIs:', error)
    res.status(500).json({ error: 'Failed to fetch team KPIs' })
  }
})

// Get overview stats (for dashboard) - MUST come before /:databaseKey route
router.get('/stats', requireAuth, async (req, res) => {
  try {
    // Check cache first (60 second TTL)
    if (statsCache.data && statsCache.expires > Date.now()) {
      return res.json(statsCache.data)
    }

    const stats = {}

    // Get counts from each database
    for (const [key, id] of Object.entries(DATABASE_IDS)) {
      const results = await queryDatabase(id)
      stats[key] = {
        count: results.length,
        name: key.replace(/_/g, ' ').toLowerCase()
      }
    }

    // Update cache
    statsCache.data = stats
    statsCache.expires = Date.now() + 60000 // 60 second TTL

    res.json(stats)
  } catch (error) {
    logger.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Get stats grouped by office location - MUST come before /:databaseKey route
router.get('/stats/by-office', requireAuth, async (req, res) => {
  try {
    // Fetch from all relevant databases with individual error handling
    // Limit to 5 pages (500 items) per database to prevent timeout
    const results = await Promise.allSettled([
      queryDatabase(DATABASE_IDS.PROPERTIES, {}, [], 5),
      queryDatabase(DATABASE_IDS.PIPELINE, {}, [], 5),
      queryDatabase(DATABASE_IDS.CLOSED_DEALS, {}, [], 5)
    ])

    // Log which databases succeeded/failed
    const dbNames = ['PROPERTIES', 'PIPELINE', 'CLOSED_DEALS']
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        logger.error(`Failed to fetch ${dbNames[i]}:`, result.reason?.message || result.reason)
      } else {
        logger.info(`${dbNames[i]}: ${result.value.length} items`)
      }
    })

    // Extract successful results (use empty array for failures)
    const propertiesData = results[0].status === 'fulfilled' ? results[0].value : []
    const pipelineData = results[1].status === 'fulfilled' ? results[1].value : []
    const closedData = results[2].status === 'fulfilled' ? results[2].value : []

    // Combine all deals
    const allDeals = [
      ...propertiesData.map(formatPage),
      ...pipelineData.map(formatPage),
      ...closedData.map(formatPage)
    ]
    const formattedPipeline = allDeals

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
      const price = deal['Sales Price'] || deal['Final Sale Price'] || deal.Price || deal.price ||
                    deal['Sale Price'] || deal['Contract Price'] || deal.Volume || 0
      return typeof price === 'number' ? price : parseFloat(price) || 0
    }

    // Helper to detect office from deal data
    const getOffice = (deal) => {
      // Check common field names for office/market/location including Edwards Co
      const officeField = deal['Edwards Co'] || deal['Edwards Co.'] || deal.Office || deal.office ||
                          deal.Market || deal.market || deal.Location || deal.location ||
                          deal.City || deal.city || ''
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
    logger.error('Error fetching office stats:', error)
    res.status(500).json({ error: 'Failed to fetch office stats' })
  }
})

// Get data from a specific database
router.get('/:databaseKey', requireAuth, async (req, res) => {
  try {
    const { databaseKey } = req.params
    const upperKey = databaseKey.toUpperCase()
    const databaseId = DATABASE_IDS[upperKey]

    logger.info(`Fetching database: ${upperKey}, ID: ${databaseId}`)

    if (!databaseId) {
      logger.error(`Database not found: ${upperKey}`)
      return res.status(404).json({ error: `Database not found: ${databaseKey}` })
    }

    // Pagination params with sensible defaults
    const limit = Math.min(parseInt(req.query.limit) || 100, 500) // Default 100, max 500
    const offset = parseInt(req.query.offset) || 0

    const allResults = await queryDatabase(databaseId)
    const total = allResults.length

    // Apply pagination
    const paginatedResults = allResults.slice(offset, offset + limit)
    logger.info(`${upperKey}: fetched ${paginatedResults.length} of ${total} items (offset: ${offset}, limit: ${limit})`)
    const formatted = paginatedResults.map(formatPage)

    res.json({
      data: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    logger.error(`Error fetching ${databaseKey}:`, error.message)
    res.status(500).json({ error: `Failed to fetch ${databaseKey}: ${error.message}` })
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
    logger.error('Error fetching raw data:', error)
    res.status(500).json({ error: 'Failed to fetch raw data' })
  }
})

// Update a record in Notion
router.put('/:databaseKey/:pageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { databaseKey, pageId } = req.params
    const { properties } = req.body

    // Validate pageId format
    if (!isValidPageId(pageId)) {
      return res.status(400).json({ error: 'Invalid page ID format' })
    }

    if (!properties) {
      return res.status(400).json({ error: 'Properties required' })
    }

    // Server-side field validation - only allow whitelisted fields
    const allowedFields = EDITABLE_FIELDS[databaseKey.toUpperCase()] || []
    if (allowedFields.length === 0) {
      return res.status(403).json({ error: 'Editing not allowed for this database' })
    }

    // Filter properties to only include allowed fields
    const sanitizedProperties = {}
    const blockedFields = []
    for (const [key, value] of Object.entries(properties)) {
      if (allowedFields.includes(key)) {
        sanitizedProperties[key] = value
      } else {
        blockedFields.push(key)
      }
    }

    if (blockedFields.length > 0) {
      logger.warn(`Blocked field update attempt: ${blockedFields.join(', ')} in ${databaseKey}`)
    }

    if (Object.keys(sanitizedProperties).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const result = await updatePage(pageId, sanitizedProperties)
    res.json({ success: true, data: formatPage(result) })
  } catch (error) {
    logger.error('Error updating page:', error)
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
    logger.error('Error creating page:', error)
    res.status(500).json({ error: 'Failed to create record' })
  }
})

// Delete (archive) a record in Notion
router.delete('/:databaseKey/:pageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { pageId } = req.params

    // Validate pageId format
    if (!isValidPageId(pageId)) {
      return res.status(400).json({ error: 'Invalid page ID format' })
    }

    await deletePage(pageId)
    res.json({ success: true, message: 'Record archived' })
  } catch (error) {
    logger.error('Error deleting page:', error)
    res.status(500).json({ error: 'Failed to delete record' })
  }
})

// Update pipeline deal status (for drag-drop - any authenticated user)
router.patch('/pipeline/:pageId/status', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.params
    const { loanStatus } = req.body

    // Validate pageId format
    if (!isValidPageId(pageId)) {
      return res.status(400).json({ error: 'Invalid page ID format' })
    }

    if (!loanStatus) {
      return res.status(400).json({ error: 'loanStatus required' })
    }

    const properties = {
      'Loan Status': { select: { name: loanStatus } }
    }

    const result = await updatePage(pageId, properties)
    res.json({ success: true, data: formatPage(result) })
  } catch (error) {
    logger.error('Error updating deal status:', error)
    res.status(500).json({ error: 'Failed to update deal status' })
  }
})

// Create activity log entry
router.post('/activity-log', requireAuth, async (req, res) => {
  try {
    const { action, dealAddress, oldStatus, newStatus, notes } = req.body
    const user = req.session.user?.name || req.session.user?.email || 'Unknown'

    if (!action) {
      return res.status(400).json({ error: 'Action required' })
    }

    const properties = {
      'Action': { title: [{ text: { content: action } }] },
      'User': { rich_text: [{ text: { content: user } }] },
      'Deal Address': dealAddress ? { rich_text: [{ text: { content: dealAddress } }] } : undefined,
      'Old Status': oldStatus ? { rich_text: [{ text: { content: oldStatus } }] } : undefined,
      'New Status': newStatus ? { rich_text: [{ text: { content: newStatus } }] } : undefined,
      'Date': { date: { start: new Date().toISOString() } },
      'Notes': notes ? { rich_text: [{ text: { content: notes } }] } : undefined
    }

    // Remove undefined values
    Object.keys(properties).forEach(key => properties[key] === undefined && delete properties[key])

    const result = await createPage(DATABASE_IDS.ACTIVITY_LOG, properties)
    res.json({ success: true, data: formatPage(result) })
  } catch (error) {
    logger.error('Error creating activity log:', error)
    res.status(500).json({ error: 'Failed to create activity log entry' })
  }
})

// ============================================================
// CONSOLIDATED ACTIONS ENDPOINT
// Handlers split into separate files in ./handlers/
// ============================================================
router.post('/actions', requireAuth, async (req, res) => {
  try {
    const { action } = req.body
    const handler = actionHandlers[action]

    if (!handler) {
      return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    await handler(req, res)
  } catch (error) {
    logger.error(`Action ${req.body.action} failed:`, error)
    res.status(500).json({
      error: 'Action failed',
      details: error.message
    })
  }
})

// Move property from Properties to Pipeline (when closed date is set)
router.post('/properties/:pageId/move-to-pipeline', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.params
    const { address, closedDate, executeDate, edwardsCo, salesPrice, agent, buyerName, loanStatus } = req.body

    // Validate pageId format
    if (!isValidPageId(pageId)) {
      return res.status(400).json({ error: 'Invalid page ID format' })
    }

    if (!address) {
      return res.status(400).json({ error: 'Address required' })
    }

    // Create in Pipeline database
    const pipelineProps = {
      'Address': { title: [{ text: { content: address } }] },
      'Scheduled Closing': closedDate ? { date: { start: closedDate } } : undefined,
      'Execute Date': executeDate ? { date: { start: executeDate } } : undefined,
      'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
      'Sales Price': salesPrice ? { number: salesPrice } : undefined,
      'Agent': agent ? { rich_text: [{ text: { content: agent } }] } : undefined,
      'Buyer Name': buyerName ? { rich_text: [{ text: { content: buyerName } }] } : undefined,
      'Loan Status': { select: { name: loanStatus || 'Loan Application Received' } },
      'Executed': { checkbox: true }
    }
    Object.keys(pipelineProps).forEach(key => pipelineProps[key] === undefined && delete pipelineProps[key])

    // Create pipeline entry first
    let pipelineDeal
    try {
      pipelineDeal = await createPage(DATABASE_IDS.PIPELINE, pipelineProps)
    } catch (createErr) {
      logger.error('Failed to create pipeline entry:', { error: createErr.message, pageId, address })
      return res.status(500).json({ error: 'Failed to create pipeline entry', details: createErr.message })
    }

    // Only delete property if create succeeded
    try {
      await deletePage(pageId)
    } catch (deleteErr) {
      logger.error('CRITICAL: Failed to delete property after pipeline creation. Duplicate exists!', {
        propertyId: pageId,
        newPipelineId: pipelineDeal.id,
        address,
        error: deleteErr.message
      })
      return res.json({
        success: true,
        pipelineDeal: formatPage(pipelineDeal),
        warning: 'Property was not archived. Please manually remove to avoid duplicates.',
        requiresManualCleanup: true,
        duplicatePropertyId: pageId
      })
    }

    res.json({ success: true, pipelineDeal: formatPage(pipelineDeal) })
  } catch (error) {
    logger.error('Error moving property to pipeline:', error)
    res.status(500).json({ error: 'Failed to move property to pipeline' })
  }
})

// Move deal from Pipeline to Closed Deals (create in Closed + archive from Pipeline)
router.post('/pipeline/:pageId/move-to-closed', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.params
    const { address, edwardsCo, closeDate, finalSalePrice, agent, buyerName, commission } = req.body

    // Validate pageId format
    if (!isValidPageId(pageId)) {
      return res.status(400).json({ error: 'Invalid page ID format' })
    }

    if (!address) {
      return res.status(400).json({ error: 'Address required' })
    }

    // Create in Closed Deals database
    const closedDealProps = {
      'Property Address': { title: [{ text: { content: address } }] },
      'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
      'Close Date': closeDate ? { date: { start: closeDate } } : undefined,
      'Final Sale Price': finalSalePrice ? { number: finalSalePrice } : undefined,
      'Agent': agent ? { rich_text: [{ text: { content: agent } }] } : undefined,
      'Buyer Name': buyerName ? { rich_text: [{ text: { content: buyerName } }] } : undefined,
      'Commission': commission ? { number: commission } : undefined
    }
    Object.keys(closedDealProps).forEach(key => closedDealProps[key] === undefined && delete closedDealProps[key])

    // Create closed deal entry first
    let closedDeal
    try {
      closedDeal = await createPage(DATABASE_IDS.CLOSED_DEALS, closedDealProps)
    } catch (createErr) {
      logger.error('Failed to create closed deal entry:', { error: createErr.message, pageId, address })
      return res.status(500).json({ error: 'Failed to create closed deal entry', details: createErr.message })
    }

    // Only delete from pipeline if create succeeded
    try {
      await deletePage(pageId)
    } catch (deleteErr) {
      logger.error('CRITICAL: Failed to delete deal after closing. Duplicate exists!', {
        dealId: pageId,
        newClosedDealId: closedDeal.id,
        address,
        error: deleteErr.message
      })
      return res.json({
        success: true,
        closedDeal: formatPage(closedDeal),
        warning: 'Deal was not archived from Pipeline. Please manually remove to avoid duplicates.',
        requiresManualCleanup: true,
        duplicateDealId: pageId
      })
    }

    res.json({ success: true, closedDeal: formatPage(closedDeal) })
  } catch (error) {
    logger.error('Error moving deal to closed:', error)
    res.status(500).json({ error: 'Failed to move deal to closed' })
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
    logger.error('Error creating closed deal:', error)
    res.status(500).json({ error: 'Failed to create closed deal entry' })
  }
})

export default router
