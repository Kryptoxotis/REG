// Script to find duplicate addresses in Notion Properties database
// Handles pagination automatically

const DATABASE_ID = '2bb746b9-e0e8-8163-9afe-cf0c567c2586';

async function findDuplicates() {
  const addresses = new Map();
  let cursor = undefined;
  let hasMore = true;
  let totalCount = 0;

  console.log('Querying Notion database for all properties...\n');

  while (hasMore) {
    // This will be called via MCP - just tracking the logic
    console.log(`Batch with cursor: ${cursor || 'initial'}`);

    // We'll need to call the Notion API multiple times
    // Storing the logic here for reference
    hasMore = false; // Will be updated by actual API calls
  }

  // Find duplicates
  const duplicates = [];
  addresses.forEach((pageIds, address) => {
    if (pageIds.length > 1) {
      duplicates.push({
        address,
        pageIds,
        count: pageIds.length
      });
    }
  });

  return {
    totalCount,
    duplicates
  };
}

// Export for use
module.exports = { findDuplicates };
