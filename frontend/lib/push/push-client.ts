import { registerCarWiseServiceWorker } from './sw-register'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeWithApi(
  accessToken: string,
  locale: string,
  prefs?: Record<string, unknown>
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const reg = await registerCarWiseServiceWorker()
  if (!reg) return false

  const vapidRes = await fetch('/api/notifications/vapid-public-key')
  const vapidJson = await vapidRes.json().catch(() => ({}))
  const publicKey = vapidJson.publicKey as string | null
  if (!publicKey) return false

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const key = urlBase64ToUint8Array(publicKey)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key as BufferSource,
    })
  }

  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false

  const save = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      subscription: json,
      prefs: { ...prefs, locale },
    }),
  })

  return save.ok
}

export async function notifyNewListingPublished(
  listingId: string,
  accessToken: string
): Promise<void> {
  try {
    await fetch('/api/notifications/trigger-new-listing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ listingId }),
    })
  } catch {
    /* non-fatal */
  }
}
