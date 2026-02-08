// Service Worker for Car Price Predictor Pro
// Cache version - increment when updating to force cache refresh
const CACHE_VERSION = 'cppp-v3'; // Incremented to force cache refresh after auth fixes
const CACHE_NAME = `car-price-predictor-${CACHE_VERSION}`;
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB max cache size

// Assets to pre-cache on install (essential offline assets)
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - pre-cache essential assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching essential assets');
        // Cache offline page and manifest immediately with cache-busting
        return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })))
          .catch((err) => {
            console.warn('[Service Worker] Failed to pre-cache some assets:', err);
            // Continue even if some assets fail
            return Promise.resolve();
          });
      })
      .then(() => {
        // Force activation of new service worker immediately
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[Service Worker] Installation failed:', err);
      })
  );
});

// Activate event - clean up old caches and enforce cache limits
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...', CACHE_VERSION);

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys()
        .then((cacheNames) => {
          const deletePromises = cacheNames.map((cacheName) => {
            // Delete old caches that don't match current version
            if (cacheName !== CACHE_NAME) {
              // Delete all old car-price-predictor caches
              if (cacheName.startsWith('car-price-predictor-')) {
                console.log('[Service Worker] Deleting old cache:', cacheName);
                return caches.delete(cacheName);
              }
              // Also clean up any workbox or next.js caches if they exist
              if (cacheName.startsWith('workbox-') || cacheName.startsWith('next-')) {
                console.log('[Service Worker] Deleting unused cache:', cacheName);
                return caches.delete(cacheName);
              }
            }
            return Promise.resolve();
          });
          return Promise.all(deletePromises);
        }),
      // Enforce cache size limits
      enforceCacheSizeLimit(),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
      .then(() => {
        console.log('[Service Worker] Activated successfully');
      })
      .catch((err) => {
        console.error('[Service Worker] Activation failed:', err);
      })
  );
});

