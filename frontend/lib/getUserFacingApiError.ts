import { getApiErrorTranslationKey } from './api'

/**
 * Returns a user-friendly, translated error message for API/network errors.
 * Logs the raw error to console for debugging. Use this instead of showing error.message to users.
 */
export function getUserFacingApiError(error: unknown, t: (key: string) => string): string {
  console.error('API Error:', error)
  const key = getApiErrorTranslationKey(error)
  return t(key ?? 'errors.generic')
}
