import express from 'express'
import validator from 'validator'
import { queryDatabase, getDatabaseInfo, formatPage, DATABASE_IDS, updatePage, createPage, deletePage } from '../utils/notion.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = express.Router()

// In-memory cache for stats endpoint (60 second TTL)
const statsCache = { data: null, expires: 0 }

// Editable fields whitelist per database - server-side validation
// Only these fields can be updated via the API (prevents system field tampering)
const EDITABLE_FIELDS = {
  TEAM_MEMBERS: ['Phone', 'Email', 'Address', 'Notes', 'Name', 'Role', 'Status'],
  PIPELINE: ['Status', 'Agent', 'Notes', 'Scheduled Closing', 'Sales Price'],
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

    const results = await queryDatabase(databaseId)
    logger.info(`${upperKey}: fetched ${results.length} items`)
    const formatted = results.map(formatPage)

    res.json(formatted)
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
// Handles: move-to-pipeline, update-status, log-activity,
//          move-to-closed, send-back-to-properties
// ============================================================
router.post('/actions', requireAuth, async (req, res) => {
  try {
    const { action } = req.body

    switch (action) {
      case 'move-to-pipeline': {
        const {
          propertyId, address, salesPrice, edwardsCo, agent, buyerName,
          buyerEmail, buyerPhone, assistingAgent, brokerName, loName,
          loEmail, loPhone, loanAmount, loanType, realtorPartner,
          realtorEmail, realtorPhone, notes, closedDate, executeDate
        } = req.body

        // Validate required fields
        if (!propertyId || !address || !agent || !buyerName || !buyerEmail || !buyerPhone) {
          return res.status(400).json({
            error: 'Missing required fields',
            details: 'propertyId, address, agent, buyerName, buyerEmail, and buyerPhone are required'
          })
        }

        // Validate email format using validator.js
        if (!validator.isEmail(buyerEmail)) {
          return res.status(400).json({ error: 'Invalid buyer email format' })
        }
        if (loEmail && !validator.isEmail(loEmail)) {
          return res.status(400).json({ error: 'Invalid LO email format' })
        }
        if (realtorEmail && !validator.isEmail(realtorEmail)) {
          return res.status(400).json({ error: 'Invalid realtor email format' })
        }

        // Validate phone format - must have 10-15 digits with optional formatting
        const phoneDigits = buyerPhone.replace(/\D/g, '')
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
          return res.status(400).json({ error: 'Phone must have 10-15 digits' })
        }
        // Only allow digits and common phone formatting chars
        if (!/^[\d\s\-\(\)\+\.]+$/.test(buyerPhone)) {
          return res.status(400).json({ error: 'Invalid phone format - use digits, spaces, dashes, parentheses, or plus' })
        }

        // Create pipeline entry
        const pipelineProps = {
          'Address': { title: [{ text: { content: address } }] },
          'Sales Price': { number: parseFloat(salesPrice) || 0 },
          'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
          'Agent': { rich_text: [{ text: { content: agent } }] },
          'Buyer Name': { rich_text: [{ text: { content: buyerName } }] },
          'Buyer Email': { email: buyerEmail },
          'Buyer Phone': { phone_number: buyerPhone },
          'Assisting Agent': assistingAgent ? { rich_text: [{ text: { content: assistingAgent } }] } : undefined,
          'Broker Name': brokerName ? { rich_text: [{ text: { content: brokerName } }] } : undefined,
          'LO Name': loName ? { rich_text: [{ text: { content: loName } }] } : undefined,
          'LO Email': loEmail ? { email: loEmail } : undefined,
          'LO Phone': loPhone ? { phone_number: loPhone } : undefined,
          'Loan Amount': loanAmount ? { number: parseFloat(loanAmount) } : undefined,
          'Loan Type': loanType ? { select: { name: loanType } } : undefined,
          'Realtor Partner': realtorPartner ? { rich_text: [{ text: { content: realtorPartner } }] } : undefined,
          'Realtor Email': realtorEmail ? { email: realtorEmail } : undefined,
          'Realtor Phone': realtorPhone ? { phone_number: realtorPhone } : undefined,
          'Notes': notes ? { rich_text: [{ text: { content: notes } }] } : undefined,
          'Scheduled Closing': closedDate ? { date: { start: closedDate } } : undefined,
          'Execute Date': executeDate ? { date: { start: executeDate } } : undefined,
          'Loan Status': { select: { name: 'Loan Application Received' } },
          'Executed': { checkbox: true }
        }

        Object.keys(pipelineProps).forEach(key =>
          pipelineProps[key] === undefined && delete pipelineProps[key]
        )

        const result = await createPage(DATABASE_IDS.PIPELINE, pipelineProps)
        await deletePage(propertyId) // Archive from Properties

        return res.json({ success: true, data: formatPage(result) })
      }

      case 'update-status': {
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

      case 'log-activity': {
        const { logAction, dealAddress, oldStatus, newStatus, entityType, actionType } = req.body
        const user = req.session.user?.fullName || req.session.user?.email || 'Unknown'

        if (!logAction) {
          return res.status(400).json({ error: 'logAction required' })
        }

        // Server-side validation for entity and action types
        const ALLOWED_ENTITY_TYPES = ['Team Member', 'Property', 'Pipeline', 'Client', 'Schedule', 'System', 'Deal']
        const ALLOWED_ACTION_TYPES = ['View', 'Edit', 'Create', 'Delete', 'Login', 'Logout', 'Navigate', 'Move to Submitted', 'Move to Pending', 'Moved Stage', 'Sent Back to Properties']

        if (entityType && !ALLOWED_ENTITY_TYPES.includes(entityType)) {
          return res.status(400).json({ error: 'Invalid entity type' })
        }
        if (actionType && !ALLOWED_ACTION_TYPES.includes(actionType)) {
          return res.status(400).json({ error: 'Invalid action type' })
        }

        // Sanitize and limit string lengths
        const sanitize = (str, maxLen = 500) => {
          if (!str) return str
          return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').substring(0, maxLen).trim()
        }

        const properties = {
          'Action': { title: [{ text: { content: sanitize(logAction) } }] },
          'User': { rich_text: [{ text: { content: sanitize(user) } }] },
          'Deal Address': dealAddress ? { rich_text: [{ text: { content: sanitize(dealAddress) } }] } : undefined,
          'Old Status': oldStatus ? { rich_text: [{ text: { content: sanitize(oldStatus) } }] } : undefined,
          'New Status': newStatus ? { rich_text: [{ text: { content: sanitize(newStatus) } }] } : undefined,
          'Entity Type': entityType ? { rich_text: [{ text: { content: entityType } }] } : undefined,
          'Action Type': actionType ? { rich_text: [{ text: { content: actionType } }] } : undefined,
          'Date': { date: { start: new Date().toISOString() } }
        }

        Object.keys(properties).forEach(key =>
          properties[key] === undefined && delete properties[key]
        )

        const result = await createPage(DATABASE_IDS.ACTIVITY_LOG, properties)
        return res.json({ success: true, data: formatPage(result) })
      }

      case 'move-to-closed': {
        const { dealId, address, closeDate, finalSalePrice, agent, buyerName, commission, edwardsCo } = req.body

        if (!dealId || !address) {
          return res.status(400).json({ error: 'dealId and address required' })
        }

        const closedDealProps = {
          'Property Address': { title: [{ text: { content: address } }] },
          'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
          'Close Date': closeDate ? { date: { start: closeDate } } : undefined,
          'Final Sale Price': finalSalePrice ? { number: parseFloat(finalSalePrice) } : undefined,
          'Agent': agent ? { rich_text: [{ text: { content: agent } }] } : undefined,
          'Buyer Name': buyerName ? { rich_text: [{ text: { content: buyerName } }] } : undefined,
          'Commission': commission ? { number: parseFloat(commission) } : undefined
        }

        Object.keys(closedDealProps).forEach(key =>
          closedDealProps[key] === undefined && delete closedDealProps[key]
        )

        const result = await createPage(DATABASE_IDS.CLOSED_DEALS, closedDealProps)
        await deletePage(dealId) // Archive from Pipeline

        return res.json({ success: true, data: formatPage(result) })
      }

      case 'send-back-to-properties': {
        const { dealId, address, salesPrice, status, edwardsCo } = req.body

        if (!dealId || !address) {
          return res.status(400).json({ error: 'dealId and address required' })
        }

        const propertyProps = {
          'Address': { title: [{ text: { content: address } }] },
          'Edwards Co.': edwardsCo ? { select: { name: edwardsCo } } : undefined,
          'Price': salesPrice ? { number: parseFloat(salesPrice) } : undefined,
          'Status': status ? { select: { name: status } } : { select: { name: 'Available' } }
        }

        Object.keys(propertyProps).forEach(key =>
          propertyProps[key] === undefined && delete propertyProps[key]
        )

        const result = await createPage(DATABASE_IDS.PROPERTIES, propertyProps)
        await deletePage(dealId) // Archive from Pipeline

        return res.json({ success: true, data: formatPage(result) })
      }

      // ============================================================
      // PIPELINE RESTRUCTURE: Properties → Submitted → Pending → Closed
      // ============================================================

      case 'move-to-submitted': {
        // Properties → Submitted (first Pipeline stage)
        // Creates Pipeline record linked to Property, does NOT delete Property yet
        const { propertyId, address, salesPrice, foreman, subdivision, agentAssist, buyerName } = req.body

        if (!propertyId || !address) {
          return res.status(400).json({ error: 'propertyId and address required' })
        }
        if (!buyerName) {
          return res.status(400).json({ error: 'Buyer Name is required' })
        }

        // Create Pipeline record with status "Submitted" and link to Property
        const pipelineProps = {
          'Address': { title: [{ text: { content: address } }] },
          'Loan Status': { select: { name: 'Submitted' } },
          'Buyer Name': { rich_text: [{ text: { content: buyerName } }] },
          'Sales Price': salesPrice ? { number: parseFloat(salesPrice) } : undefined,
          'Foreman': foreman ? { rich_text: [{ text: { content: foreman } }] } : undefined,
          'Subdivision': subdivision ? { rich_text: [{ text: { content: subdivision } }] } : undefined,
          'Agent Assist': agentAssist ? { rich_text: [{ text: { content: agentAssist } }] } : undefined,
          // Store Property ID for dynamic address linking
          'Linked Property': { rich_text: [{ text: { content: propertyId } }] },
          'Address Locked': { checkbox: false }
        }

        Object.keys(pipelineProps).forEach(key =>
          pipelineProps[key] === undefined && delete pipelineProps[key]
        )

        const result = await createPage(DATABASE_IDS.PIPELINE, pipelineProps)
        // Do NOT delete Property - it stays linked until move to Pending

        return res.json({ success: true, data: formatPage(result) })
      }

      case 'move-to-pending': {
        // Submitted → Pending (full form, archives Property, locks address)
        const {
          dealId, propertyId,
          submittedBy, agentRole, streetAddress, city, state, zipCode,
          lot, block, subdivision, floorPlan,
          agent, buyerName, buyerEmail, buyerPhone,
          assistingAgent, brokerName, loName, loEmail, loPhone,
          loanAmount, loanType, realtorPartner, realtorEmail, realtorPhone, notes
        } = req.body

        if (!dealId) {
          return res.status(400).json({ error: 'dealId is required' })
        }

        // Validate required fields (replaces Tally form)
        const requiredFields = { agent, buyerName, buyerEmail, buyerPhone, streetAddress, city, state, zipCode, subdivision, floorPlan }
        const missingFields = Object.entries(requiredFields)
          .filter(([key, value]) => !value)
          .map(([key]) => key)

        if (missingFields.length > 0) {
          return res.status(400).json({
            error: 'Missing required fields',
            details: `Required: ${missingFields.join(', ')}`
          })
        }

        // Validate email format
        if (!validator.isEmail(buyerEmail)) {
          return res.status(400).json({ error: 'Invalid buyer email format' })
        }
        if (loEmail && !validator.isEmail(loEmail)) {
          return res.status(400).json({ error: 'Invalid LO email format' })
        }
        if (realtorEmail && !validator.isEmail(realtorEmail)) {
          return res.status(400).json({ error: 'Invalid realtor email format' })
        }

        // Validate phone format
        const phoneDigits = buyerPhone.replace(/\D/g, '')
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
          return res.status(400).json({ error: 'Phone must have 10-15 digits' })
        }

        // Build full address
        const fullAddress = streetAddress

        // Update Pipeline record with all form data and lock address
        const pipelineProps = {
          'Address': { title: [{ text: { content: fullAddress } }] },
          'Loan Status': { select: { name: 'Loan Application Received' } }, // Move to first Pending status
          'Submitted By': submittedBy ? { rich_text: [{ text: { content: submittedBy } }] } : undefined,
          'Agent Role': agentRole ? { rich_text: [{ text: { content: agentRole } }] } : undefined,
          'City': city ? { select: { name: city } } : undefined,
          'State': state ? { select: { name: state } } : undefined,
          'ZIP Code': zipCode ? { rich_text: [{ text: { content: zipCode } }] } : undefined,
          'Lot': lot ? { rich_text: [{ text: { content: lot } }] } : undefined,
          'Block': block ? { rich_text: [{ text: { content: block } }] } : undefined,
          'Subdivision': subdivision ? { rich_text: [{ text: { content: subdivision } }] } : undefined,
          'Floor Plan': floorPlan ? { rich_text: [{ text: { content: floorPlan } }] } : undefined,
          'Agent': { rich_text: [{ text: { content: agent } }] },
          'Buyer Name': { rich_text: [{ text: { content: buyerName } }] },
          'Buyer Email': { email: buyerEmail },
          'Buyer Phone': { phone_number: buyerPhone },
          'Assisting Agent': assistingAgent ? { rich_text: [{ text: { content: assistingAgent } }] } : undefined,
          'Broker Name': brokerName ? { rich_text: [{ text: { content: brokerName } }] } : undefined,
          'LO Name': loName ? { rich_text: [{ text: { content: loName } }] } : undefined,
          'LO Email': loEmail ? { email: loEmail } : undefined,
          'LO Phone': loPhone ? { phone_number: loPhone } : undefined,
          'Loan Amount': loanAmount ? { number: parseFloat(loanAmount) } : undefined,
          'Loan Type': loanType ? { select: { name: loanType } } : undefined,
          'Realtor Partner': realtorPartner ? { rich_text: [{ text: { content: realtorPartner } }] } : undefined,
          'Realtor Email': realtorEmail ? { email: realtorEmail } : undefined,
          'Realtor Phone': realtorPhone ? { phone_number: realtorPhone } : undefined,
          'Notes': notes ? { rich_text: [{ text: { content: notes } }] } : undefined,
          // Lock address and clear Property link
          'Address Locked': { checkbox: true },
          'Linked Property': { rich_text: [] }, // Clear the link
          'Executed': { checkbox: true }
        }

        Object.keys(pipelineProps).forEach(key =>
          pipelineProps[key] === undefined && delete pipelineProps[key]
        )

        // Update the Pipeline record
        const result = await updatePage(dealId, pipelineProps)

        // Delete the Property record (address is now locked on Pipeline)
        if (propertyId) {
          try {
            await deletePage(propertyId)
          } catch (deleteErr) {
            logger.warn('Could not delete linked property:', deleteErr.message)
            // Continue anyway - the Pipeline record is updated
          }
        }

        return res.json({ success: true, data: formatPage(result) })
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
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

    const pipelineDeal = await createPage(DATABASE_IDS.PIPELINE, pipelineProps)

    // Archive (delete) from Properties database
    await deletePage(pageId)

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

    const closedDeal = await createPage(DATABASE_IDS.CLOSED_DEALS, closedDealProps)

    // Archive (delete) from Pipeline database
    await deletePage(pageId)

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
