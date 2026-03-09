"use client"

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SkeletonCard } from '@/components/skeletons'

export function ListingCardSkeleton() {
  return <SkeletonCard />
}


export function ListingDetailSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6 px-3 sm:px-6 md:px-8" role="status" aria-label="Loading listing details">
      {/* Hero image */}
      <div className="-mx-3 sm:-mx-6 md:mx-0">
        <div className="skeleton-shimmer aspect-video w-full rounded-none md:rounded-2xl" />
        <div className="mt-4 px-3 space-y-2">
          <div className="skeleton-shimmer h-6 w-3/4 rounded" />
          <div className="skeleton-shimmer h-8 w-1/3 rounded" />
        </div>
        <div className="mt-3 py-3 flex gap-2 overflow-hidden px-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer w-14 h-14 md:w-24 md:h-24 rounded-lg flex-shrink-0" />
          ))}
        </div>
      </div>
      {/* Car details grid */}
      <div className="backdrop-blur-sm bg-white/5 dark:bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6">
        <div className="skeleton-shimmer h-6 w-32 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-shimmer h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <Card className="border-white/10 bg-white/5 dark:bg-white/5" role="status" aria-label="Loading chart">
      <CardHeader>
        <div className="skeleton-shimmer h-6 rounded w-1/3" />
      </CardHeader>
      <CardContent>
        <div className="skeleton-shimmer h-64 rounded" />
      </CardContent>
    </Card>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading table">
      <div className="skeleton-shimmer h-12 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-16 rounded" />
      ))}
    </div>
  )
}
