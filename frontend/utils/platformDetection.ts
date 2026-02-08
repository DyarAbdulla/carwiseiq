/**
 * Platform detection utilities for car listing URLs
 */

export interface PlatformInfo {
  name: string
  logo: string
  color: string
  exampleUrl: string
}

export const SUPPORTED_PLATFORMS: Record<string, PlatformInfo> = {
  iqcars: {
    name: 'IQCars',
    logo: '🚗',
    color: '#3B82F6',
    exampleUrl: 'https://www.iqcars.net/en/car/...',
  },
  dubizzle: {
    name: 'Dubizzle',
    logo: '🏠',
    color: '#10B981',
    exampleUrl: 'https://www.dubizzle.com/cars/...',
  },
  syarah: {
    name: 'Syarah',
    logo: '🚙',
    color: '#F59E0B',
    exampleUrl: 'https://www.syarah.com/car/...',
  },
  opensooq: {
    name: 'OpenSooq',
    logo: '🛒',
    color: '#EF4444',
    exampleUrl: 'https://jo.opensooq.com/cars/...',
  },
  olx: {
    name: 'OLX',
    logo: '📱',
    color: '#8B5CF6',
    exampleUrl: 'https://www.olx.com/cars/...',
  },
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): PlatformInfo | null {
  if (!url || typeof url !== 'string') return null

  const lowerUrl = url.toLowerCase()

  // IQCars
  if (lowerUrl.includes('iqcars') || lowerUrl.includes('iqcars.net')) {
    return SUPPORTED_PLATFORMS.iqcars
  }

  // Dubizzle
  if (lowerUrl.includes('dubizzle')) {
    return SUPPORTED_PLATFORMS.dubizzle
  }

  // Syarah
  if (lowerUrl.includes('syarah')) {
    return SUPPORTED_PLATFORMS.syarah
  }

  // OpenSooq
  if (lowerUrl.includes('opensooq')) {
    return SUPPORTED_PLATFORMS.opensooq
  }

  // OLX
  if (lowerUrl.includes('olx.') || lowerUrl.includes('olx.com')) {
    return SUPPORTED_PLATFORMS.olx
  }

  return null
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Check if URL appears to be a car listing
 */
export function isCarListingUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  const carKeywords = ['car', 'vehicle', 'automobile', 'auto', 'listing', 'ad', 'advertisement']
  return carKeywords.some(keyword => lowerUrl.includes(keyword))
}
