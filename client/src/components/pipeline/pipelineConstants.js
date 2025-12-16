// Pipeline constants and helper functions

export const LOAN_STATUS_COLUMNS = [
  { key: 'Loan Application Received', label: 'Application Received', shortLabel: 'App', color: 'slate' },
  { key: 'Disclosures Sent', label: 'Disclosures Sent', shortLabel: 'Disc Sent', color: 'gray' },
  { key: 'Disclosures Signed', label: 'Disclosures Signed', shortLabel: 'Disc Sign', color: 'zinc' },
  { key: 'Loan Documents Collected', label: 'Docs Collected', shortLabel: 'Docs', color: 'blue' },
  { key: 'File in Processing', label: 'In Processing', shortLabel: 'Process', color: 'indigo' },
  { key: 'Appraisal Ordered', label: 'Appraisal Ordered', shortLabel: 'Appr Ord', color: 'violet' },
  { key: 'Appraisal Received', label: 'Appraisal Received', shortLabel: 'Appr Rec', color: 'purple' },
  { key: 'Initial Underwriting (IUW)', label: 'Initial UW', shortLabel: 'IUW', color: 'fuchsia' },
  { key: 'Conditions Requested', label: 'Conditions Req', shortLabel: 'Cond Req', color: 'pink' },
  { key: 'Conditions Submitted', label: 'Conditions Sub', shortLabel: 'Cond Sub', color: 'rose' },
  { key: 'Final Underwriting (FUW)', label: 'Final UW', shortLabel: 'FUW', color: 'orange' },
  { key: 'Clear to Close (CTC)', label: 'Clear to Close', shortLabel: 'CTC', color: 'amber' },
  { key: 'Closing Disclosure (CD) Issued', label: 'CD Issued', shortLabel: 'CD Iss', color: 'yellow' },
  { key: 'Closing Disclosure (CD) Signed', label: 'CD Signed', shortLabel: 'CD Sign', color: 'lime' },
  { key: 'Closing Scheduled', label: 'Closing Sched', shortLabel: 'Sched', color: 'green' },
  { key: 'Closed', label: 'Closed', shortLabel: 'Closed', color: 'emerald' },
  { key: 'Funded', label: 'Funded', shortLabel: 'Funded', color: 'teal' },
  { key: 'Loan Complete / Transfer', label: 'Complete', shortLabel: 'Done', color: 'cyan' },
  { key: 'Back On Market (BOM)', label: 'Back On Market', shortLabel: 'BOM', color: 'red' },
  { key: 'CASH', label: 'Cash Deal', shortLabel: 'CASH', color: 'sky' }
]

export const colorMap = {
  slate: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', header: 'bg-slate-600', dot: 'bg-slate-500' },
  gray: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', header: 'bg-gray-600', dot: 'bg-gray-500' },
  zinc: { bg: 'bg-zinc-500/20', border: 'border-zinc-500/30', text: 'text-zinc-400', header: 'bg-zinc-600', dot: 'bg-zinc-500' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', header: 'bg-blue-600', dot: 'bg-blue-500' },
  indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', header: 'bg-indigo-600', dot: 'bg-indigo-500' },
  violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', header: 'bg-violet-600', dot: 'bg-violet-500' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', header: 'bg-purple-600', dot: 'bg-purple-500' },
  fuchsia: { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', header: 'bg-fuchsia-600', dot: 'bg-fuchsia-500' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', header: 'bg-pink-600', dot: 'bg-pink-500' },
  rose: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', header: 'bg-rose-600', dot: 'bg-rose-500' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', header: 'bg-orange-600', dot: 'bg-orange-500' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', header: 'bg-amber-600', dot: 'bg-amber-500' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', header: 'bg-yellow-600', dot: 'bg-yellow-500' },
  lime: { bg: 'bg-lime-500/20', border: 'border-lime-500/30', text: 'text-lime-400', header: 'bg-lime-600', dot: 'bg-lime-500' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', header: 'bg-green-600', dot: 'bg-green-500' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', header: 'bg-emerald-600', dot: 'bg-emerald-500' },
  teal: { bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400', header: 'bg-teal-600', dot: 'bg-teal-500' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', header: 'bg-cyan-600', dot: 'bg-cyan-500' },
  sky: { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400', header: 'bg-sky-600', dot: 'bg-sky-500' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', header: 'bg-red-600', dot: 'bg-red-500' }
}

// City to Edwards Co. mapping
export const CITY_TO_EDWARDS = {
  'El Paso': "Edward's LLC.",
  'Las Cruces': "Edward's NM.",
  'McAllen': "Edward's RGV",
  'San Antonio': 'San Antonio'
}

// Cities for Presale filter
export const CITIES = ['El Paso', 'Las Cruces', 'McAllen', 'San Antonio']

// Helper to get address from different database schemas
export const getAddress = (deal) => deal.Address || deal['Property Address'] || deal.address || ''

// Helper to get close date urgency (for color coding)
export const getCloseDateUrgency = (deal) => {
  const closingDate = deal['Scheduled Closing']?.start || deal['Closed Date']?.start
  if (!closingDate) return 'none'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const closeDate = new Date(closingDate)
  closeDate.setHours(0, 0, 0, 0)

  const daysUntilClose = Math.ceil((closeDate - today) / (1000 * 60 * 60 * 24))

  if (daysUntilClose <= 0) return 'overdue'
  if (daysUntilClose <= 10) return 'soon'
  return 'none'
}

// Formatting helpers
export const formatCurrency = (num) => num ? '$' + num.toLocaleString() : '-'

export const formatDate = (dateObj) => {
  if (!dateObj?.start) return '-'
  return new Date(dateObj.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
