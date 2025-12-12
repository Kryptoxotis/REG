const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2022-06-28';

// Parent page ID - we need to get this from an existing page
let PARENT_PAGE_ID = null;

const notionApi = axios.create({
  baseURL: 'https://api.notion.com/v1',
  headers: {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  }
});

// CSV directory
const CSV_DIR = path.join(__dirname, '..', 'REG Sheets');

// Helper to parse CSV
function parseCSV(filename) {
  const filepath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(filepath, 'utf-8');
  return csv.parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
}

// Helper to create database
async function createDatabase(parentId, title, icon, properties) {
  try {
    const response = await notionApi.post('/databases', {
      parent: { type: 'page_id', page_id: parentId },
      icon: { type: 'emoji', emoji: icon },
      title: [{ type: 'text', text: { content: title } }],
      properties
    });
    console.log(`Created database: ${title} (${response.data.id})`);
    return response.data.id;
  } catch (error) {
    console.error(`Failed to create ${title}:`, error.response?.data || error.message);
    throw error;
  }
}

// Helper to add page to database
async function addPage(databaseId, properties) {
  try {
    await notionApi.post('/pages', {
      parent: { database_id: databaseId },
      properties
    });
  } catch (error) {
    console.error('Failed to add page:', error.response?.data?.message || error.message);
  }
}

// 1. TEAM MEMBERS Database
async function createTeamMembersDB(parentId) {
  const properties = {
    'Name': { title: {} },
    'Calendar ID': { rich_text: {} },
    'Role': {
      select: {
        options: [
          { name: 'Principal', color: 'purple' },
          { name: 'Captain', color: 'blue' },
          { name: 'Field Specialist', color: 'green' },
          { name: 'Developing Agent', color: 'yellow' },
          { name: 'Candidate', color: 'gray' }
        ]
      }
    },
    'Team': {
      select: {
        options: [
          { name: 'ERA/REG', color: 'blue' },
          { name: 'ERA/Gabby', color: 'purple' },
          { name: 'Diligent', color: 'green' },
          { name: 'HomeGuide', color: 'orange' }
        ]
      }
    },
    'Status': {
      select: {
        options: [
          { name: 'Active', color: 'green' },
          { name: 'Terminated', color: 'red' }
        ]
      }
    },
    'Phone': { phone_number: {} },
    'Email - ERA': { email: {} },
    'Email - Personal': { email: {} },
    'License Number': { rich_text: {} },
    'Experience Level': { rich_text: {} },
    'T-Shirt Size': {
      select: {
        options: [
          { name: 'XS', color: 'gray' },
          { name: 'S', color: 'gray' },
          { name: 'M', color: 'gray' },
          { name: 'L', color: 'gray' },
          { name: 'XL', color: 'gray' },
          { name: 'XXL', color: 'gray' },
          { name: 'XXXL', color: 'gray' }
        ]
      }
    },
    'Date of Birth': { date: {} },
    'Profile Photo URL': { url: {} },
    'Availability Days': {
      multi_select: {
        options: [
          { name: 'Monday', color: 'blue' },
          { name: 'Tuesday', color: 'green' },
          { name: 'Wednesday', color: 'yellow' },
          { name: 'Thursday', color: 'orange' },
          { name: 'Friday', color: 'red' },
          { name: 'Saturday', color: 'purple' },
          { name: 'Sunday', color: 'pink' }
        ]
      }
    },
    'Shift Preference': {
      select: {
        options: [
          { name: 'Full Shift', color: 'green' },
          { name: 'Open Shift', color: 'blue' },
          { name: 'Closing Shift', color: 'orange' },
          { name: 'No Preference', color: 'gray' }
        ]
      }
    }
  };

  const dbId = await createDatabase(parentId, 'Team Members', '🟢', properties);

  // Import data from Agent Directory
  const agents = parseCSV('Edwards Homes _ Principals l Gabby v2 - Agent Directory _ Role.csv');
  const roster = parseCSV('Edwards Homes _ Principals l Gabby v2 - Team Roster (1).csv');

  // Create a map of roster data by name for enrichment
  const rosterMap = {};
  roster.forEach(r => {
    const name = r['Name'] || r['  👤 Full Name '];
    if (name) rosterMap[name.trim()] = r;
  });

  const seen = new Set();

  for (const agent of agents) {
    const name = agent['Name'] || agent['Full Name'];
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const rosterData = rosterMap[name] || {};

    // Map team values
    let team = agent['Team'] || '';
    if (team.includes('REG')) team = 'ERA/REG';
    else if (team.includes('Gabby')) team = 'ERA/Gabby';
    else if (team.includes('Diligent')) team = 'Diligent';
    else if (team.includes('HomeGuide')) team = 'HomeGuide';
    else team = null;

    // Map role
    let role = agent['Role'] || '';
    if (role.includes('Principal')) role = 'Principal';
    else if (role.includes('Captain')) role = 'Captain';
    else if (role.includes('Field Specialist') || role.includes('Specialist')) role = 'Field Specialist';
    else if (role.includes('Developing')) role = 'Developing Agent';
    else if (role.includes('Candidate')) role = 'Candidate';
    else role = null;

    const props = {
      'Name': { title: [{ text: { content: name } }] },
      'Calendar ID': { rich_text: [{ text: { content: agent['Calendar ID'] || '' } }] },
      'Status': agent['Status'] ? { select: { name: agent['Status'] } } : undefined,
      'Phone': rosterData['  📱 Phone Number'] ? { phone_number: rosterData['  📱 Phone Number'] } : undefined,
      'Email - ERA': rosterData['  💼 ERA Email (if assigned)'] ? { email: rosterData['  💼 ERA Email (if assigned)'] } : undefined,
      'Email - Personal': rosterData['  📧 Personal Email Address'] ? { email: rosterData['  📧 Personal Email Address'] } : undefined,
      'License Number': rosterData['  🪪 Real Estate License Number (if applicable)'] ? { rich_text: [{ text: { content: rosterData['  🪪 Real Estate License Number (if applicable)'] } }] } : undefined,
      'Profile Photo URL': rosterData['  📸 Upload or Update Your Profile Photo'] ? { url: rosterData['  📸 Upload or Update Your Profile Photo'] } : undefined
    };

    if (team) props['Team'] = { select: { name: team } };
    if (role) props['Role'] = { select: { name: role } };

    // Clean undefined values
    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);

    await addPage(dbId, props);
    process.stdout.write('.');
  }
  console.log(`\nImported ${seen.size} team members`);
  return dbId;
}

