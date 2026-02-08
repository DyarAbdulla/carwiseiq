"use client"

import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ListingCardSkeleton() {
  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29] animate-pulse">
      <div className="h-48 bg-[#2a2d3a] rounded-t-lg" />
      <CardHeader>
        <div className="h-6 bg-[#2a2d3a] rounded w-3/4 mb-2" />
        <div className="h-4 bg-[#2a2d3a] rounded w-1/2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 bg-[#2a2d3a] rounded w-full" />
          <div className="h-4 bg-[#2a2d3a] rounded w-5/6" />
          <div className="h-10 bg-[#2a2d3a] rounded w-full mt-4" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ListingDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-96 bg-[#2a2d3a] rounded-lg" />
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardHeader>
          <div className="h-8 bg-[#2a2d3a] rounded w-3/4 mb-2" />
          <div className="h-6 bg-[#2a2d3a] rounded w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-[#2a2d3a] rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29] animate-pulse">
      <CardHeader>
        <div className="h-6 bg-[#2a2d3a] rounded w-1/3" />
      </CardHeader>
      <CardContent>
        <div className="h-64 bg-[#2a2d3a] rounded" />
      </CardContent>
    </Card>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-12 bg-[#2a2d3a] rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-[#2a2d3a] rounded" />
      ))}
    </div>
  )
}
