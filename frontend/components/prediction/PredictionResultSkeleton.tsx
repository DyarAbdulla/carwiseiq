"use client"

import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function PredictionResultSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading valuation results">
      {/* Main Price Display Skeleton */}
      <Card className="border-white/10 bg-gradient-to-br from-[#5B7FFF]/10 to-white/5 dark:to-white/5">
        <CardHeader>
          <div className="skeleton-shimmer h-4 w-32 rounded" />
        </CardHeader>
        <CardContent>
          <div className="skeleton-shimmer h-16 w-48 mb-4 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-64 rounded" />
        </CardContent>
      </Card>

      {/* Deal Score Skeleton */}
      <Card className="border-white/10 bg-white/5 dark:bg-white/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="skeleton-shimmer h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-6 w-32 rounded" />
              <div className="skeleton-shimmer h-4 w-48 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Meter Skeleton */}
      <Card className="border-white/10 bg-white/5 dark:bg-white/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="skeleton-shimmer h-6 w-40 rounded" />
            <div className="skeleton-shimmer h-6 w-24 rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="skeleton-shimmer h-8 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
        </CardContent>
      </Card>

      {/* Why This Price Skeleton */}
      <Card className="border-white/10 bg-white/5 dark:bg-white/5">
        <CardHeader>
          <div className="skeleton-shimmer h-6 w-40 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="skeleton-shimmer h-4 w-64 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-16 w-full rounded" />
          ))}
        </CardContent>
      </Card>

      {/* Similar Cars Skeleton */}
      <Card className="border-white/10 bg-white/5 dark:bg-white/5">
        <CardHeader>
          <div className="skeleton-shimmer h-6 w-48 rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-12 w-full rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}






