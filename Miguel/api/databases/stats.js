import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

// Main databases only (not virtual views)
const DATABASE_IDS = {
  TEAM_MEMBERS: '2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5',
  PROPERTIES: '2bb746b9-e0e8-8163-9afe-cf0c567c2586',
  PIPELINE: '2bb746b9-e0e8-81f3-90c9-d2d317085a50',
  CLIENTS: '2bb746b9-e0e8-8176-b5ed-dfe744fc0246',
  SCHEDULE: '2bb746b9-e0e8-810a-b85d-e1a517ca1349'
}

async function queryDatabase(id, filter = null) {
  const body = filter ? { filter } : {}
  const response = await axios.post(
    `https://api.notion.com/v1/databases/${id}/query`,
    body,
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
    const stats = {}

    // Team Members stats with breakdown
    const teamMembers = await queryDatabase(DATABASE_IDS.TEAM_MEMBERS)
    const activeMembers = teamMembers.filter(p =>
      p.properties.Status?.select?.name === 'Active'
    )
    stats.TEAM_MEMBERS = {
      count: teamMembers.length,
      active: activeMembers.length,
      name: 'team members'
    }

    // Properties stats with breakdown
    const properties = await queryDatabase(DATABASE_IDS.PROPERTIES)
    const modelHomes = properties.filter(p =>
      p.properties.Status?.select?.name === 'Model Home'
    )
    const inventory = properties.filter(p =>
      p.properties.Status?.select?.name === 'Inventory'
    )
    stats.PROPERTIES = {
      count: properties.length,
      modelHomes: modelHomes.length,
      inventory: inventory.length,
      name: 'properties'
    }

    // Pipeline stats with breakdown
    const pipeline = await queryDatabase(DATABASE_IDS.PIPELINE)
    const executed = pipeline.filter(p => p.properties.Executed?.checkbox === true)
    const pending = pipeline.filter(p => p.properties.Executed?.checkbox === false)
    let totalVolume = 0
    pipeline.forEach(p => {
      const price = p.properties['Sales Price']?.number
      if (price) totalVolume += price
    })
    stats.PIPELINE = {
      count: pipeline.length,
      executed: executed.length,
      pending: pending.length,
      totalVolume: totalVolume,
      name: 'pipeline deals'
    }

    // Clients stats
    const clients = await queryDatabase(DATABASE_IDS.CLIENTS)
    stats.CLIENTS = {
      count: clients.length,
      name: 'clients'
    }

    // Schedule stats with breakdown
    const schedule = await queryDatabase(DATABASE_IDS.SCHEDULE)
    const today = new Date().toISOString().split('T')[0]
    const upcoming = schedule.filter(p => {
      const date = p.properties.Date?.date?.start
      return date && date >= today
    })
    stats.SCHEDULE = {
      count: schedule.length,
      upcoming: upcoming.length,
      name: 'schedule entries'
    }

    res.status(200).json(stats)
  } catch (error) {
    console.error('Error:', error.message, error.response?.data)
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message, hasApiKey: !!NOTION_API_KEY })
  }
}
