const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/components/DatabaseViewer.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Fix 1: PropertyCard - use cardFields
if (content.includes('// Fields to show (from list preferences, excluding primary and status)')) {
  content = content.replace(
    '// Fields to show (from list preferences, excluding primary and status)\n  const displayFields = config.secondaryFields?.filter(f => f !== config.primaryField && f !== config.statusField) || []',
    '// Fields to show (from card preferences, fallback to secondaryFields)\n  const displayFields = (config.cardFields || config.secondaryFields)?.filter(f => f !== config.primaryField && f !== config.statusField) || []'
  );
  changes++;
  console.log('Fixed PropertyCard');
}

// Fix 2: SmartCardView - use cardFields
// Find the SmartCardView function and update it
const smartCardRegex = /function SmartCardView\(\{ item, config, onClick \}\) \{\s*return \(/;
if (smartCardRegex.test(content)) {
  content = content.replace(
    /function SmartCardView\(\{ item, config, onClick \}\) \{\s*return \(/,
    `function SmartCardView({ item, config, onClick }) {
  // Use cardFields for display (fallback to secondaryFields)
  const displayFields = (config.cardFields || config.secondaryFields || []).filter(f => f !== config.primaryField && f !== config.statusField)
  return (`
  );
  changes++;
  console.log('Added displayFields to SmartCardView');
}

// Update SmartCardView to use displayFields
if (content.includes('{config.secondaryFields.map(field => item[field]')) {
  content = content.replace(
    '{config.secondaryFields.map(field => item[field]',
    '{displayFields.map(field => item[field]'
  );
  changes++;
  console.log('Updated SmartCardView to use displayFields');
}

// Fix 3: TeamMemberCard - use cardFields
if (content.includes('// Use secondaryFields from list preferences for main grid display')) {
  content = content.replace(
    '// Use secondaryFields from list preferences for main grid display (excluding primary which is the title)\n  const mainFields = config.secondaryFields?.filter(f => f !== config.primaryField && f !== config.statusField) || []',
    '// Use cardFields for main grid display (fallback to secondaryFields)\n  const mainFields = (config.cardFields || config.secondaryFields)?.filter(f => f !== config.primaryField && f !== config.statusField) || []'
  );
  changes++;
  console.log('Fixed TeamMemberCard');
}

if (changes > 0) {
  fs.writeFileSync(filePath, content);
  console.log(`\nTotal changes: ${changes}`);
} else {
  console.log('No changes made');
}