// 2. PROPERTIES Database
async function createPropertiesDB(parentId) {
  const properties = {
    'Address': { title: {} },
    'Subdivision': {
      select: {
        options: [
          { name: 'TDE 91', color: 'blue' },
          { name: 'Garden Park', color: 'green' },
          { name: 'Summer Sky', color: 'yellow' },
          { name: 'Paseos U9', color: 'orange' },
          { name: 'Painted Desert', color: 'red' },
          { name: 'Campos Del Sol', color: 'purple' },
          { name: 'Horizon', color: 'pink' },
          { name: 'Painted Sky', color: 'brown' },
          { name: 'Tierra Del Norte', color: 'gray' },
          { name: 'Metro Verde Arcadia', color: 'default' }
        ]
      }
    },
    'Lot': { rich_text: {} },
    'Block': { rich_text: {} },
    'Floorplan': { rich_text: {} },
    'Story': { number: {} },
    'Bedrooms': { number: {} },
    'Bathrooms': { number: {} },
    'SqFt': { number: { format: 'number_with_commas' } },
    'Sales Price': { number: { format: 'dollar' } },
    'Status': {
      select: {
        options: [
          { name: 'Available', color: 'green' },
          { name: 'Pending', color: 'yellow' },
          { name: 'Sold', color: 'red' },
          { name: 'Model Home', color: 'purple' }
        ]
      }
    },
    'Stage': { rich_text: {} },
    'Stage Completion %': { number: { format: 'percent' } },
    'Promo': { rich_text: {} },
    'HOA': { rich_text: {} },
    'Lowest Payment': { number: { format: 'dollar' } },
    'Highest Payment': { number: { format: 'dollar' } },
    'Ready In': { rich_text: {} },
    'Color Code': { rich_text: {} },
    'Foreman': { rich_text: {} }
  };

  const dbId = await createDatabase(parentId, 'Properties', '🔵', properties);

  // Import from TDE 91
  const tde91 = parseCSV('E.H_TeamSheet- Availability - TDE 91.csv');

  const seen = new Set();
  let count = 0;

  for (const prop of tde91) {
    const address = prop['Address'];
    if (!address || seen.has(address)) continue;
    seen.add(address);

    const parseNum = (val) => {
      if (!val) return null;
      const num = parseFloat(String(val).replace(/[$,]/g, ''));
      return isNaN(num) ? null : num;
    };

    const parsePercent = (val) => {
      if (!val) return null;
      const num = parseFloat(String(val).replace('%', ''));
      return isNaN(num) ? null : num / 100;
    };

    const props = {
      'Address': { title: [{ text: { content: address } }] },
      'Subdivision': { select: { name: 'TDE 91' } },
      'Floorplan': prop['Floorplan'] ? { rich_text: [{ text: { content: prop['Floorplan'] } }] } : undefined,
      'Story': prop['Story'] ? { number: parseInt(prop['Story']) || null } : undefined,
      'Bedrooms': prop['Bed'] ? { number: parseInt(prop['Bed']) || null } : undefined,
      'Bathrooms': prop['Bath'] ? { number: parseInt(prop['Bath']) || null } : undefined,
      'SqFt': { number: parseNum(prop['SQ FT']) },
      'Sales Price': { number: parseNum(prop['Sales Price']) },
      'Status': prop['Status'] ? { select: { name: prop['Status'] } } : undefined,
      'Stage': prop['Stage'] ? { rich_text: [{ text: { content: prop['Stage'] } }] } : undefined,
      'Stage Completion %': { number: parsePercent(prop['Percentage']) },
      'Promo': prop['Promo'] ? { rich_text: [{ text: { content: prop['Promo'] } }] } : undefined,
      'HOA': prop['HOA'] ? { rich_text: [{ text: { content: prop['HOA'] } }] } : undefined,
      'Lowest Payment': { number: parseNum(prop['Lowest Payment']) },
      'Highest Payment': { number: parseNum(prop['Highest Payment']) },
      'Color Code': prop['Color Code'] ? { rich_text: [{ text: { content: prop['Color Code'] } }] } : undefined
    };

    Object.keys(props).forEach(k => {
      if (props[k] === undefined || props[k].number === null) delete props[k];
    });

    await addPage(dbId, props);
    count++;
    process.stdout.write('.');
  }

  console.log(`\nImported ${count} properties from TDE 91`);
  return dbId;
}

