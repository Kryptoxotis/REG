import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5',
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50'
}

function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
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
      const name = extractPlainText(member.properties.Name?.title)
      const status = member.properties.Stauts?.select?.name || 'Unknown'
      const role = member.properties.Role?.select?.name || ''
      const phone = member.properties.Phone?.phone_number || ''
      const email = member.properties['Email - ERA']?.email || ''

      // Find deals for this agent (match by name in Agent field)
      const agentDeals = pipeline.filter(deal => {
        const agentField = extractPlainText(deal.properties.Agent?.rich_text)
        return agentField && agentField.toLowerCase().includes(name.toLowerCase())
      })

      // Calculate KPIs
      const totalDeals = agentDeals.length
      const closedDeals = agentDeals.filter(d => {
        const loanStatus = d.properties['Loan Status']?.select?.name || ''
        return loanStatus.toLowerCase().includes('funded') || loanStatus.toLowerCase().includes('closed')
      }).length
      const pendingDeals = agentDeals.filter(d => d.properties.Executed?.checkbox === false).length
      const executedDeals = agentDeals.filter(d => d.properties.Executed?.checkbox === true).length

      // Calculate volume
      let totalVolume = 0
      let closedVolume = 0
      agentDeals.forEach(deal => {
        const price = deal.properties['Sales Price']?.number || 0
        totalVolume += price
        const loanStatus = deal.properties['Loan Status']?.select?.name || ''
        if (loanStatus.toLowerCase().includes('funded') || loanStatus.toLowerCase().includes('closed')) {
          closedVolume += price
        }
      })

      // Calculate average deal size
      const avgDealSize = totalDeals > 0 ? Math.round(totalVolume / totalDeals) : 0

      // Get recent deals (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const recentDeals = agentDeals.filter(deal => {
        const createdTime = new Date(deal.created_time)
        return createdTime >= thirtyDaysAgo
      }).length

      return {
        id: member.id,
        name,
        status,
        role,
        phone,
        email,
        kpis: {
          totalDeals,
          closedDeals,
          pendingDeals,
          executedDeals,
          totalVolume,
          closedVolume,
          avgDealSize,
          recentDeals,
          closingRate: totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0
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
