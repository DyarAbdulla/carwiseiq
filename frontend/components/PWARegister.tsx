'use client'

import { useEffect } from 'react'

const PWA_DEV_CLEANED_KEY = '_pwa_dev_cleaned'

/**
 * PWARegister Component
 * Safely registers the service worker in the browser
 * - Only registers when: NODE_ENV === 'production' OR NEXT_PUBLIC_ENABLE_PWA === 'true'
 * - In development (without PWA enabled): unregisters SW and clears caches once per session to avoid HMR clutter
 * - This component must be a client component to access browser APIs
 */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const isProduction = process.env.NODE_ENV === 'production'
    const pwaEnabled = process.env.NEXT_PUBLIC_ENABLE_PWA === 'true'
    const shouldRegisterSW = isProduction || pwaEnabled

    if (shouldRegisterSW) {
      try {
        navigator.serviceWorker
          .register('/service-worker.js', { scope: '/' })
          .then((registration) => {
            try {
              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing
                if (newWorker) {
                  newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                      // Optional: could show a "Refresh to update" UI; no console in production
                    }
                  })
                }
              })
            } catch (_) { /* no-op */ }
          })
          .catch((error) => {
            console.warn('[PWA] Service Worker registration failed:', error)
          })
        try {
          navigator.serviceWorker.addEventListener('controllerchange', () => { /* no-op */ })
        } catch (_) { /* no-op */ }
      } catch (error) {
        console.warn('[PWA] Error setting up service worker:', error)
      }
    } else {
      // Dev: run unregister/clear at most once per session to avoid HMR console spam
      try {
        if (sessionStorage.getItem(PWA_DEV_CLEANED_KEY)) return
      } catch (_) { /* no-op */ }

      const unregisterAndClearCaches = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations()
          for (const registration of registrations) {
            try {
              await registration.unregister()
            } catch (err) {
              console.warn('[PWA Dev] Error unregistering:', err)
            }
          }
          try {
            const cacheNames = await caches.keys()
            await Promise.all(cacheNames.map((name) => caches.delete(name).catch(() => {})))
          } catch (err) {
            console.warn('[PWA Dev] Error clearing caches:', err)
          }
          try {
            sessionStorage.setItem(PWA_DEV_CLEANED_KEY, '1')
          } catch (_) { /* no-op */ }
        } catch (err) {
          console.warn('[PWA Dev] Error during unregister/clear:', err)
        }
      }
      unregisterAndClearCaches()
    }
  }, [])

  return null
}
