"use client"

import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

export function SmartDealAnalystSkeleton() {
  return (
    <div className="space-y-6">
      {/* 1. Price Hero Card Skeleton */}
      <div className="glassCard p-8 sm:p-10">
        {/* Large Price Skeleton */}
        <div className="text-center mb-6">
          <Skeleton className="h-16 sm:h-20 md:h-24 w-64 mx-auto mb-3 bg-white/5" />
          <Skeleton className="h-5 w-80 mx-auto bg-white/5" />
        </div>

        {/* Gauge Skeleton */}
        <div className="mt-8">
          <div className="relative w-full max-w-md mx-auto">
            <Skeleton className="h-32 w-full rounded-t-full bg-white/5" />
            <div className="flex justify-between items-center mt-2 px-2">
              <Skeleton className="h-4 w-20 bg-white/5" />
              <Skeleton className="h-4 w-20 bg-white/5" />
              <Skeleton className="h-4 w-24 bg-white/5" />
            </div>
            <div className="mt-4 text-center">
              <Skeleton className="h-8 w-32 mx-auto bg-white/5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Smart Insights Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glassCard p-5"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-lg bg-white/5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24 bg-white/5" />
                  <Skeleton className="h-4 w-16 bg-white/5" />
                </div>
                <Skeleton className="h-3 w-full bg-white/5" />
                <Skeleton className="h-3 w-3/4 bg-white/5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 3. Negotiation Assistant Skeleton */}
      <div className="glassCard p-6 border-l-4 border-blue-500/50 bg-blue-500/5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-lg bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 bg-white/5" />
              <Skeleton className="h-5 w-24 bg-white/5" />
            </div>
            <Skeleton className="h-4 w-full bg-white/5" />
            <Skeleton className="h-4 w-5/6 bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  )
}