// 3. PIPELINE Database
async function createPipelineDB(parentId) {
  const properties = {
    'Address': { title: {} },
    'Buyer Name': { rich_text: {} },
    'Buyer Phone': { phone_number: {} },
    'Buyer Email': { email: {} },
    'Agent': { rich_text: {} },
    'Assisting Agent': { rich_text: {} },
    'Sales Price': { number: { format: 'dollar' } },
    'Submitted Date': { date: {} },
    'Executed': { checkbox: {} },
    'Execution Date': { date: {} },
    'Scheduled Closing': { date: {} },
    'Closed Date': { date: {} },
    'Loan Type': {
      select: {
        options: [
          { name: 'FHA', color: 'blue' },
          { name: 'VA', color: 'green' },
          { name: 'Conventional', color: 'purple' },
          { name: 'Cash', color: 'yellow' },
          { name: 'Non-QM', color: 'orange' }
        ]
      }
    },
    'Loan Amount': { number: { format: 'dollar' } },
    'Loan Status': {
      select: {
        options: [
          { name: 'Loan Application Received', color: 'gray' },
          { name: 'Disclosures Sent', color: 'blue' },
          { name: 'File in Processing', color: 'yellow' },
          { name: 'Conditions Submitted', color: 'orange' },
          { name: 'Funded', color: 'green' },
          { name: 'Closed', color: 'green' },
          { name: 'Back On Market', color: 'red' },
          { name: 'CASH', color: 'purple' }
        ]
      }
    },
    'LO Name': { rich_text: {} },
    'LO Phone': { phone_number: {} },
    'LO Email': { email: {} },
    'Mortgage Company': { rich_text: {} },
    'Realtor Partner': { rich_text: {} },
    'Realtor Phone': { phone_number: {} },
    'Realtor Email': { email: {} },
    'Broker Name': { rich_text: {} },
    'Notes': { rich_text: {} }
  };

  const dbId = await createDatabase(parentId, 'Pipeline', '🟡', properties);

  const pipeline = parseCSV('CMR_Pipeline-2025 - E.H. _ Pipeline (1).csv');

  let count = 0;
  for (const deal of pipeline) {
    const address = deal['ADDRESS'];
    if (!address || address.trim() === '') continue;

    const parseNum = (val) => {
      if (!val) return null;
      const num = parseFloat(String(val).replace(/[$,]/g, ''));
      return isNaN(num) ? null : num;
    };

    const parseDate = (val) => {
      if (!val || val.trim() === '') return null;
      // Try to parse date
      const parts = val.split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts;
        const year = y.length === 2 ? '20' + y : y;
        return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return null;
    };

    // Map loan type
    let loanType = deal['LOAN TYPE'];
    if (loanType) {
      if (loanType.toUpperCase().includes('CONV')) loanType = 'Conventional';
      else if (loanType.toUpperCase() === 'VA') loanType = 'VA';
      else if (loanType.toUpperCase() === 'FHA') loanType = 'FHA';
      else if (loanType.toUpperCase() === 'CASH') loanType = 'Cash';
      else if (loanType.toUpperCase().includes('NON-QM')) loanType = 'Non-QM';
    }

    const props = {
      'Address': { title: [{ text: { content: address } }] },
      'Buyer Name': deal["BUYER'S NAME"] ? { rich_text: [{ text: { content: deal["BUYER'S NAME"] } }] } : undefined,
      'Buyer Phone': deal['PHONE NUMBER'] ? { phone_number: deal['PHONE NUMBER'] } : undefined,
      'Buyer Email': deal['EMAIL'] ? { email: deal['EMAIL'] } : undefined,
      'Agent': deal['ASSISTING AGENT'] ? { rich_text: [{ text: { content: deal['ASSISTING AGENT'] } }] } : undefined,
      'Sales Price': { number: parseNum(deal[' SALES PRICE']) },
      'Executed': { checkbox: deal['EXECUTED'] === 'YES' },
      'Loan Type': loanType ? { select: { name: loanType } } : undefined,
      'Loan Amount': { number: parseNum(deal['LOAN AMOUNT']) },
      'Loan Status': deal['LOAN STATUS'] ? { select: { name: deal['LOAN STATUS'] } } : undefined,
      'LO Name': deal['LO NAME'] ? { rich_text: [{ text: { content: deal['LO NAME'] } }] } : undefined,
      'LO Phone': deal['LO MOBILE PHONE'] ? { phone_number: deal['LO MOBILE PHONE'] } : undefined,
      'LO Email': deal['LO EMAIL'] ? { email: deal['LO EMAIL'] } : undefined,
      'Mortgage Company': deal['MTG CO.'] ? { rich_text: [{ text: { content: deal['MTG CO.'] } }] } : undefined,
      'Realtor Partner': deal['REALTOR PARTNER'] ? { rich_text: [{ text: { content: deal['REALTOR PARTNER'] } }] } : undefined,
      'Realtor Phone': deal['REALTOR NUMBER'] ? { phone_number: deal['REALTOR NUMBER'] } : undefined,
      'Realtor Email': deal['REALTOR EMAIL'] ? { email: deal['REALTOR EMAIL'] } : undefined,
      'Broker Name': deal['BROKER NAME'] ? { rich_text: [{ text: { content: deal['BROKER NAME'] } }] } : undefined,
      'Notes': deal['NOTES'] ? { rich_text: [{ text: { content: deal['NOTES'] } }] } : undefined
    };

    // Parse dates
    const execDate = parseDate(deal['EXECUTED DATE']);
    if (execDate) props['Execution Date'] = { date: { start: execDate } };

    const schedClose = parseDate(deal['SCHEDULED CLOSING']);
    if (schedClose) props['Scheduled Closing'] = { date: { start: schedClose } };

    const closedDate = parseDate(deal['CLOSED DATE']);
    if (closedDate) props['Closed Date'] = { date: { start: closedDate } };

    Object.keys(props).forEach(k => {
      if (props[k] === undefined || props[k].number === null) delete props[k];
    });

    await addPage(dbId, props);
    count++;
    process.stdout.write('.');
  }

  console.log(`\nImported ${count} pipeline deals`);
  return dbId;
}

