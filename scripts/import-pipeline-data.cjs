const axios = require('axios');
const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2022-06-28';

// Pipeline database ID (already created)
const PIPELINE_DB_ID = '2bb746b9-e0e8-81f3-90c9-d2d317085a50';

const notionApi = axios.create({
  baseURL: 'https://api.notion.com/v1',
  headers: {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  }
});

// Helper to add page to database
async function addPage(databaseId, properties) {
  try {
    await notionApi.post('/pages', {
      parent: { database_id: databaseId },
      properties
    });
    return true;
  } catch (error) {
    console.error('Failed to add page:', error.response?.data?.message || error.message);
    return false;
  }
}

// Parse CSV line handling quoted commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  console.log('Importing Pipeline data...\n');

  const CSV_DIR = path.join(__dirname, '..', 'REG Sheets');
  const filepath = path.join(CSV_DIR, 'CMR_Pipeline-2025 - E.H. _ Pipeline (1).csv');

  // Read file content
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip empty first line (index 0), headers are at index 1, data starts at index 2
  // Header row columns by index:
  // 0: #, 1: Count, 2: SUB'D DATE, 3: Assist, 4: EXECUTED, 5: ASSISTING AGENT, 6: SALES PRICE, 7: ADDRESS (property)
  // 8: EXECUTED DATE, 9: MONTH, 10: YEAR, 11: SCHEDULED CLOSING, 12: CLOSED DATE, 13: LOAN STATUS
  // 14: AMMENDMENT TYPE, 15: EXTENSION DATE, 16: FLOORPLAN, 17: BUYER'S NAME, 18: PHONE NUMBER, 19: EMAIL
  // 20: ADDRESS (buyer), 21: City, 22: State, 23: Zip, 24: LOAN TYPE, 25: LOAN AMOUNT
  // 26: LO NAME, 27: LO MOBILE PHONE, 28: LO EMAIL, 29: MTG CO., 30: REALTOR PARTNER
  // 31: REALTOR NUMBER, 32: REALTOR EMAIL, 33: BROKER NAME, 34: NOTES

  console.log(`Found ${lines.length - 2} data rows`);

  let count = 0;
  let failed = 0;

  // Skip header rows (0 and 1), start at data (2)
  for (let i = 2; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);

    // Property address is at column index 7
    const address = cols[7];
    if (!address || address.trim() === '') continue;

    const parseNum = (val) => {
      if (!val) return null;
      const num = parseFloat(String(val).replace(/[$,]/g, ''));
      return isNaN(num) ? null : num;
    };

    const parseDate = (val) => {
      if (!val || val.trim() === '') return null;
      const parts = val.split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts;
        const year = y.length === 2 ? '20' + y : y;
        return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return null;
    };

    // Column mappings by index
    const assisting_agent = cols[5];
    const sales_price = cols[6];
    const executed_date = cols[8];
    const scheduled_closing = cols[11];
    const closed_date = cols[12];
    const loan_status_raw = cols[13];
    const buyer_name = cols[17];
    const phone_number = cols[18];
    const email = cols[19];
    const loan_type_raw = cols[24];
    const loan_amount = cols[25];
    const lo_name = cols[26];
    const lo_phone = cols[27];
    const lo_email = cols[28];
    const mtg_co = cols[29];
    const realtor_partner = cols[30];
    const realtor_number = cols[31];
    const realtor_email = cols[32];
    const broker_name = cols[33];
    const notes = cols[34];
    const executed = cols[4];

    // Map loan type
    let loanType = loan_type_raw;
    if (loanType) {
      const upper = loanType.toUpperCase();
      if (upper.includes('CONV')) loanType = 'Conventional';
      else if (upper === 'VA') loanType = 'VA';
      else if (upper === 'FHA') loanType = 'FHA';
      else if (upper === 'CASH') loanType = 'Cash';
      else if (upper.includes('NON-QM')) loanType = 'Non-QM';
    }

    // Map loan status
    let loanStatus = loan_status_raw;
    if (loanStatus) {
      if (loanStatus.includes('Back On Market')) loanStatus = 'Back On Market';
      else if (loanStatus.includes('Disclosures')) loanStatus = 'Disclosures Sent';
      else if (loanStatus.includes('Processing')) loanStatus = 'File in Processing';
      else if (loanStatus.includes('Conditions')) loanStatus = 'Conditions Submitted';
      else if (loanStatus.includes('Funded')) loanStatus = 'Funded';
      else if (loanStatus.includes('Closed')) loanStatus = 'Closed';
      else if (loanStatus === 'CASH') loanStatus = 'CASH';
      else if (loanStatus.includes('Application')) loanStatus = 'Loan Application Received';
    }

    const props = {
      'Address': { title: [{ text: { content: address } }] }
    };

    // Add buyer info
    if (buyer_name) {
      props['Buyer Name'] = { rich_text: [{ text: { content: buyer_name } }] };
    }
    if (phone_number) {
      props['Buyer Phone'] = { phone_number: phone_number };
    }
    if (email && email.includes('@')) {
      props['Buyer Email'] = { email: email };
    }

    // Add agent info
    if (assisting_agent) {
      props['Agent'] = { rich_text: [{ text: { content: assisting_agent } }] };
    }

    // Sales price
    const salesPrice = parseNum(sales_price);
    if (salesPrice) props['Sales Price'] = { number: salesPrice };

    // Executed checkbox
    props['Executed'] = { checkbox: executed === 'YES' };

    // Loan type
    if (loanType && ['FHA', 'VA', 'Conventional', 'Cash', 'Non-QM'].includes(loanType)) {
      props['Loan Type'] = { select: { name: loanType } };
    }

    // Loan amount
    const loanAmountNum = parseNum(loan_amount);
    if (loanAmountNum && loanAmountNum > 0) props['Loan Amount'] = { number: loanAmountNum };

    // Loan status
    if (loanStatus && ['Loan Application Received', 'Disclosures Sent', 'File in Processing', 'Conditions Submitted', 'Funded', 'Closed', 'Back On Market', 'CASH'].includes(loanStatus)) {
      props['Loan Status'] = { select: { name: loanStatus } };
    }

    // LO info
    if (lo_name && lo_name !== 'na') {
      props['LO Name'] = { rich_text: [{ text: { content: lo_name } }] };
    }
    if (lo_phone && lo_phone !== 'na') {
      props['LO Phone'] = { phone_number: lo_phone };
    }
    if (lo_email && lo_email !== 'na' && lo_email.includes('@')) {
      props['LO Email'] = { email: lo_email };
    }

    // Mortgage company
    if (mtg_co && mtg_co !== 'na') {
      props['Mortgage Company'] = { rich_text: [{ text: { content: mtg_co } }] };
    }

    // Realtor info
    if (realtor_partner) {
      props['Realtor Partner'] = { rich_text: [{ text: { content: realtor_partner } }] };
    }
    if (realtor_number) {
      props['Realtor Phone'] = { phone_number: realtor_number };
    }
    if (realtor_email && realtor_email.includes('@')) {
      props['Realtor Email'] = { email: realtor_email };
    }

    // Broker name
    if (broker_name) {
      props['Broker Name'] = { rich_text: [{ text: { content: broker_name } }] };
    }

    // Notes
    if (notes) {
      props['Notes'] = { rich_text: [{ text: { content: notes } }] };
    }

    // Dates
    const execDate = parseDate(executed_date);
    if (execDate) props['Execution Date'] = { date: { start: execDate } };

    const schedClose = parseDate(scheduled_closing);
    if (schedClose) props['Scheduled Closing'] = { date: { start: schedClose } };

    const closedDateParsed = parseDate(closed_date);
    if (closedDateParsed) props['Closed Date'] = { date: { start: closedDateParsed } };

    const success = await addPage(PIPELINE_DB_ID, props);
    if (success) {
      count++;
      process.stdout.write('.');
    } else {
      failed++;
      process.stdout.write('x');
    }
  }

  console.log(`\n\nImported ${count} pipeline deals (${failed} failed)`);
}

main();
