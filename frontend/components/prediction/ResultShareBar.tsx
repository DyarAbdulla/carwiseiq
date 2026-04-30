"use client"

import { lazy, Suspense } from 'react'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { Share2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const ShareExportMenu = lazy(() =>
  import('./ShareExportMenu').then((m) => ({ default: m.ShareExportMenu }))
)

interface ResultShareBarProps {
  result: PredictionResponse
  carFeatures: CarFeatures
}

export function ResultShareBar({ result, carFeatures }: ResultShareBarProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[5000] bottom-0 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] md:hidden"
    >
      <div className="max-w-2xl mx-auto px-2 pb-1 pointer-events-auto">
        <div className="flex items-center justify-stretch gap-1 rounded-xl border border-white/12 bg-zinc-950/92 backdrop-blur-md py-1.5 px-1.5 shadow-lg shadow-violet-900/25 min-w-0">
          <Share2 className="h-3.5 w-3.5 text-violet-300/90 shrink-0 ms-1" aria-hidden />
          <div className="w-full min-w-0 shrink-0 [&_button]:w-full [&_button]:justify-center [&_button]:h-9 [&_button]:text-xs">
            <Suspense fallback={<Skeleton className="h-9 w-full max-w-md rounded-lg mx-auto" />}>
              <ShareExportMenu
                result={result}
                carFeatures={carFeatures}
                showPdfExport
                variant="bar"
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
