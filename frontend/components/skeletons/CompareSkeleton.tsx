"use client"

import { SkeletonCard } from "./SkeletonCard"
import { SkeletonText } from "./SkeletonText"

/**
 * Skeleton for Compare page when loading marketplace listings.
 * Shows grid of car cards + summary area.
 */
export function CompareSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading comparison">
      {/* Summary cards area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer h-24 rounded-2xl"
          />
        ))}
      </div>
      {/* Car cards grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      {/* Chart area */}
      <div className="skeleton-shimmer h-64 rounded-2xl" />
      {/* Spec table area */}
      <div className="space-y-4">
        <SkeletonText lines={1} width="1/3" size="lg" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skeleton-shimmer h-12 rounded-md"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
