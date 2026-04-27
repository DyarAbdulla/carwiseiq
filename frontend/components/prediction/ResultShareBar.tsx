"use client"

import { lazy, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const ShareExportMenu = lazy(() =>
  import('./ShareExportMenu').then((m) => ({ default: m.ShareExportMenu }))
)

interface ResultShareBarProps {
  result: PredictionResponse
  carFeatures: CarFeatures
}

export function ResultShareBar({ result, carFeatures }: ResultShareBarProps) {
  const t = useTranslations('predict.result')

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[5000] max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
    >
      <div className="max-w-2xl mx-auto px-3 pb-2 max-md:pb-1 pointer-events-auto">
        <div className="flex items-center max-md:justify-stretch md:justify-center gap-0 md:gap-2 rounded-2xl border border-white/15 bg-zinc-950/90 backdrop-blur-xl max-md:py-2 max-md:px-2 md:py-2.5 md:px-3 shadow-2xl shadow-violet-900/30 min-w-0">
          <Share2
            className="h-4 w-4 text-violet-300 shrink-0 hidden md:block"
            aria-hidden
          />
          <span className="text-xs text-slate-400 hidden md:inline flex-1 min-w-0 truncate">
            {t('shareBarLabel')}
          </span>
          <div className="w-full min-w-0 md:w-auto shrink-0 [&_button]:w-full md:[&_button]:w-auto max-md:[&_button]:justify-center">
            <Suspense fallback={<Skeleton className="h-9 w-full max-w-md md:w-40 md:shrink-0 rounded-lg mx-auto" />}>
              <ShareExportMenu
                result={result}
                carFeatures={carFeatures}
                showPdfExport={false}
                variant="bar"
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
