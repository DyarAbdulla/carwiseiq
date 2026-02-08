'use client'

import { useEffect } from 'react'

/**
 * Client component to add additional meta tags that cannot be set via Next.js metadata API
 * This component adds meta tags that are not supported by the Metadata API
 */
export function MetaTags() {
  useEffect(() => {
    // Add mobile-web-app-capable meta tag
    const metaTag = document.querySelector('meta[name="mobile-web-app-capable"]')
    if (!metaTag) {
      const meta = document.createElement('meta')
      meta.name = 'mobile-web-app-capable'
      meta.content = 'yes'
      document.head.appendChild(meta)
    }
  }, [])

  return null
}
