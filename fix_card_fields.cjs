const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/components/DatabaseViewer.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Fix 1: PropertyCard - use config.cardFields instead of config.secondaryFields
const oldPropertyCard = `function PropertyCard({ item, config, onClick }) {
  const status = item[config.statusField] || item.Status || item.status || ''
  const primaryValue = item[config.primaryField] || item.Address || 'No Address'
  // Fields to show (from list preferences, excluding primary and status)
  const displayFields = config.secondaryFields?.filter(f => f !== config.primaryField && f !== config.statusField) || []`;

const newPropertyCard = `function PropertyCard({ item, config, onClick }) {
  const status = item[config.statusField] || item.Status || item.status || ''
  const primaryValue = item[config.primaryField] || item.Address || 'No Address'
  // Fields to show (from card preferences, excluding primary and status)
  const displayFields = (config.cardFields || config.secondaryFields)?.filter(f => f !== config.primaryField && f !== config.statusField) || []`;

if (content.includes(oldPropertyCard)) {
  content = content.replace(oldPropertyCard, newPropertyCard);
  changes++;
  console.log('Fixed PropertyCard to use cardFields');
}

// Fix 2: SmartCardView - use config.cardFields
const oldSmartCard = `function SmartCardView({ item, config, onClick }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 p-4 cursor-pointer hover:border-gray-600 transition-colors" onClick={onClick}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white truncate flex-1 flex items-center gap-1">
          {isNewItem(item) && <span className="text-red-500 font-bold text-lg" title="Added today">*</span>}
          {item[config.primaryField] || 'Untitled'}
        </h3>
        {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
      </div>
      <div className="space-y-1">{config.secondaryFields.map(field => item[field] && <p key={field} className="text-sm text-gray-400 truncate"><span className="text-gray-500">{field}:</span> {String(item[field])}</p>)}</div>
    </motion.div>
  )
}`;

const newSmartCard = `function SmartCardView({ item, config, onClick }) {
  // Use cardFields if available, fallback to secondaryFields
  const displayFields = (config.cardFields || config.secondaryFields || []).filter(f => f !== config.primaryField && f !== config.statusField)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl border border-gray-700 p-4 cursor-pointer hover:border-gray-600 transition-colors" onClick={onClick}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white truncate flex-1 flex items-center gap-1">
          {isNewItem(item) && <span className="text-red-500 font-bold text-lg" title="Added today">*</span>}
          {item[config.primaryField] || 'Untitled'}
        </h3>
        {config.statusField && item[config.statusField] && <span className={"ml-2 px-2 py-1 text-xs font-medium rounded-full " + getStatusColor(item[config.statusField])}>{item[config.statusField]}</span>}
      </div>
      <div className="space-y-1">{displayFields.map(field => item[field] && <p key={field} className="text-sm text-gray-400 truncate"><span className="text-gray-500">{field}:</span> {String(item[field])}</p>)}</div>
    </motion.div>
  )
}`;

if (content.includes(oldSmartCard)) {
  content = content.replace(oldSmartCard, newSmartCard);
  changes++;
  console.log('Fixed SmartCardView to use cardFields');
}

// Fix 3: TeamMemberCard - use config.cardFields for mainFields
const oldTeamCard = `function TeamMemberCard({ item, config, onClick }) {
  const [expanded, setExpanded] = useState(false)
  // Use secondaryFields from list preferences for main grid display (excluding primary which is the title)
  const mainFields = config.secondaryFields?.filter(f => f !== config.primaryField && f !== config.statusField) || []`;

const newTeamCard = `function TeamMemberCard({ item, config, onClick }) {
  const [expanded, setExpanded] = useState(false)
  // Use cardFields for main grid display (fallback to secondaryFields)
  const mainFields = (config.cardFields || config.secondaryFields)?.filter(f => f !== config.primaryField && f !== config.statusField) || []`;

if (content.includes(oldTeamCard)) {
  content = content.replace(oldTeamCard, newTeamCard);
  changes++;
  console.log('Fixed TeamMemberCard to use cardFields');
}

if (changes > 0) {
  fs.writeFileSync(filePath, content);
  console.log(`\nTotal changes: ${changes}`);
} else {
  console.log('No changes made - patterns may have already been fixed or changed');
}
