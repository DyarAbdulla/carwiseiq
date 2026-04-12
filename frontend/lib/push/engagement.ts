const VISIT_KEY = 'carwise_visit_count'
const ENG_PREDICT = 'carwise_engaged_predict'
const ENG_COMPARE = 'carwise_engaged_compare'
const SNOOZE_UNTIL = 'carwise_push_snooze_until'
const DENIED_FLAG = 'carwise_push_denied'

export function incrementVisitCount(): void {
  if (typeof window === 'undefined') return
  try {
    const n = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) + 1
    localStorage.setItem(VISIT_KEY, String(n))
  } catch {
    /* ignore */
  }
}

export function markPredictEngaged(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ENG_PREDICT, '1')
  } catch {
    /* ignore */
  }
}

export function markCompareEngaged(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ENG_COMPARE, '1')
  } catch {
    /* ignore */
  }
}

export function snoozePushPromptDays(days: number): void {
  if (typeof window === 'undefined') return
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000
    localStorage.setItem(SNOOZE_UNTIL, String(until))
  } catch {
    /* ignore */
  }
}

export function markPushDenied(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DENIED_FLAG, '1')
  } catch {
    /* ignore */
  }
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

export function shouldOfferPushPrompt(): boolean {
  if (typeof window === 'undefined') return false
  if (!isPushSupported()) return false
  const secure = window.isSecureContext || window.location.hostname === 'localhost'
  if (!secure) return false
  if (Notification.permission === 'denied') return false
  if (Notification.permission === 'granted') return false
  try {
    if (localStorage.getItem(DENIED_FLAG) === '1') return false
    const until = localStorage.getItem(SNOOZE_UNTIL)
    if (until && Date.now() < parseInt(until, 10)) return false
    const visits = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10)
    const engaged =
      localStorage.getItem(ENG_PREDICT) === '1' || localStorage.getItem(ENG_COMPARE) === '1'
    return visits >= 2 || engaged
  } catch {
    return false
  }
}
