/** Iraq (Asia/Baghdad) is UTC+3 year-round (no DST). */

export function isIraqSendingWindow(date = new Date()): boolean {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baghdad',
    hour: 'numeric',
    hour12: false,
  }).format(date)
  const hour = parseInt(hourStr, 10)
  if (Number.isNaN(hour)) return true
  return hour >= 9 && hour <= 21
}

/** Start of calendar day in Baghdad as ISO string for DB comparisons. */
export function baghdadStartOfDayIso(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}T00:00:00+03:00`
}
