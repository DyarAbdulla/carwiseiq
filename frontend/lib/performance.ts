/**
 * Performance Monitoring Utilities
 * Tracks Core Web Vitals and page performance metrics
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  LCP?: number // Largest Contentful Paint
  FID?: number // First Input Delay
  CLS?: number // Cumulative Layout Shift
  FCP?: number // First Contentful Paint
  TTFB?: number // Time to First Byte

  // Custom metrics
  pageLoadTime?: number
  apiResponseTime?: number
  imageLoadTime?: number
}

/**
 * Report Web Vitals to analytics
 */
export function reportWebVitals(metric: any) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${metric.name}:`, metric.value, 'ms')
  }

  // Send to analytics service (Google Analytics, etc.)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    })
  }
}

/**
 * Measure page load time
 */
export function measurePageLoad(): number | null {
  if (typeof window === 'undefined' || !window.performance) {
    return null
  }

  const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  if (!perfData) {
    return null
  }

  const loadTime = perfData.loadEventEnd - perfData.fetchStart

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] Page load time: ${loadTime}ms`)
  }

  return loadTime
}

/**
 * Measure API response time
 */
export function measureApiCall<T>(
  apiCall: () => Promise<T>,
  endpoint: string
): Promise<T> {
  const startTime = performance.now()

  return apiCall().then((result) => {
    const endTime = performance.now()
    const duration = endTime - startTime

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] API ${endpoint}: ${duration.toFixed(2)}ms`)
    }

    // Log slow API calls
    if (duration > 3000) {
      console.warn(`[Performance] Slow API call: ${endpoint} took ${duration.toFixed(2)}ms`)
    }

    return result
  })
}

/**
 * Measure image load time
 */
export function measureImageLoad(imageSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const startTime = performance.now()
    const img = new Image()

    img.onload = () => {
      const endTime = performance.now()
      const duration = endTime - startTime

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] Image load: ${duration.toFixed(2)}ms`)
      }

      resolve(duration)
    }

    img.onerror = () => {
      resolve(-1) // Error loading image
    }

    img.src = imageSrc
  })
}

/**
 * Get Core Web Vitals scores
 */
export function getCoreWebVitals(): PerformanceMetrics {
  const metrics: PerformanceMetrics = {}

  if (typeof window === 'undefined' || !window.performance) {
    return metrics
  }

  // Get navigation timing
  const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  if (perfData) {
    metrics.TTFB = perfData.responseStart - perfData.requestStart
    metrics.pageLoadTime = perfData.loadEventEnd - perfData.fetchStart
  }

  // Get paint timing
  const paintEntries = performance.getEntriesByType('paint')
  const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint')
  if (fcpEntry) {
    metrics.FCP = fcpEntry.startTime
  }

  return metrics
}

/**
 * Log performance summary
 */
export function logPerformanceSummary() {
  if (typeof window === 'undefined') {
    return
  }

  const metrics = getCoreWebVitals()

  console.group('📊 Performance Summary')
  console.log('Page Load Time:', metrics.pageLoadTime ? `${metrics.pageLoadTime.toFixed(2)}ms` : 'N/A')
  console.log('Time to First Byte:', metrics.TTFB ? `${metrics.TTFB.toFixed(2)}ms` : 'N/A')
  console.log('First Contentful Paint:', metrics.FCP ? `${metrics.FCP.toFixed(2)}ms` : 'N/A')
  console.groupEnd()

  // Check if performance is good
  const isGood =
    (!metrics.pageLoadTime || metrics.pageLoadTime < 3000) &&
    (!metrics.TTFB || metrics.TTFB < 600) &&
    (!metrics.FCP || metrics.FCP < 1800)

  if (isGood) {
    console.log('✅ Performance is GOOD')
  } else {
    console.warn('⚠️ Performance needs improvement')
  }
}

/**
 * Monitor bundle size
 */
export function logBundleSize() {
  if (typeof window === 'undefined' || !window.performance) {
    return
  }

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

  let totalSize = 0
  let jsSize = 0
  let cssSize = 0
  let imageSize = 0

  resources.forEach((resource) => {
    const size = resource.transferSize || 0
    totalSize += size

    if (resource.name.endsWith('.js')) {
      jsSize += size
    } else if (resource.name.endsWith('.css')) {
      cssSize += size
    } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/)) {
      imageSize += size
    }
  })

  console.group('📦 Bundle Size')
  console.log('Total:', `${(totalSize / 1024).toFixed(2)} KB`)
  console.log('JavaScript:', `${(jsSize / 1024).toFixed(2)} KB`)
  console.log('CSS:', `${(cssSize / 1024).toFixed(2)} KB`)
  console.log('Images:', `${(imageSize / 1024).toFixed(2)} KB`)
  console.groupEnd()

  // Warn if bundle is too large
  if (jsSize > 500 * 1024) {
    console.warn('⚠️ JavaScript bundle is large (>500KB). Consider code splitting.')
  }
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') {
    return
  }

  // Log performance on page load
  window.addEventListener('load', () => {
    // Wait a bit for all metrics to be available
    setTimeout(() => {
      logPerformanceSummary()
      logBundleSize()
    }, 1000)
  })

  // Monitor long tasks (tasks that block the main thread for >50ms)
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn(`[Performance] Long task detected: ${entry.duration.toFixed(2)}ms`)
          }
        }
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch (e) {
      // Long task API not supported
    }
  }
}