// Helper function to enforce cache size limits
async function enforceCacheSizeLimit() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();

    // Estimate cache size (rough calculation)
    let totalSize = 0;
    const sizeEstimates = [];

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        const size = blob.size;
        totalSize += size;
        sizeEstimates.push({ request, size });
      }
    }

    // If cache exceeds limit, remove oldest/largest items (keep precache assets)
    if (totalSize > MAX_CACHE_SIZE) {
      console.log(`[Service Worker] Cache size (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds limit, cleaning...`);

      // Sort by size (largest first) and remove until under limit
      sizeEstimates.sort((a, b) => b.size - a.size);

      for (const item of sizeEstimates) {
        // Don't delete precache assets
        const url = new URL(item.request.url);
        const isPrecache = PRECACHE_ASSETS.some(asset => url.pathname === asset);

        if (!isPrecache && totalSize > MAX_CACHE_SIZE) {
          await cache.delete(item.request);
          totalSize -= item.size;
          console.log(`[Service Worker] Removed large cache item: ${url.pathname}`);
        }
      }
    }
  } catch (err) {
    console.warn('[Service Worker] Error enforcing cache size limit:', err);
  }
}

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Wrap entire handler in try-catch for safety
  try {
    const url = new URL(request.url);

    // CRITICAL: Skip non-GET requests immediately (never cache POST/PUT/DELETE)
    if (request.method !== 'GET') {
      // For non-GET requests, always pass through to network (no caching, no interception)
      return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
      return;
    }

    // HARD BLOCKLIST: Never cache auth/session related requests
    const authBlocklist = [
      '/login',
      '/register',
      '/logout',
      '/me',
      '/session',
      '/auth'
    ];

    const pathname = url.pathname.toLowerCase();
    const isAuthRequest = authBlocklist.some(path => pathname.includes(path.toLowerCase()));

    if (isAuthRequest) {
      // Network-only for auth requests (no caching)
      event.respondWith(
        fetch(request).catch((err) => {
          console.warn('[Service Worker] Auth request failed:', err);
          return new Response(JSON.stringify({ error: 'Network error' }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }

    // BLOCKLIST: Never cache Next.js dev/HMR assets
    const devBlocklist = [
      '/_next/webpack-hmr',
      '/_next/static/development',
      'hot-update'
    ];

    const isDevAsset = devBlocklist.some(pattern => pathname.includes(pattern.toLowerCase()));

    if (isDevAsset) {
      // Network-only for dev assets
      return;
    }

    // BLOCKLIST: Never cache requests with Authorization header or credentials
    const hasAuthHeader = request.headers.get('Authorization') !== null;
    const hasCredentials = request.credentials === 'include';

    if (hasAuthHeader || hasCredentials) {
      // Network-only for authenticated requests (no caching)
      event.respondWith(
        fetch(request).catch((err) => {
          console.warn('[Service Worker] Authenticated request failed:', err);
          return new Response(JSON.stringify({ error: 'Network error' }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }

    // BLOCKLIST: Never cache requests to auth backend (port 3001 or any auth server)
    // Since auth is now on port 8000, check for /api/auth paths instead
    if (pathname.startsWith('/api/auth/')) {
      // Network-only for auth API requests
      event.respondWith(
        fetch(request).catch((err) => {
          console.warn('[Service Worker] Auth API request failed:', err);
          return new Response(JSON.stringify({ error: 'Network error' }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }

    // Handle navigation requests (HTML pages) - Network first with cache fallback
    // Note: Auth-related pages are already filtered out above
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Only cache successful, same-origin responses
            if (response.ok && response.type === 'basic') {
              const responseClone = response.clone();
              // Cache in background (don't block response)
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone).catch((err) => {
                  console.warn('[Service Worker] Failed to cache navigation:', err);
                });
              }).catch((err) => {
                console.warn('[Service Worker] Cache open failed:', err);
              });
            }
            return response;
          })
          .catch((err) => {
            console.warn('[Service Worker] Navigation fetch failed:', err);
            // Network failed, try cache
            return caches.match(request)
              .then((cachedResponse) => {
                if (cachedResponse) {
                  return cachedResponse;
                }
                // If no cached version, return offline page
                return caches.match('/offline.html')
                  .then((offlinePage) => {
                    if (offlinePage) {
                      return offlinePage;
                    }
                    // Fallback response if offline page is missing
                    return new Response('Offline', {
                      status: 503,
                      statusText: 'Service Unavailable',
                      headers: { 'Content-Type': 'text/html' }
                    });
                  });
              })
              .catch((cacheErr) => {
                console.warn('[Service Worker] Cache match failed:', cacheErr);
                return new Response('Offline', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/html' }
                });
              });
          })
      );
      return;
    }

    // Handle API requests (same-origin /api/*) - Network first, short cache
    // Note: /api/auth/* is already filtered out above
    if (url.pathname.startsWith('/api/') && url.origin === self.location.origin) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Only cache successful GET responses (we already checked method is GET)
            // Limit size via Content-Length header check
            if (response.ok && response.status === 200) {
              const responseClone = response.clone();
              const contentLength = response.headers.get('content-length');
              // Cache if no size header or size is reasonable (under 1MB)
              if (!contentLength || parseInt(contentLength, 10) < 1024 * 1024) {
                // Cache in background (don't block response)
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone).catch((err) => {
                    console.warn('[Service Worker] Failed to cache API response:', err);
                  });
                }).catch((err) => {
                  console.warn('[Service Worker] Cache open failed:', err);
                });
              }
            }
            return response;
          })
          .catch((err) => {
            console.warn('[Service Worker] API fetch failed:', err);
            // Network failed, try cache (only for GET requests, which we've already verified)
            return caches.match(request)
              .then((cachedResponse) => {
                if (cachedResponse) {
                  return cachedResponse;
                }
                // Return error response for no cache
                return new Response(
                  JSON.stringify({ error: 'Offline and no cached data available' }),
                  {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'application/json' },
                  }
                );
              })
              .catch((cacheErr) => {
                console.warn('[Service Worker] Cache match failed:', cacheErr);
                return new Response(
                  JSON.stringify({ error: 'Offline and no cached data available' }),
                  {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'application/json' },
                  }
                );
              });
          })
      );
      return;
    }

    // Handle static assets (JS, CSS, images, fonts, etc.) - stale-while-revalidate
    // Note: Dev/HMR assets are already filtered out above
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // Return cached version immediately if available (stale-while-revalidate)
          if (cachedResponse) {
            // Fetch fresh version in background (non-blocking)
            fetch(request)
              .then((response) => {
                // Only update cache if response is valid
                if (response.ok && response.status === 200) {
                  const contentLength = response.headers.get('content-length');
                  // Cache if no size header or size is reasonable (under 5MB)
                  if (!contentLength || parseInt(contentLength, 10) < 5 * 1024 * 1024) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                      cache.put(request, responseClone).catch((err) => {
                        console.warn('[Service Worker] Failed to update cache:', err);
                      });
                    }).catch((err) => {
                      console.warn('[Service Worker] Cache open failed:', err);
                    });
                  }
                }
              })
              .catch((err) => {
                // Ignore fetch errors in background update (we have cached version)
                console.warn('[Service Worker] Background fetch failed:', err);
              });

            return cachedResponse;
          }

          // No cache, fetch from network
          return fetch(request)
            .then((response) => {
              // Cache successful responses (same-origin only, reasonable size)
              if (response.ok && response.type === 'basic') {
                const contentLength = response.headers.get('content-length');
                // Cache if no size header or size is reasonable (under 5MB)
                if (!contentLength || parseInt(contentLength, 10) < 5 * 1024 * 1024) {
                  const responseClone = response.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseClone).catch((err) => {
                      console.warn('[Service Worker] Failed to cache asset:', err);
                    });
                  }).catch((err) => {
                    console.warn('[Service Worker] Cache open failed:', err);
                  });
                }
              }

              return response;
            })
            .catch((err) => {
              console.warn('[Service Worker] Asset fetch failed:', err);
              // Network failed and no cache
              if (request.destination === 'image') {
                return new Response('', { status: 503, statusText: 'Service Unavailable' });
              }
              // For other assets, return error
              return new Response('Network error', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
        .catch((err) => {
          console.error('[Service Worker] Cache match error:', err);
          // If cache match fails, try network
          return fetch(request).catch((fetchErr) => {
            console.error('[Service Worker] Fetch fallback error:', fetchErr);
            return new Response('Service unavailable', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
    );
  } catch (error) {
    // Critical: Never let service worker crash - log and pass through to network
    console.error('[Service Worker] Fatal error in fetch handler:', error);
    // Fallback: always pass through to network on error
    event.respondWith(
      fetch(request).catch((fetchErr) => {
        console.error('[Service Worker] Network fallback failed:', fetchErr);
        return new Response('Service unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
  }
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
