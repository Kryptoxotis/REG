const NOTION_API_KEY = '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';
const DATABASE_ID = '2bb746b9-e0e8-8163-9afe-cf0c567c2586';
const NOTION_VERSION = '2022-06-28';

async function getDatabaseSchema() {
  const url = `https://api.notion.com/v1/databases/${DATABASE_ID}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Error:', data);
    process.exit(1);
  }

  console.log('Database Title:', data.title[0]?.plain_text || 'Untitled');
  console.log('\nProperties:');

  for (const [name, prop] of Object.entries(data.properties)) {
    console.log(`  - "${name}" (${prop.type})`);
  }
}

getDatabaseSchema().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
