"use client"

import { lazy, Suspense, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { cn } from '@/lib/utils'

const SHOW_SIMILAR_CARS_TAB = false

const DealScoreBadge = lazy(() => import('./DealScoreBadge').then(mod => ({ default: mod.DealScoreBadge })))
const MarketComparison = lazy(() => import('./MarketComparison').then(mod => ({ default: mod.MarketComparison })))
const SimilarCarsPreview = lazy(() => import('./SimilarCarsPreview').then(mod => ({ default: mod.SimilarCarsPreview })))
const PriceHistoryChart = lazy(() => import('./PriceHistoryChart').then(mod => ({ default: mod.PriceHistoryChart })))
const WhatIfScenarios = lazy(() => import('./WhatIfScenarios').then(mod => ({ default: mod.WhatIfScenarios })))
const ShareExportMenu = lazy(() => import('./ShareExportMenu').then(mod => ({ default: mod.ShareExportMenu })))

interface InsightsTabsProps {
  result: PredictionResponse
  carFeatures: CarFeatures
  onUpdate?: (updates: Partial<CarFeatures>) => void
}

const tabTransition =
  'transition-all duration-200 ease-out data-[state=active]:!bg-transparent data-[state=active]:!shadow-none data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-violet-500 data-[state=inactive]:text-[#94a3b8] data-[state=inactive]:border-b-2 data-[state=inactive]:border-transparent'

export function InsightsTabs({ result, carFeatures, onUpdate }: InsightsTabsProps) {
  const t = useTranslations('predict.result')
  const [tab, setTab] = useState('overview')

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabsList
          className={cn(
            `inline-flex w-full sm:grid ${SHOW_SIMILAR_CARS_TAB ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} border-[#2a2d3a] bg-[#1a1d29] mb-4 min-w-max sm:min-w-0 h-auto p-1 gap-0 rounded-xl`
          )}
        >
          <TabsTrigger value="overview" className={cn('rounded-lg py-2.5 px-2 sm:px-3', tabTransition)}>
            <span className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <span aria-hidden className="select-none">📊</span>
              {t('overview')}
            </span>
          </TabsTrigger>
          {SHOW_SIMILAR_CARS_TAB && (
            <TabsTrigger value="similar" className={cn('rounded-lg py-2.5 px-2 sm:px-3', tabTransition)}>
              <span className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">{t('similarCars')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className={cn('rounded-lg py-2.5 px-2 sm:px-3', tabTransition)}>
            <span className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <span aria-hidden className="select-none">📈</span>
              {t('history')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="whatif" className={cn('rounded-lg py-2.5 px-2 sm:px-3', tabTransition)}>
            <span className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <span aria-hidden className="select-none">🎯</span>
              {t('whatIf')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="export" className={cn('rounded-lg py-2.5 px-2 sm:px-3', tabTransition)}>
            <span className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <span aria-hidden className="select-none">📤</span>
              {t('export')}
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="overview"
        className="mt-4 focus-visible:outline-none data-[state=inactive]:hidden"
      >
        <div
          className={cn(
            'space-y-4 transition-opacity duration-200',
            tab === 'overview' ? 'opacity-100' : 'opacity-0'
          )}
        >
          {result.deal_score && result.market_comparison && (
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <div className="space-y-4">
                <DealScoreBadge
                  dealScore={result.deal_score}
                  marketAverage={result.market_comparison.market_average}
                />
                <MarketComparison
                  marketComparison={result.market_comparison}
                  precision={result.precision}
                />
              </div>
            </Suspense>
          )}
        </div>
      </TabsContent>

      {SHOW_SIMILAR_CARS_TAB && (
        <TabsContent value="similar" className="mt-4 focus-visible:outline-none data-[state=inactive]:hidden">
          {result.similar_cars && result.similar_cars.length > 0 ? (
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <SimilarCarsPreview cars={result.similar_cars} />
            </Suspense>
          ) : (
            <Card className="border-[#2a2d3a] bg-[#1a1d29] p-6">
              <p className="text-center text-[#94a3b8]">{t('noSimilarCarsFound')}</p>
            </Card>
          )}
        </TabsContent>
      )}

      <TabsContent
        value="history"
        className="mt-4 focus-visible:outline-none data-[state=inactive]:hidden min-h-[200px] transition-opacity duration-200"
      >
        {tab === 'history' && (
          <>
            {result.market_trends && result.market_trends.length > 0 ? (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <PriceHistoryChart trends={result.market_trends} />
              </Suspense>
            ) : (
              <Card className="border-[#2a2d3a] bg-[#1a1d29] p-6">
                <p className="text-center text-[#94a3b8]">{t('noHistoricalData')}</p>
              </Card>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent
        value="whatif"
        className="mt-4 focus-visible:outline-none data-[state=inactive]:hidden min-h-[200px] transition-opacity duration-200"
      >
        {tab === 'whatif' && (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <WhatIfScenarios
              initialFeatures={carFeatures}
              initialPrediction={result}
              onUpdate={onUpdate}
            />
          </Suspense>
        )}
      </TabsContent>

      <TabsContent value="export" className="mt-4 focus-visible:outline-none data-[state=inactive]:hidden">
        <div className="space-y-4 transition-opacity duration-200">
          <Card className="border-[#2a2d3a] bg-[#1a1d29] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('exportShareOptions')}</h3>
            <Suspense fallback={<Skeleton className="h-10 w-full" />}>
              <ShareExportMenu result={result} carFeatures={carFeatures} showPdfExport={false} />
            </Suspense>
            <p className="text-sm text-[#94a3b8] mt-4">{t('exportDescription')}</p>
            <p className="text-xs text-violet-300/80 mt-2">{t('exportHintBar')}</p>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}
