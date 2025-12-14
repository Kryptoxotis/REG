import axios from 'axios'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_VERSION = '2022-06-28'

const DATABASE_IDS = {
  PROPERTIES: '2bb746b9-e0e8-8163-9afe-cf0c567c2586'
}

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

async function queryDatabase(databaseId) {
  try {
    let allResults = []
    let hasMore = true
    let startCursor = undefined
    let pageNum = 0
    const maxPages = 5 // Limit to prevent timeout

    while (hasMore && pageNum < maxPages) {
      pageNum++
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

export default async function handler(req, res) {
  try {
    // Fetch only from PROPERTIES database for Overview
    const propertiesRaw = await queryDatabase(DATABASE_IDS.PROPERTIES)
    const propertiesData = propertiesRaw.map(formatPage)

    console.log(`Fetched: PROPERTIES=${propertiesData.length}`)

    // Use properties as the source
    const allDeals = propertiesData

    // Office locations
    const offices = ['El Paso', 'Las Cruces', 'McAllen', 'San Antonio']

    // Status categories
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

      // Skip N/A values
      if (officeField && officeField !== 'N/A') {
        const of = officeField.toLowerCase()
        // Match Edwards Co. naming: "Edward's LLC." = El Paso, "Edward's NM." = Las Cruces, "Edward's RGV" = McAllen
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

    // Initialize office stats
    const officeStats = {}
    offices.forEach(office => {
      officeStats[office] = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0, deals: [] }
    })
    officeStats['Other'] = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0, deals: [] }

    // Process each deal
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

    // Calculate totals
    const totals = { active: 0, pending: 0, sold: 0, executed: 0, closes: 0, volume: 0 }
    for (const office of [...offices, 'Other']) {
      totals.active += officeStats[office].active
      totals.pending += officeStats[office].pending
      totals.sold += officeStats[office].sold
      totals.executed += officeStats[office].executed
      totals.closes += officeStats[office].closes
      totals.volume += officeStats[office].volume
    }

    res.status(200).json({
      offices: officeStats,
      totals,
      officeList: offices
    })
  } catch (error) {
    console.error('Error fetching office stats:', error.message)
    res.status(500).json({ error: 'Failed to fetch office stats', details: error.message })
  }
}
