/* global self, caches */
const CACHE_NAME = 'carwise-internal'
const UNSEEN_KEY = 'market-unseen'

async function bumpUnseen() {
  try {
    const cache = await caches.open(CACHE_NAME)
    const old = await cache.match(UNSEEN_KEY)
    let n = 0
    if (old) {
      const t = await old.text()
      n = parseInt(t, 10) || 0
    }
    n += 1
    await cache.put(UNSEEN_KEY, new Response(String(n)))
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    clients.forEach((c) => {
      try {
        c.postMessage({ type: 'CARWISE_MARKET_UNSEEN', count: n })
      } catch (e) {
        /* ignore */
      }
    })
    if (self.registration.setAppBadge) {
      try {
        await self.registration.setAppBadge(n)
      } catch (e) {
        /* ignore */
      }
    }
  } catch (e) {
    /* ignore */
  }
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }
  const title = data.title || 'CarWiseIQ'
  const options = {
    body: data.body || '',
    icon: data.icon,
    badge: data.badge,
    image: data.image,
    data: data.data || {},
    tag: data.data && data.data.tag ? data.data.tag : 'carwise',
    renotify: true,
  }
  event.waitUntil(
    (async () => {
      await bumpUnseen()
      await self.registration.showNotification(title, options)
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification.data && event.notification.data.url
  let url = typeof rawUrl === 'string' && rawUrl.length > 0 ? rawUrl : '/'
  if (!url.startsWith('http')) {
    url = `${self.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CARWISE_CLEAR_MARKET_BADGE') {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(UNSEEN_KEY, new Response('0'))
          if (self.registration.clearAppBadge) {
            try {
              await self.registration.clearAppBadge()
            } catch (e) {
              /* ignore */
            }
          }
        } catch (e) {
          /* ignore */
        }
      })()
    )
  }
})
