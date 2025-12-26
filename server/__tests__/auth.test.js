/**
 * Auth Routes Tests
 *
 * To run: npm test
 *
 * Note: These tests require mocking the Notion API.
 * For full integration tests, use a test database.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock password validation function (extracted for testing)
function validatePassword(password) {
  const errors = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Mock page ID validation function
function isValidPageId(pageId) {
  if (!pageId || typeof pageId !== 'string') return false
  const uuidWithHyphens = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const uuidWithoutHyphens = /^[0-9a-f]{32}$/i
  return uuidWithHyphens.test(pageId) || uuidWithoutHyphens.test(pageId)
}

describe('Password Validation', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('Short1!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must be at least 8 characters')
  })

  it('should reject passwords without uppercase letters', () => {
    const result = validatePassword('lowercase1!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one uppercase letter')
  })

  it('should reject passwords without lowercase letters', () => {
    const result = validatePassword('UPPERCASE1!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one lowercase letter')
  })

  it('should reject passwords without numbers', () => {
    const result = validatePassword('NoNumbers!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one number')
  })

  it('should reject passwords without special characters', () => {
    const result = validatePassword('NoSpecial1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one special character')
  })

  it('should accept valid passwords', () => {
    const result = validatePassword('ValidPass1!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should return multiple errors for weak passwords', () => {
    const result = validatePassword('weak')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('Page ID Validation', () => {
  it('should accept valid UUID with hyphens', () => {
    expect(isValidPageId('12345678-1234-1234-1234-123456789abc')).toBe(true)
  })

  it('should accept valid UUID without hyphens', () => {
    expect(isValidPageId('12345678123412341234123456789abc')).toBe(true)
  })

  it('should reject invalid page IDs', () => {
    expect(isValidPageId('invalid')).toBe(false)
    expect(isValidPageId('')).toBe(false)
    expect(isValidPageId(null)).toBe(false)
    expect(isValidPageId(undefined)).toBe(false)
    expect(isValidPageId(123)).toBe(false)
  })

  it('should reject page IDs with invalid characters', () => {
    expect(isValidPageId('12345678-1234-1234-1234-123456789xyz')).toBe(false)
  })

  it('should be case-insensitive', () => {
    expect(isValidPageId('12345678-1234-1234-1234-123456789ABC')).toBe(true)
    expect(isValidPageId('ABCDEF01-2345-6789-ABCD-EF0123456789')).toBe(true)
  })
})