// 4. CLIENTS Database
async function createClientsDB(parentId) {
  const properties = {
    'Property Address': { title: {} },
    'Full Name': { rich_text: {} },
    'Phone': { phone_number: {} },
    'Email': { email: {} },
    'Contact Preference': {
      select: {
        options: [
          { name: 'Call', color: 'blue' },
          { name: 'Text', color: 'green' },
          { name: 'Email', color: 'purple' }
        ]
      }
    },
    'Property Type': {
      select: {
        options: [
          { name: 'Single-Family', color: 'blue' },
          { name: 'Condo', color: 'green' },
          { name: 'Townhouse', color: 'yellow' }
        ]
      }
    },
    'Status': {
      select: {
        options: [
          { name: 'Active', color: 'green' },
          { name: 'Coming Soon', color: 'blue' },
          { name: 'Pre-List', color: 'yellow' },
          { name: 'Home Preview', color: 'orange' },
          { name: 'Off Market', color: 'red' },
          { name: 'Undecided', color: 'gray' }
        ]
      }
    },
    'Square Footage': { number: {} },
    'Bedrooms': { number: {} },
    'Bathrooms': { number: {} },
    'Year Built': { number: {} },
    'Garage Details': { rich_text: {} },
    'Lot Size': { rich_text: {} },
    'Motivation': { rich_text: {} },
    'Motivation Level': { number: {} },
    'Timeline': { rich_text: {} },
    'Has Mortgage': { checkbox: {} },
    'Amount Owed': { number: { format: 'dollar' } },
    'Target List Price': { number: { format: 'dollar' } },
    'RPR Value': { number: { format: 'dollar' } },
    'CAD Value': { number: { format: 'dollar' } },
    'Cloud CMA Value': { number: { format: 'dollar' } },
    'Additional Notes': { rich_text: {} }
  };

  const dbId = await createDatabase(parentId, 'Clients', '💗', properties);

  const clients = parseCSV('New Seller Inquiry Form - Client Link - Submission Responses (1).csv');

  let count = 0;
  for (const client of clients) {
    const address = client['Property Address'] || client['Street Address'];
    if (!address || address.trim() === '') continue;

    const parseNum = (val) => {
      if (!val) return null;
      const num = parseFloat(String(val).replace(/[$,]/g, ''));
      return isNaN(num) ? null : num;
    };

    const props = {
      'Property Address': { title: [{ text: { content: address } }] },
      'Full Name': client['Full Name'] ? { rich_text: [{ text: { content: client['Full Name'] } }] } : undefined,
      'Phone': client['Primary Phone Number'] ? { phone_number: client['Primary Phone Number'] } : undefined,
      'Email': client['Email Address'] ? { email: client['Email Address'] } : undefined,
      'Contact Preference': client['Preferred Contact'] ? { select: { name: client['Preferred Contact'] } } : undefined,
      'Property Type': client['Type of Property'] ? { select: { name: client['Type of Property'] } } : undefined,
      'Status': client['Status'] ? { select: { name: client['Status'] } } : undefined,
      'Square Footage': { number: parseNum(client['Square Footage']) },
      'Bedrooms': { number: parseNum(client['Bedrooms']) },
      'Bathrooms': { number: parseNum(client['Bathrooms']) },
      'Year Built': { number: parseNum(client['Year Built']) },
      'Garage Details': client['Garage / Parking Details'] ? { rich_text: [{ text: { content: client['Garage / Parking Details'] } }] } : undefined,
      'Lot Size': client['Lot Size'] ? { rich_text: [{ text: { content: client['Lot Size'] } }] } : undefined,
      'Motivation': client["What's motivating you to sell your home?"] ? { rich_text: [{ text: { content: client["What's motivating you to sell your home?"] } }] } : undefined,
      'Motivation Level': { number: parseNum(client['How motivated are you to sell right now?']) },
      'Timeline': client['When would you ideally like to move?'] ? { rich_text: [{ text: { content: client['When would you ideally like to move?'] } }] } : undefined,
      'Has Mortgage': { checkbox: client['Do you currently have a mortgage?'] === 'Yes' },
      'Amount Owed': { number: parseNum(client['If yes, approximately how much is still owed?']) },
      'Target List Price': { number: parseNum(client["Do you have an idea of the price you'd like to list at?"]) },
      'RPR Value': { number: parseNum(client['RPR Value']) },
      'CAD Value': { number: parseNum(client['CAD Value']) },
      'Cloud CMA Value': { number: parseNum(client['Cloud CMA Value']) }
    };

    Object.keys(props).forEach(k => {
      if (props[k] === undefined || props[k].number === null) delete props[k];
    });

    await addPage(dbId, props);
    count++;
    process.stdout.write('.');
  }

  console.log(`\nImported ${count} clients`);
  return dbId;
}

