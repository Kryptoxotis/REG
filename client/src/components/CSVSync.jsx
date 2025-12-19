function CSVSync() {
  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📤</span>
        <div>
          <h3 className="text-lg font-semibold text-white">Sync Properties from Spreadsheet</h3>
          <p className="text-sm text-gray-400">Upload a CSV or Excel file to sync with Notion database</p>
        </div>
      </div>

      {/* Embedded n8n Form */}
      <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
        <iframe
          src="https://n8n.kryptoxotis.com/form/eaeb7b9c-4bfb-43b2-8ba8-b0456b83f141"
          title="Property Sync Form"
          className="w-full border-0"
          style={{ minHeight: '500px' }}
          allow="clipboard-write"
        />
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-gray-700/30 rounded-lg text-xs text-gray-400">
        <p className="font-medium text-gray-300 mb-1">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Properties in CSV but not in database will be <span className="text-emerald-400">added</span></li>
          <li>Properties with different status will be <span className="text-blue-400">updated</span></li>
          <li>Properties in database but not in CSV will be <span className="text-red-400">archived</span></li>
          <li>Address is used as the unique identifier</li>
        </ul>
      </div>
    </div>
  )
}

export default CSVSync
