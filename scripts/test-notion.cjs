const notionPackage = require('@notionhq/client');

console.log('Available exports:', Object.keys(notionPackage));
console.log('Client:', notionPackage.Client);

const { Client } = notionPackage;
const notion = new Client({ auth: 'test' });

console.log('Notion instance:', notion);
console.log('Notion methods:', Object.keys(notion));
console.log('Databases methods:', notion.databases ? Object.keys(notion.databases) : 'No databases');
