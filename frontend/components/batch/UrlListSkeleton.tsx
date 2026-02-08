'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function UrlListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 rounded-lg bg-[#0f1117] border border-[#2a2d3a]"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="h-4 w-4 rounded-full bg-[#2a2d3a]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full max-w-md bg-[#2a2d3a]" />
              <Skeleton className="h-3 w-24 bg-[#2a2d3a]" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 bg-[#2a2d3a]" />
        </div>
      ))}
    </div>
  )
}
