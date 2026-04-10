"use client"

import { cn } from "@/lib/utils"

/**
 * Skeleton for car cards - matches marketplace/listing card dimensions.
 * Uses shimmer animation for polished loading UX.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 dark:border-white/10 overflow-hidden bg-white/5 dark:bg-white/5 shadow-lg",
        className
      )}
      role="status"
      aria-label="Loading car card"
    >
      {/* 16:9 marketplace cards */}
      <div className="skeleton-shimmer aspect-video w-full rounded-none" />
      <div className="p-4 md:p-5 space-y-3">
        {/* Title line */}
        <div className="skeleton-shimmer h-5 w-3/4 rounded-md" />
        {/* Price line */}
        <div className="skeleton-shimmer h-7 w-1/2 rounded-md" />
        {/* Details */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="skeleton-shimmer h-4 w-full rounded-md" />
          <div className="skeleton-shimmer h-4 w-5/6 rounded-md" />
        </div>
        {/* Footer */}
        <div className="skeleton-shimmer h-3 w-1/3 rounded-md pt-2" />
      </div>
    </div>
  )
}

/**
 * Compact car card skeleton for horizontal scroll (e.g. Best Deals)
 */
export function SkeletonCardCompact({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "shrink-0 w-[260px] rounded-2xl border border-white/10 overflow-hidden bg-white/5 dark:bg-white/5",
        className
      )}
      role="status"
      aria-label="Loading car card"
    >
      <div className="skeleton-shimmer aspect-[16/10] w-full rounded-none" />
      <div className="p-3 space-y-2">
        <div className="skeleton-shimmer h-4 w-3/4 rounded-md" />
        <div className="skeleton-shimmer h-5 w-1/2 rounded-md" />
      </div>
    </div>
  )
}
