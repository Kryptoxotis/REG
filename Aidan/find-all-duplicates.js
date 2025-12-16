// Process the full Notion API response to find duplicate addresses
// This script handles the complete JSON from Notion API

const fs = require('fs');

// Read the response from stdin or a file
const processNotionResponse = (jsonData) => {
  const addresses = new Map();

  jsonData.results.forEach(page => {
    const addressTitle = page.properties?.Address?.title?.[0]?.plain_text;
    const pageId = page.id;

    if (addressTitle) {
      if (!addresses.has(addressTitle)) {
        addresses.set(addressTitle, []);
      }
      addresses.get(addressTitle).push(pageId);
    }
  });

  // Find duplicates
  const duplicates = [];
  addresses.forEach((pageIds, address) => {
    if (pageIds.length > 1) {
      duplicates.push({
        address,
        count: pageIds.length,
        pageIds
      });
    }
  });

  return {
    totalProperties: jsonData.results.length,
    duplicates,
    hasMore: jsonData.has_more,
    nextCursor: jsonData.next_cursor
  };
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { processNotionResponse };
}

// If running directly with data
if (require.main === module) {
  const inputData = JSON.parse(fs.readFileSync(process.argv[2] || 0, 'utf-8'));
  const result = processNotionResponse(inputData);
  console.log(JSON.stringify(result, null, 2));
}
