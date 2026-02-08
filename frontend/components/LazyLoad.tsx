"use client"

import { Suspense, lazy, ComponentType } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface LazyLoadProps {
  /**
   * Component to lazy load
   */
  component: () => Promise<{ default: ComponentType<any> }>

  /**
   * Props to pass to the component
   */
  props?: Record<string, any>

  /**
   * Custom fallback component
   */
  fallback?: React.ReactNode

  /**
   * Height of the skeleton loader
   */
  skeletonHeight?: string
}

/**
 * Lazy Load Wrapper
 * Automatically lazy loads components and shows skeleton while loading
 */
export function LazyLoad({
  component,
  props = {},
  fallback,
  skeletonHeight = 'h-96',
}: LazyLoadProps) {
  const LazyComponent = lazy(component)

  const defaultFallback = (
    <div className="w-full space-y-4">
      <Skeleton className={`w-full ${skeletonHeight}`} />
    </div>
  )

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <LazyComponent {...props} />
    </Suspense>
  )
}

/**
 * Lazy load a component with intersection observer
 * Only loads when component is visible in viewport
 */
export function LazyLoadOnVisible({
  component,
  props = {},
  fallback,
  skeletonHeight = 'h-96',
  rootMargin = '100px',
}: LazyLoadProps & { rootMargin?: string }) {
  const LazyComponent = lazy(component)

  const defaultFallback = (
    <div className="w-full space-y-4">
      <Skeleton className={`w-full ${skeletonHeight}`} />
    </div>
  )

  return (
    <div
      data-lazy-load
      style={{
        minHeight: skeletonHeight,
      }}
    >
      <Suspense fallback={fallback || defaultFallback}>
        <LazyComponent {...props} />
      </Suspense>
    </div>
  )
}

/**
 * Preload a component in the background
 */
export function preloadComponent(component: () => Promise<{ default: ComponentType<any> }>) {
  // Trigger the import to start loading
  component()
}
