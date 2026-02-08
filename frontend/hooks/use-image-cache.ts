import { useRef, useCallback } from 'react'

interface ImageCacheEntry {
  url: string
  timestamp: number
  loaded: boolean
}

/**
 * Custom hook for car image caching and lazy loading
 * Prevents 429 errors by caching image URLs and only loading when needed
 */
export function useImageCache(ttl: number = 30 * 60 * 1000) {
  const cacheRef = useRef<Map<string, ImageCacheEntry>>(new Map())
  const loadingRef = useRef<Set<string>>(new Set())

  const getCacheKey = useCallback((imagePath: string): string => {
    return imagePath
  }, [])

  const getCachedUrl = useCallback((imagePath: string): string | null => {
    if (!imagePath) return null
    
    const cacheKey = getCacheKey(imagePath)
    const entry = cacheRef.current.get(cacheKey)
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > ttl) {
      cacheRef.current.delete(cacheKey)
      return null
    }

    return entry.url
  }, [getCacheKey, ttl])

  const setCachedUrl = useCallback((imagePath: string, url: string): void => {
    if (!imagePath || !url) return
    
    const cacheKey = getCacheKey(imagePath)
    cacheRef.current.set(cacheKey, {
      url,
      timestamp: Date.now(),
      loaded: true,
    })
  }, [getCacheKey])

  const isImageLoading = useCallback((imagePath: string): boolean => {
    return loadingRef.current.has(imagePath)
  }, [])

  const setImageLoading = useCallback((imagePath: string, loading: boolean): void => {
    if (loading) {
      loadingRef.current.add(imagePath)
    } else {
      loadingRef.current.delete(imagePath)
    }
  }, [])

  const clearCache = useCallback((imagePath?: string): void => {
    if (imagePath) {
      const cacheKey = getCacheKey(imagePath)
      cacheRef.current.delete(cacheKey)
      loadingRef.current.delete(imagePath)
    } else {
      cacheRef.current.clear()
      loadingRef.current.clear()
    }
  }, [getCacheKey])

  return {
    getCachedUrl,
    setCachedUrl,
    isImageLoading,
    setImageLoading,
    clearCache,
  }
}
