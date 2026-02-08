/**
 * Validation Utilities
 * Common validation functions for forms and inputs
 */

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validate password and return requirements status
 */
export interface PasswordRequirements {
  valid: boolean
  length: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
  score: number // 0-100
}

export function validatePassword(password: string): PasswordRequirements {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }

  const metCount = Object.values(requirements).filter(Boolean).length
  const score = (metCount / Object.keys(requirements).length) * 100

  return {
    ...requirements,
    valid: metCount >= 3 && requirements.length, // At least 3 requirements + length
    score,
  }
}

/**
 * Validate phone number (basic validation)
 */
export function validatePhone(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  // Check if it has 10-15 digits (international format)
  return digits.length >= 10 && digits.length <= 15
}

/**
 * Sanitize input string
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
}

/**
 * Validate URL
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate required field
 */
export function validateRequired(value: any): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return value !== null && value !== undefined
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  min?: number,
  max?: number
): boolean {
  if (min !== undefined && value < min) return false
  if (max !== undefined && value > max) return false
  return true
}

/**
 * Validate password byte length (for bcrypt 72-byte limit)
 */
export function validatePasswordByteLength(password: string): boolean {
  const encoder = new TextEncoder()
  return encoder.encode(password).length <= 72
}
