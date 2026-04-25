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
      className="fixed bottom-0 inset-x-0 z-[5000] pointer-events-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
    >
      <div className="max-w-2xl mx-auto px-3 pb-2 pointer-events-auto">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-zinc-950/90 backdrop-blur-xl py-2.5 px-3 shadow-2xl shadow-violet-900/30">
          <Share2 className="h-4 w-4 text-violet-300 shrink-0" aria-hidden />
          <span className="text-xs text-slate-400 hidden sm:inline flex-1 truncate">{t('shareBarLabel')}</span>
          <Suspense fallback={<Skeleton className="h-9 w-40 rounded-lg" />}>
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
  )
}
