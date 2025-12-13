const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const PROPERTIES_DB_ID = '2bb746b9-e0e8-8163-9afe-cf0c567c2586';

// Fetch all existing properties from Notion with pagination
async function fetchAllProperties(notion) {
  console.log('Fetching all existing properties from Notion...');
  const properties = new Map(); // address -> page_id
  let hasMore = true;
  let cursor = undefined;

  while (hasMore) {
    const response = await notion.dataSources.query({
      database_id: PROPERTIES_DB_ID,
      start_cursor: cursor,
      page_size: 100
    });

    for (const page of response.results) {
      const addressProp = page.properties['Property Address'];
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

// Convert JSON property to Notion properties
function jsonToNotionProps(property) {
  const props = {};

  // Property Address (title)
  if (!property.address) return null;

  props['Property Address'] = {
    title: [{ text: { content: property.address } }]
  };

  // Sq. Ft. (number)
  if (property.sqft !== undefined && property.sqft !== null) {
    props['Sq. Ft.'] = { number: property.sqft };
  }

  // Floorplan (text)
  if (property.plan) {
    props['Floorplan'] = { rich_text: [{ text: { content: String(property.plan) } }] };
  }

  // Subdivision (text)
  if (property.subdivision) {
    props['Subdivision'] = { rich_text: [{ text: { content: String(property.subdivision) } }] };
  }

  // Lot (text)
  if (property.lot) {
    props['Lot'] = { rich_text: [{ text: { content: String(property.lot) } }] };
  }

  // Block (text)
  if (property.block) {
    props['Block'] = { rich_text: [{ text: { content: String(property.block) } }] };
  }

  // Stage (text)
  if (property.foreman_stage) {
    props['Stage'] = { rich_text: [{ text: { content: String(property.foreman_stage) } }] };
  }

  // Stage Completion % (number)
  if (property.completion_pct !== undefined && property.completion_pct !== null) {
    props['Stage Completion %'] = { number: property.completion_pct };
  }

  // Status (select)
  if (property.status) {
    props['Status'] = { select: { name: String(property.status) } };
  }

  // Edwards Co. (select) - Note: changed to select based on user instruction
  if (property.edwards_co) {
    props['Edwards Co.'] = { select: { name: String(property.edwards_co) } };
  }

  // Sales Price (number)
  if (property.sale_price !== undefined && property.sale_price !== null) {
    props['Sales Price'] = { number: property.sale_price };
  }

  // Foreman (text)
  if (property.foreman) {
    props['Foreman'] = { rich_text: [{ text: { content: String(property.foreman) } }] };
  }

  return { address: property.address, props };
}

// Update existing property
async function updateProperty(notion, pageId, props, address) {
  try {
    // Remove the Property Address title from props for updates
    const updateProps = { ...props };
    delete updateProps['Property Address'];

    await notion.pages.update({
      page_id: pageId,
      properties: updateProps
    });
    return { success: true, address };
  } catch (error) {
    return { success: false, address, error: error.message };
  }
}

// Create new property
async function createProperty(notion, props, address) {
  try {
    await notion.pages.create({
      parent: { database_id: PROPERTIES_DB_ID },
      properties: props
    });
    return { success: true, address };
  } catch (error) {
    return { success: false, address, error: error.message };
  }
}

// Process in batches with delay
async function processBatch(items, processor, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results = [];
  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length} (${batches[i].length} items)...`);
    const batchResults = await Promise.all(batches[i].map(processor));
    results.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

async function main() {
  console.log('Starting property sync from JSON...\n');

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  if (!NOTION_API_KEY) {
    console.error('ERROR: NOTION_API_KEY environment variable not set!');
    process.exit(1);
  }

  // Initialize Notion client
  const notion = new Client({ auth: NOTION_API_KEY });

  // Step 1: Fetch existing properties
  const existingProperties = await fetchAllProperties(notion);

  // Step 2: Read JSON file
  const jsonPath = path.join(__dirname, 'properties_data.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Found ${jsonData.length} properties in JSON file\n`);

  // Step 3: Process each property
  const updates = [];
  const creates = [];
  let skipped = 0;

  for (const property of jsonData) {
    const result = jsonToNotionProps(property);
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

  console.log(`Processing summary:`);
  console.log(`- ${updates.length} properties to update`);
  console.log(`- ${creates.length} properties to create`);
  console.log(`- ${skipped} rows skipped (no address)\n`);

  const errors = [];
  const sampleUpdates = [];
  const sampleCreates = [];

  // Step 4: Process updates
  if (updates.length > 0) {
    console.log('Updating existing properties...');
    const updateResults = await processBatch(
      updates,
      item => updateProperty(notion, item.pageId, item.props, item.address)
    );

    const succeeded = updateResults.filter(r => r.success);
    const failed = updateResults.filter(r => !r.success);

    console.log(`Updated: ${succeeded.length} succeeded, ${failed.length} failed\n`);

    errors.push(...failed);
    sampleUpdates.push(...succeeded.slice(0, 5).map(r => r.address));
  }

  // Step 5: Process creates
  if (creates.length > 0) {
    console.log('Creating new properties...');
    const createResults = await processBatch(
      creates,
      item => createProperty(notion, item.props, item.address)
    );

    const succeeded = createResults.filter(r => r.success);
    const failed = createResults.filter(r => !r.success);

    console.log(`Created: ${succeeded.length} succeeded, ${failed.length} failed\n`);

    errors.push(...failed);
    sampleCreates.push(...succeeded.slice(0, 5).map(r => r.address));
  }

  // Final summary
  console.log('=== SYNC COMPLETE ===');
  console.log(`\nTotal synced: ${updates.length + creates.length - errors.length}`);
  console.log(`- Updated: ${updates.length - errors.filter(e => updates.some(u => u.address === e.address)).length}`);
  console.log(`- Created: ${creates.length - errors.filter(e => creates.some(c => c.address === e.address)).length}`);
  console.log(`- Errors: ${errors.length}`);

  if (sampleUpdates.length > 0) {
    console.log(`\nSample updated properties:`);
    sampleUpdates.forEach(addr => console.log(`  - ${addr}`));
  }

  if (sampleCreates.length > 0) {
    console.log(`\nSample created properties:`);
    sampleCreates.forEach(addr => console.log(`  - ${addr}`));
  }

  if (errors.length > 0) {
    console.log(`\nErrors encountered:`);
    errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.address}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
