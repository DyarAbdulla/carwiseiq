import { getApiErrorTranslationKey } from './api'

/**
 * Returns a user-friendly, translated error message for API/network errors.
 * Prefers specific API error messages (e.g. "Admin authentication required") over generic translations.
 */
export function getUserFacingApiError(error: unknown, t: (key: string) => string): string {
  console.error('API Error:', error)
  // Prefer specific backend error messages when available
  const axiosErr = error as { response?: { data?: { detail?: string } }; message?: string }
  const detail = axiosErr?.response?.data?.detail
  if (typeof detail === 'string' && detail.length > 0 && detail.length < 200) {
    return detail
  }
  const key = getApiErrorTranslationKey(error)
  return t(key ?? 'errors.generic')
}
