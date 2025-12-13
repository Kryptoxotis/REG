const { Client } = require('@notionhq/client');
const XLSX = require('xlsx');
const path = require('path');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const PROPERTIES_DB_ID = '2bb746b9-e0e8-8163-9afe-cf0c567c2586';

const notion = new Client({ auth: NOTION_API_KEY });

// Fetch all existing properties from Notion with pagination
async function fetchAllProperties() {
  console.log('Fetching all existing properties from Notion...');
  const properties = new Map(); // address -> page_id
  let hasMore = true;
  let cursor = undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: PROPERTIES_DB_ID,
      start_cursor: cursor,
      page_size: 100
    });

    for (const page of response.results) {
      const addressProp = page.properties['Address'];
      if (addressProp && addressProp.title && addressProp.title.length > 0) {
        const address = addressProp.title[0].plain_text;
        properties.set(address, page.id);
      }
    }

    hasMore = response.has_more;
    cursor = response.next_cursor;
  }

  console.log(`Found ${properties.size} existing properties in Notion\n`);
  return properties;
}

// Read Excel file
function readExcelFile(filePath) {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} rows in Excel\n`);
  return data;
}

// Convert Excel row to Notion properties
function excelRowToNotionProps(row) {
  const props = {};

  // Address (title) - combine Stnum + Stname
  const address = `${row['Stnum'] || ''} ${row['Stname'] || ''}`.trim();
  if (!address) return null;

  props['Address'] = {
    title: [{ text: { content: address } }]
  };

  // SqFt (number)
  if (row['Sq. Ft.'] !== undefined && row['Sq. Ft.'] !== null && row['Sq. Ft.'] !== '') {
    const sqft = parseFloat(String(row['Sq. Ft.']).replace(/,/g, ''));
    if (!isNaN(sqft)) {
      props['SqFt'] = { number: sqft };
    }
  }

  // Floorplan (text)
  if (row['Plan']) {
    props['Floorplan'] = { rich_text: [{ text: { content: String(row['Plan']) } }] };
  }

  // Subdivision (select)
  if (row['Subdivision']) {
    props['Subdivision'] = { select: { name: String(row['Subdivision']) } };
  }

  // Lot (text)
  if (row['Lot']) {
    props['Lot'] = { rich_text: [{ text: { content: String(row['Lot']) } }] };
  }

  // Block (text)
  if (row['Block']) {
    props['Block'] = { rich_text: [{ text: { content: String(row['Block']) } }] };
  }

  // Stage (text)
  if (row['Foreman Stage']) {
    props['Stage'] = { rich_text: [{ text: { content: String(row['Foreman Stage']) } }] };
  }

  // Stage Completion % (number) - remove % sign
  if (row['Stage Completion Percentage'] !== undefined && row['Stage Completion Percentage'] !== null && row['Stage Completion Percentage'] !== '') {
    const percentage = parseFloat(String(row['Stage Completion Percentage']).replace(/%/g, ''));
    if (!isNaN(percentage)) {
      props['Stage Completion %'] = { number: percentage };
    }
  }

  // Status (select)
  if (row['Sold/Available']) {
    props['Status'] = { select: { name: String(row['Sold/Available']) } };
  }

  // Edwards Co. (text)
  if (row['Edwards Co.']) {
    props['Edwards Co.'] = { rich_text: [{ text: { content: String(row['Edwards Co.']) } }] };
  }

  // Sales Price (number)
  if (row['SP'] !== undefined && row['SP'] !== null && row['SP'] !== '') {
    const salesPrice = parseFloat(String(row['SP']).replace(/[$,]/g, ''));
    if (!isNaN(salesPrice)) {
      props['Sales Price'] = { number: salesPrice };
    }
  }

  // Foreman (text)
  if (row['Foreman']) {
    props['Foreman'] = { rich_text: [{ text: { content: String(row['Foreman']) } }] };
  }

  return { address, props };
}

// Update existing property
async function updateProperty(pageId, props, address) {
  try {
    // Remove the Address title from props for updates (can't update title in patch)
    const updateProps = { ...props };
    delete updateProps['Address'];

    await notion.pages.update({
      page_id: pageId,
      properties: updateProps
    });
    return true;
  } catch (error) {
    console.error(`Failed to update ${address}:`, error.message);
    return false;
  }
}

// Create new property
async function createProperty(props, address) {
  try {
    await notion.pages.create({
      parent: { database_id: PROPERTIES_DB_ID },
      properties: props
    });
    return true;
  } catch (error) {
    console.error(`Failed to create ${address}:`, error.message);
    return false;
  }
}

// Process in batches with delay
async function processBatch(items, processor, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length}...`);
    const results = await Promise.all(batches[i].map(processor));
    const success = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;
    totalSuccess += success;
    totalFailed += failed;

    // Small delay between batches to avoid rate limits
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { success: totalSuccess, failed: totalFailed };
}

async function main() {
  console.log('Starting property sync...\n');

  // Step 1: Fetch existing properties
  const existingProperties = await fetchAllProperties();

  // Step 2: Read Excel file
  const excelPath = path.join(__dirname, '..', 'REG Sheets', 'Status Report 12.3.2025.xlsx');
  const excelData = readExcelFile(excelPath);

  // Step 3: Process each row
  const updates = [];
  const creates = [];
  let skipped = 0;

  for (const row of excelData) {
    const result = excelRowToNotionProps(row);
    if (!result) {
      skipped++;
      continue;
    }

    const { address, props } = result;

    if (existingProperties.has(address)) {
      updates.push({ pageId: existingProperties.get(address), props, address });
    } else {
      creates.push({ props, address });
    }
  }

  console.log(`\nProcessing summary:`);
  console.log(`- ${updates.length} properties to update`);
  console.log(`- ${creates.length} properties to create`);
  console.log(`- ${skipped} rows skipped (no address)\n`);

  // Step 4: Process updates
  if (updates.length > 0) {
    console.log('Updating existing properties...');
    const updateResults = await processBatch(
      updates,
      item => updateProperty(item.pageId, item.props, item.address)
    );
    console.log(`Updated: ${updateResults.success} succeeded, ${updateResults.failed} failed\n`);
  }

  // Step 5: Process creates
  if (creates.length > 0) {
    console.log('Creating new properties...');
    const createResults = await processBatch(
      creates,
      item => createProperty(item.props, item.address)
    );
    console.log(`Created: ${createResults.success} succeeded, ${createResults.failed} failed\n`);
  }

  console.log('Sync complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
