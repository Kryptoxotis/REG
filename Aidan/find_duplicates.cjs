const https = require('https');

const NOTION_TOKEN = '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';
const DATABASE_ID = '2bb746b9e0e881639afecf0c567c2586';

let allResults = [];
let hasMore = true;
let startCursor = undefined;

async function queryDatabase(cursor) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      page_size: 100,
      start_cursor: cursor
    });

    const options = {
      hostname: 'api.notion.com',
      path: '/v1/databases/' + DATABASE_ID + '/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error('Status: ' + res.statusCode + ', Body: ' + body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getAllPages() {
  while (hasMore) {
    const response = await queryDatabase(startCursor);
    allResults = allResults.concat(response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor;
  }

  const addressMap = new Map();

  allResults.forEach(page => {
    const addressProp = page.properties.Address;
    let address = '';

    if (addressProp && addressProp.title && addressProp.title.length > 0) {
      address = addressProp.title[0].plain_text;
    }

    if (address) {
      if (!addressMap.has(address)) {
        addressMap.set(address, []);
      }
      addressMap.get(address).push(page.id);
    }
  });

  const duplicates = [];
  addressMap.forEach((pageIds, address) => {
    if (pageIds.length > 1) {
      duplicates.push({ address, pageIds });
    }
  });

  console.log('Total properties:', allResults.length);
  console.log('\nDuplicate addresses found:', duplicates.length);
  console.log('\nDetails:');
  duplicates.forEach(dup => {
    console.log('\nAddress:', dup.address);
    dup.pageIds.forEach((id, idx) => {
      console.log('  Page', idx + 1 + ':', id);
    });
  });
}

getAllPages().catch(console.error);