// 5. SCHEDULE Database
async function createScheduleDB(parentId) {
  const properties = {
    'Date': { title: {} },
    'Model Home Address': { rich_text: {} },
    'Assigned Staff 1': { rich_text: {} },
    'Assigned Staff 2': { rich_text: {} }
  };

  const dbId = await createDatabase(parentId, 'Schedule', '🟣', properties);

  const schedule = parseCSV('Monthly Schedule v2 - Schedule.csv');

  let count = 0;
  const seen = new Set();

  for (const entry of schedule) {
    const date = entry['Date'];
    const modelHome = entry['Model Home'];
    if (!date || !modelHome) continue;

    const key = `${date}-${modelHome}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const props = {
      'Date': { title: [{ text: { content: `${date} - ${modelHome}` } }] },
      'Model Home Address': { rich_text: [{ text: { content: modelHome } }] },
      'Assigned Staff 1': entry['Assigned Staff 1'] ? { rich_text: [{ text: { content: entry['Assigned Staff 1'] } }] } : undefined,
      'Assigned Staff 2': entry['Assigned Staff 2'] ? { rich_text: [{ text: { content: entry['Assigned Staff 2'] } }] } : undefined
    };

    Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);

    await addPage(dbId, props);
    count++;
    process.stdout.write('.');
  }

  console.log(`\nImported ${count} schedule entries`);
  return dbId;
}

// Main function
async function main() {
  console.log('Starting Notion database creation...\n');

  // First, we need to find a parent page to create databases in
  // Let's search for existing pages
  try {
    const searchResult = await notionApi.post('/search', {
      filter: { property: 'object', value: 'page' },
      page_size: 10
    });

    if (searchResult.data.results.length === 0) {
      console.error('No pages found. Please create a page in Notion first and share it with the integration.');
      return;
    }

    // Use the first available page as parent
    PARENT_PAGE_ID = searchResult.data.results[0].id;
    console.log(`Using parent page: ${PARENT_PAGE_ID}\n`);

    // Previously created databases (skip these):
    // Team Members: 2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5
    // Properties: 2bb746b9-e0e8-8163-9afe-cf0c567c2586
    // Pipeline: 2bb746b9-e0e8-81f3-90c9-d2d317085a50

    // Only create remaining databases
    console.log('=== Creating Clients Database ===');
    const clientsId = await createClientsDB(PARENT_PAGE_ID);

    console.log('\n=== Creating Schedule Database ===');
    const scheduleId = await createScheduleDB(PARENT_PAGE_ID);

    console.log('\n\n=== SUMMARY ===');
    console.log('Created databases:');
    console.log(`  Team Members: 2bb746b9-e0e8-815b-a4de-d2d5aa5ef4e5 (previously created)`);
    console.log(`  Properties: 2bb746b9-e0e8-8163-9afe-cf0c567c2586 (previously created)`);
    console.log(`  Pipeline: 2bb746b9-e0e8-81f3-90c9-d2d317085a50 (previously created)`);
    console.log(`  Clients: ${clientsId}`);
    console.log(`  Schedule: ${scheduleId}`);
    console.log('\nDone!');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
