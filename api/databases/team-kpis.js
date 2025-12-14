import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-811a-abaf-000bf8cf1640',
  PIPELINE: '2bb746b9-e0e8-815d-94e0-000bfd1091e1'
}

function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
}

// Get start and end of current month
function getCurrentMonthRange() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { startOfMonth, endOfMonth }
}

// Check if a date falls within current month
function isCurrentMonth(dateStr) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const { startOfMonth, endOfMonth } = getCurrentMonthRange()
  return date >= startOfMonth && date <= endOfMonth
}

async function queryDatabase(id) {
  const response = await axios.post(
    `https://api.notion.com/v1/databases/${id}/query`,
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

export default async function handler(req, res) {
  try {
    // Fetch team members and pipeline data
    const [teamMembers, pipeline] = await Promise.all([
      queryDatabase(DATABASE_IDS.TEAM_MEMBERS),
      queryDatabase(DATABASE_IDS.PIPELINE)
    ])

    // Build KPIs for each team member
    const teamKpis = teamMembers.map(member => {
      const memberId = member.id
      const name = extractPlainText(member.properties.Name?.title)
      // Field is "Stauts" (typo) and is status type, not select
      const status = member.properties.Stauts?.status?.name || 'Unknown'
      const role = member.properties.Role?.select?.name || ''
      const phone = member.properties.Phone?.phone_number || ''
      const email = member.properties['Email - ERA']?.email || ''

      // Find deals for this agent using Agent Relation (more reliable) or fallback to name match
      const agentDeals = pipeline.filter(deal => {
        // First try matching by relation
        const agentRelation = deal.properties['Agent Relation']?.relation || []
        if (agentRelation.some(rel => rel.id === memberId)) {
          return true
        }
        // Fallback to name matching
        const agentField = extractPlainText(deal.properties.Agent?.rich_text)
        return agentField && agentField.toLowerCase().includes(name.toLowerCase())
      })

      // Filter deals for current month based on Scheduled Closing or Closed Date
      const monthlyDeals = agentDeals.filter(d => {
        const scheduledClosing = d.properties['Scheduled Closing']?.date?.start
        const closedDate = d.properties['Closed Date']?.date?.start
        const executionDate = d.properties['Execution Date']?.date?.start
        // Include if any relevant date is in current month
        return isCurrentMonth(scheduledClosing) || isCurrentMonth(closedDate) || isCurrentMonth(executionDate)
      })

      // Calculate Monthly KPIs
      const totalDeals = monthlyDeals.length
      const closedDeals = monthlyDeals.filter(d => {
        const loanStatus = d.properties['Loan Status']?.select?.name || ''
        return loanStatus.toLowerCase().includes('funded') || loanStatus.toLowerCase().includes('closed')
      }).length
      const pendingDeals = monthlyDeals.filter(d => d.properties.Executed?.checkbox === false).length
      const executedDeals = monthlyDeals.filter(d => d.properties.Executed?.checkbox === true).length

      // Calculate monthly volume
      let totalVolume = 0
      let closedVolume = 0
      monthlyDeals.forEach(deal => {
        const price = deal.properties['Sales Price']?.number || 0
        totalVolume += price
        const loanStatus = deal.properties['Loan Status']?.select?.name || ''
        if (loanStatus.toLowerCase().includes('funded') || loanStatus.toLowerCase().includes('closed')) {
          closedVolume += price
        }
      })

      // Calculate average deal size
      const avgDealSize = totalDeals > 0 ? Math.round(totalVolume / totalDeals) : 0

      // All-time stats for context
      const allTimeDeals = agentDeals.length
      const allTimeClosed = agentDeals.filter(d => {
        const loanStatus = d.properties['Loan Status']?.select?.name || ''
        return loanStatus.toLowerCase().includes('funded') || loanStatus.toLowerCase().includes('closed')
      }).length

      // Format deal summaries for the frontend
      const formatDeal = (deal) => ({
        id: deal.id,
        address: extractPlainText(deal.properties.Address?.title),
        buyerName: extractPlainText(deal.properties['Buyer Name']?.rich_text),
        salesPrice: deal.properties['Sales Price']?.number || 0,
        loanStatus: deal.properties['Loan Status']?.select?.name || '',
        scheduledClosing: deal.properties['Scheduled Closing']?.date?.start || null,
        closedDate: deal.properties['Closed Date']?.date?.start || null,
        executed: deal.properties.Executed?.checkbox || false
      })

      // Categorize monthly deals
      const closedDealsList = monthlyDeals.filter(d => {
        const loanStatus = d.properties['Loan Status']?.select?.name || ''
        return loanStatus.toLowerCase().includes('funded') || loanStatus.toLowerCase().includes('closed')
      }).map(formatDeal)

      const pendingDealsList = monthlyDeals.filter(d => d.properties.Executed?.checkbox === false).map(formatDeal)
      const executedDealsList = monthlyDeals.filter(d => d.properties.Executed?.checkbox === true).map(formatDeal)

      return {
        id: member.id,
        name,
        status,
        role,
        phone,
        email,
        kpis: {
          // Monthly stats (primary)
          totalDeals,
          closedDeals,
          pendingDeals,
          executedDeals,
          totalVolume,
          closedVolume,
          avgDealSize,
          closingRate: totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0,
          // All-time stats (secondary)
          allTimeDeals,
          allTimeClosed
        },
        // Deal lists for drilling down
        deals: {
          all: monthlyDeals.map(formatDeal),
          closed: closedDealsList,
          pending: pendingDealsList,
          executed: executedDealsList
        }
      }
    })

    // Sort by total volume (top performers first)
    teamKpis.sort((a, b) => b.kpis.totalVolume - a.kpis.totalVolume)

    res.status(200).json(teamKpis)
  } catch (error) {
    console.error('Error:', error.message, error.response?.data)
    res.status(500).json({ error: 'Failed to fetch team KPIs', details: error.message })
  }
}
