import validator from 'validator'

// Notion uses UUIDs for page IDs (with or without hyphens)
export function isValidNotionId(id) {
  if (!id || typeof id !== 'string') return false
  // Notion IDs can be UUID v4 with or without hyphens
  const normalized = id.replace(/-/g, '')
  // 32 hex chars = valid UUID without hyphens
  return /^[a-f0-9]{32}$/i.test(normalized)
}

// Validate page ID and return error response if invalid
export function validatePageId(id, fieldName = 'pageId') {
  if (!id) {
    return { valid: false, error: `${fieldName} is required` }
  }
  if (!isValidNotionId(id)) {
    return { valid: false, error: `Invalid ${fieldName} format` }
  }
  return { valid: true }
}
