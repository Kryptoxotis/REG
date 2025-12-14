import axios from 'axios'
import { DATABASE_IDS, NOTION_VERSION } from '../../config/databases.js'
import { handleCors } from '../../config/utils.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY

function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map(text => text.plain_text).join('')
}

function formatPage(page) {
  const properties = {}
  for (const [key, value] of Object.entries(page.properties)) {
    switch (value.type) {
      case 'title': properties[key] = extractPlainText(value.title); break
      case 'rich_text': properties[key] = extractPlainText(value.rich_text); break
      case 'number': properties[key] = value.number; break
      case 'select': properties[key] = value.select?.name || null; break
      case 'multi_select': properties[key] = value.multi_select.map(item => item.name); break
      case 'date': properties[key] = value.date; break
      case 'checkbox': properties[key] = value.checkbox; break
      default: properties[key] = value
    }
  }
  return { id: page.id, ...properties }
}

async function queryDatabaseSimple(id, filter = null) {
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

async function queryDatabasePaginated(databaseId) {
  try {
    let allResults = []
    let hasMore = true
    let startCursor = undefined

    while (hasMore) {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        { start_cursor: startCursor, page_size: 100 },
        {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          }
        }
      )
      allResults = allResults.concat(response.data.results)
      hasMore = response.data.has_more
      startCursor = response.data.next_cursor
    }
    return allResults
  } catch (error) {
    console.error(`Error querying ${databaseId}:`, error.message)
    return []
  }
}

// General stats handler
async function getGeneralStats() {
  const stats = {}

  const teamMembers = await queryDatabaseSimple(DATABASE_IDS.TEAM_MEMBERS)
  const activeMembers = teamMembers.filter(p => p.properties.Status?.select?.name === 'Active')
  stats.TEAM_MEMBERS = { count: teamMembers.length, active: activeMembers.length, name: 'team members' }

  const properties = await queryDatabaseSimple(DATABASE_IDS.PROPERTIES)
  const modelHomes = properties.filter(p => p.properties.Status?.select?.name === 'Model Home')
  const inventory = properties.filter(p => p.properties.Status?.select?.name === 'Inventory')
  stats.PROPERTIES = { count: properties.length, modelHomes: modelHomes.length, inventory: inventory.length, name: 'properties' }

  const pipeline = await queryDatabaseSimple(DATABASE_IDS.PIPELINE)
  const executed = pipeline.filter(p => p.properties.Executed?.checkbox === true)
  const pending = pipeline.filter(p => p.properties.Executed?.checkbox === false)
  let totalVolume = 0
  pipeline.forEach(p => {
    const price = p.properties['Sales Price']?.number
    if (price) totalVolume += price
  })
  stats.PIPELINE = { count: pipeline.length, executed: executed.length, pending: pending.length, totalVolume, name: 'pipeline deals' }

  const clients = await queryDatabaseSimple(DATABASE_IDS.CLIENTS)
  stats.CLIENTS = { count: clients.length, name: 'clients' }

  const schedule = await queryDatabaseSimple(DATABASE_IDS.SCHEDULE)
  const today = new Date().toISOString().split('T')[0]
  const upcoming = schedule.filter(p => {
    const date = p.properties.Date?.date?.start
    return date && date >= today
  })
  stats.SCHEDULE = { count: schedule.length, upcoming: upcoming.length, name: 'schedule entries' }

  return stats
}

// By-office stats handler
async function getByOfficeStats() {
  const propertiesRaw = await queryDatabasePaginated(DATABASE_IDS.PROPERTIES)
  const propertiesData = propertiesRaw.map(formatPage)
  const allDeals = propertiesData

  const offices = ['El Paso', 'Las Cruces', 'McAllen', 'San Antonio']
  const statusCategories = {
    active: ['active', 'new', 'prospect', 'in progress'],
    pending: ['pending', 'under contract', 'awaiting'],
    sold: ['sold', 'closed', 'completed', 'won'],
    executed: ['executed']
  }

  const getStatusCategory = (status) => {
    const s = (status || '').toLowerCase()
    for (const [category, keywords] of Object.entries(statusCategories)) {
      if (keywords.some(kw => s.includes(kw))) return category
    }
    return 'active'
  }

  const getVolume = (deal) => {
    const price = deal['Sales Price'] || deal['Final Sale Price'] || deal.Price || deal['Sale Price'] || 0
    return typeof price === 'number' ? price : parseFloat(price) || 0
  }

  const getOffice = (deal) => {
    const officeField = deal['Edwards Co.'] || deal['Edwards Co'] || deal.Office || deal.Market || deal.Location || ''
    const address = deal.Address || deal['Property Address'] || ''

    if (officeField && officeField !== 'N/A') {
      const of = officeField.toLowerCase()
      if (of.includes('llc') || of.includes('el paso') || of.includes('elpaso')) return 'El Paso'
      if (of.includes('nm') || of.includes('las cruces') || of.includes('cruces') || of.includes('new mexico')) return 'Las Cruces'
      if (of.includes('rgv') || of.includes('mcallen') || of.includes('mc allen')) return 'McAllen'
      if (of.includes('san antonio') || of.includes('sanantonio')) return 'San Antonio'
    }

    if (address) {
      const addr = address.toLowerCase()
      if (addr.includes('el paso')) return 'El Paso'
      if (addr.includes('las cruces') || addr.includes('new mexico') || addr.includes(', nm')) return 'Las Cruces'
      if (addr.includes('mcallen') || addr.includes('mission') || addr.includes('edinburg')) return 'McAllen'
      if (addr.includes('san antonio')) return 'San Antonio'
    }

    return 'Other'
  }

  const officeStats = {}
  offices.forEach(office => {
    officeStats[office] = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0, deals: [] }
  })
  officeStats['Other'] = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0, deals: [] }

  allDeals.forEach(deal => {
    const office = getOffice(deal)
    const status = deal.Status || deal['Loan Status'] || ''
    const category = getStatusCategory(status)
    const volume = getVolume(deal)
    const isExecuted = deal.Executed === true

    if (officeStats[office]) {
      officeStats[office][category]++
      officeStats[office].volume += volume
      if (isExecuted) officeStats[office].executed++
      if (category === 'sold') officeStats[office].closes++
    }
  })

  const totals = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0 }
  for (const office of [...offices, 'Other']) {
    totals.active += officeStats[office].active
    totals.pending += officeStats[office].pending
    totals.sold += officeStats[office].sold
    totals.executed += officeStats[office].executed
    totals.closes += officeStats[office].closes
    totals.volume += officeStats[office].volume
  }

  return { offices: officeStats, totals, officeList: offices }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  try {
    const { type } = req.query

    if (type === 'by-office') {
      const result = await getByOfficeStats()
      return res.status(200).json(result)
    }

    const stats = await getGeneralStats()
    res.status(200).json(stats)
  } catch (error) {
    console.error('Error:', error.message, error.response?.data)
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message, hasApiKey: !!NOTION_API_KEY })
  }
}
