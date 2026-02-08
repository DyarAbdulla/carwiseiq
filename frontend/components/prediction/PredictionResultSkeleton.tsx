"use client"

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PredictionResultSkeleton() {
  return (
    <div className="space-y-6">
      {/* Main Price Display Skeleton */}
      <Card className="border-[#2a2d3a] bg-gradient-to-br from-[#5B7FFF]/10 to-[#1a1d29]">
        <CardHeader>
          <Skeleton className="h-4 w-32 bg-[#2a2d3a]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-48 mb-4 bg-[#2a2d3a]" />
          <Skeleton className="h-4 w-64 bg-[#2a2d3a]" />
        </CardContent>
      </Card>

      {/* Deal Score Skeleton */}
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-[#2a2d3a]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-32 bg-[#2a2d3a]" />
              <Skeleton className="h-4 w-48 bg-[#2a2d3a]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Meter Skeleton */}
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-40 bg-[#2a2d3a]" />
            <Skeleton className="h-6 w-24 bg-[#2a2d3a]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full bg-[#2a2d3a]" />
          <Skeleton className="h-4 w-full bg-[#2a2d3a]" />
        </CardContent>
      </Card>

      {/* Why This Price Skeleton */}
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-[#2a2d3a]" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-64 bg-[#2a2d3a]" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full bg-[#2a2d3a]" />
          ))}
        </CardContent>
      </Card>

      {/* Similar Cars Skeleton */}
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardHeader>
          <Skeleton className="h-6 w-48 bg-[#2a2d3a]" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-[#2a2d3a]" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}






