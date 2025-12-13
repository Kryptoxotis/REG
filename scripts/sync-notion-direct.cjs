const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = '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';
const DATABASE_ID = '2bb746b9-e0e8-8163-9afe-cf0c567c2586';
const NOTION_VERSION = '2022-06-28';

// Convert JSON property to Notion properties format
function buildNotionProperties(property) {
  const props = {};

  // Address (title) - exact name from database
  props['Address'] = {
    title: [{ text: { content: property.address } }]
  };

  // SqFt (number) - exact name from database
  if (property.sqft !== undefined && property.sqft !== null) {
    props['SqFt'] = { number: property.sqft };
  }

  // Floorplan (rich_text)
  if (property.plan) {
    props['Floorplan'] = {
      rich_text: [{ text: { content: String(property.plan) } }]
    };
  }

  // Subdivision (select) - is a select type
  if (property.subdivision) {
    props['Subdivision'] = {
      select: { name: String(property.subdivision) }
    };
  }

  // Lot (rich_text)
  if (property.lot) {
    props['Lot'] = {
      rich_text: [{ text: { content: String(property.lot) } }]
    };
  }

  // Block (rich_text)
  if (property.block) {
    props['Block'] = {
      rich_text: [{ text: { content: String(property.block) } }]
    };
  }

  // Stage (rich_text)
  if (property.foreman_stage) {
    props['Stage'] = {
      rich_text: [{ text: { content: String(property.foreman_stage) } }]
    };
  }

  // Stage Completion % (number)
  if (property.completion_pct !== undefined && property.completion_pct !== null) {
    props['Stage Completion %'] = { number: property.completion_pct };
  }

  // Status (select)
  if (property.status) {
    props['Status'] = { select: { name: String(property.status) } };
  }

  // Edwards Co. (rich_text) - is rich_text, not select
  if (property.edwards_co) {
    props['Edwards Co.'] = {
      rich_text: [{ text: { content: String(property.edwards_co) } }]
    };
  }

  // Sales Price (number)
  if (property.sale_price !== undefined && property.sale_price !== null) {
    props['Sales Price'] = { number: property.sale_price };
  }

  // Foreman (rich_text)
  if (property.foreman) {
    props['Foreman'] = {
      rich_text: [{ text: { content: String(property.foreman) } }]
    };
  }

  return props;
}

// Create a page in Notion
async function createNotionPage(property) {
  const url = 'https://api.notion.com/v1/pages';

  const body = {
    parent: { database_id: DATABASE_ID },
    properties: buildNotionProperties(property)
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        address: property.address,
        error: data.message || `HTTP ${response.status}`
      };
    }

    return { success: true, address: property.address, id: data.id };
  } catch (error) {
    return {
      success: false,
      address: property.address,
      error: error.message
    };
  }
}

// Process in batches
async function processBatch(items, batchSize = 10, delay = 500) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const allResults = [];

  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1}/${batches.length} (${batches[i].length} properties)...`);

    const batchResults = await Promise.all(
      batches[i].map(prop => createNotionPage(prop))
    );

    allResults.push(...batchResults);

    // Delay between batches (except after the last one)
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return allResults;
}

async function main() {
  console.log('Starting Notion property sync...\n');

  // Read JSON file
  const jsonPath = path.join(__dirname, 'properties_data.json');
  const properties = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`Loaded ${properties.length} properties from JSON\n`);

  // Process all properties
  const results = await processBatch(properties, 10, 500);

  // Calculate stats
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Output results
  console.log('\n=== SYNC COMPLETE ===\n');
  console.log(`Total properties processed: ${results.length}`);
  console.log(`Successfully synced: ${successful.length}`);
  console.log(`Failed: ${failed.length}\n`);

  // Show sample of synced properties
  if (successful.length > 0) {
    console.log('Sample of synced properties:');
    successful.slice(0, 10).forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.address} (ID: ${result.id})`);
    });
    if (successful.length > 10) {
      console.log(`  ... and ${successful.length - 10} more`);
    }
    console.log('');
  }

  // Show errors if any
  if (failed.length > 0) {
    console.log('Errors encountered:');
    failed.slice(0, 10).forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.address}: ${result.error}`);
    });
    if (failed.length > 10) {
      console.log(`  ... and ${failed.length - 10} more errors`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
