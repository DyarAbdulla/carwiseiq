import { useRef, useCallback } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

/**
 * Custom hook for API response caching
 * Prevents duplicate API calls and reduces rate limit errors
 */
export function useApiCache<T = any>(ttl: number = 5 * 60 * 1000) {
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map())
  const pendingRequestsRef = useRef<Map<string, Promise<T>>>(new Map())

  const getCacheKey = useCallback((key: string): string => {
    return key
  }, [])

  const get = useCallback((key: string): T | null => {
    const cacheKey = getCacheKey(key)
    const entry = cacheRef.current.get(cacheKey)
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > ttl) {
      cacheRef.current.delete(cacheKey)
      return null
    }

    return entry.data
  }, [getCacheKey, ttl])

  const set = useCallback((key: string, data: T): void => {
    const cacheKey = getCacheKey(key)
    cacheRef.current.set(cacheKey, {
      data,
      timestamp: Date.now(),
    })
  }, [getCacheKey])

  const getOrFetch = useCallback(async (
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> => {
    // Check cache first
    const cached = get(key)
    if (cached !== null) {
      return cached
    }

    // Check if request is already pending
    const pending = pendingRequestsRef.current.get(key)
    if (pending) {
      return pending
    }

    // Create new request
    const promise = fetchFn()
      .then((data) => {
        set(key, data)
        pendingRequestsRef.current.delete(key)
        return data
      })
      .catch((error) => {
        pendingRequestsRef.current.delete(key)
        throw error
      })

    pendingRequestsRef.current.set(key, promise)
    return promise
  }, [get, set])

  const clear = useCallback((key?: string): void => {
    if (key) {
      const cacheKey = getCacheKey(key)
      cacheRef.current.delete(cacheKey)
      pendingRequestsRef.current.delete(key)
    } else {
      cacheRef.current.clear()
      pendingRequestsRef.current.clear()
    }
  }, [getCacheKey])

  return {
    get,
    set,
    getOrFetch,
    clear,
  }
}
