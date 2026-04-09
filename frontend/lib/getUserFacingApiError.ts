import { getApiErrorTranslationKey } from './api'

/**
 * Returns a user-friendly, translated error message for API/network errors.
 * Prefers specific API error messages (e.g. "Admin authentication required") over generic translations.
 */
export function getUserFacingApiError(error: unknown, t: (key: string) => string): string {
  console.error('API Error:', error)
  const axiosErr = error as {
    response?: { status?: number; data?: { detail?: string } }
    message?: string
    code?: string
  }
  const status = axiosErr?.response?.status
  if (status === 503 || status === 502 || status === 504) {
    return 'Unable to connect to the prediction service. Please try again later.'
  }
  const code = (axiosErr as { code?: string }).code
  if (code === 'ECONNREFUSED' || code === 'ERR_NETWORK') {
    return 'Unable to connect to the prediction service. Please try again later.'
  }
  // Prefer specific backend error messages when available (short, safe strings)
  const detail = axiosErr?.response?.data?.detail
  if (typeof detail === 'string' && detail.length > 0 && detail.length < 200) {
    return detail
  }
  const key = getApiErrorTranslationKey(error)
  return t(key ?? 'errors.generic')
}
