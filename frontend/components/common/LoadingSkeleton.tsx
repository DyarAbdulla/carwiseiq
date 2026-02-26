"use client"

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SkeletonCard } from '@/components/skeletons'

export function ListingCardSkeleton() {
  return <SkeletonCard />
}

export function ListingDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading listing details">
      <div className="skeleton-shimmer h-96 rounded-lg" />
      <Card className="border-white/10 bg-white/5 dark:bg-white/5">
        <CardHeader>
          <div className="skeleton-shimmer h-8 rounded w-3/4 mb-2" />
          <div className="skeleton-shimmer h-6 rounded w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton-shimmer h-16 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
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
