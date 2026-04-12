const CACHE_NAME = 'carwise-internal'
const UNSEEN_KEY = 'market-unseen'

export async function readMarketUnseenCount(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0
  try {
    const cache = await caches.open(CACHE_NAME)
    const res = await cache.match(UNSEEN_KEY)
    if (!res) return 0
    const t = await res.text()
    return parseInt(t, 10) || 0
  } catch {
    return 0
  }
}

export async function clearMarketUnseenBadge(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(UNSEEN_KEY, new Response('0'))
  } catch {
    /* ignore */
  }
  try {
    if ('clearAppBadge' in navigator && typeof navigator.clearAppBadge === 'function') {
      await navigator.clearAppBadge()
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('carwise-market-unseen', { detail: { count: 0 } }))
  } catch {
    /* ignore */
  }
}
