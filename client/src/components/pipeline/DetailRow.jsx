// Detail row for modal display

function DetailRow({ label, value }) {
  if (!value || value === '-') return null
  return (
    <div className="flex justify-between py-2 border-b border-gray-800">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  )
}

export default DetailRow
