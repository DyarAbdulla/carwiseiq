/**
 * Global API Cache Layer
 * Caches ALL GET requests for 5 minutes to prevent 429 errors
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  promise?: Promise<T>
}

class ApiCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private pendingRequests: Map<string, Promise<any>> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cache key from URL and params
   */
  private getCacheKey(url: string, params?: Record<string, any>): string {
    const sortedParams = params
      ? Object.keys(params)
        .sort()
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join('&')
      : ''
    return `${url}${sortedParams ? `?${sortedParams}` : ''}`
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(url: string, params?: Record<string, any>): T | null {
    const key = this.getCacheKey(url, params)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > this.DEFAULT_TTL) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data
   */
  set<T>(url: string, data: T, params?: Record<string, any>): void {
    const key = this.getCacheKey(url, params)
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  /**
   * Get or fetch data with caching and deduplication
   */
  async getOrFetch<T>(
    url: string,
    fetchFn: () => Promise<T>,
    params?: Record<string, any>,
    ttl?: number
  ): Promise<T> {
    const key = this.getCacheKey(url, params)

    // Check cache first
    const cached = this.get<T>(url, params)
    if (cached !== null) {
      return cached
    }

    // Check if request is already pending (deduplication)
    const pending = this.pendingRequests.get(key)
    if (pending) {
      return pending as Promise<T>
    }

    // Create new request
    const promise = fetchFn()
      .then((data) => {
        this.set(url, data, params)
        this.pendingRequests.delete(key)
        return data
      })
      .catch((error) => {
        this.pendingRequests.delete(key)
        throw error
      })

    this.pendingRequests.set(key, promise)
    return promise
  }

  /**
   * Clear cache for specific URL or all cache
   */
  clear(url?: string, params?: Record<string, any>): void {
    if (url) {
      const key = this.getCacheKey(url, params)
      this.cache.delete(key)
      this.pendingRequests.delete(key)
    } else {
      this.cache.clear()
      this.pendingRequests.clear()
    }
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now()
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > this.DEFAULT_TTL) this.cache.delete(key)
    })
  }
}

// Singleton instance
export const apiCache = new ApiCache()

// Clear expired entries every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.clearExpired()
  }, 60 * 1000)
}
