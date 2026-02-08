"use client"

import { lazy, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import type { PredictionResponse, CarFeatures } from '@/lib/types'

// Feature flag: Set to true to show Similar Cars tab, false to hide it
const SHOW_SIMILAR_CARS_TAB = false

// Lazy load components
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

export function InsightsTabs({ result, carFeatures, onUpdate }: InsightsTabsProps) {
  const t = useTranslations('predict.result')
  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabsList className={`inline-flex w-full sm:grid ${SHOW_SIMILAR_CARS_TAB ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} border-[#2a2d3a] bg-[#1a1d29] mb-4 min-w-max sm:min-w-0`}>
          <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap">{t('overview')}</TabsTrigger>
          {SHOW_SIMILAR_CARS_TAB && (
            <TabsTrigger value="similar" className="text-xs sm:text-sm whitespace-nowrap">{t('similarCars')}</TabsTrigger>
          )}
          <TabsTrigger value="history" className="text-xs sm:text-sm whitespace-nowrap">{t('history')}</TabsTrigger>
          <TabsTrigger value="whatif" className="text-xs sm:text-sm whitespace-nowrap">{t('whatIf')}</TabsTrigger>
          <TabsTrigger value="export" className="text-xs sm:text-sm whitespace-nowrap">{t('export')}</TabsTrigger>
        </TabsList>
      </div>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4 mt-4">
        {/* Deal Score + Market Comparison (compact) */}
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
      </TabsContent>

      {/* Similar Cars Tab - Hidden when SHOW_SIMILAR_CARS_TAB is false */}
      {SHOW_SIMILAR_CARS_TAB && (
        <TabsContent value="similar" className="mt-4">
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

      {/* History Tab */}
      <TabsContent value="history" className="mt-4">
        {result.market_trends && result.market_trends.length > 0 ? (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PriceHistoryChart trends={result.market_trends} />
          </Suspense>
        ) : (
          <Card className="border-[#2a2d3a] bg-[#1a1d29] p-6">
            <p className="text-center text-[#94a3b8]">{t('noHistoricalData')}</p>
          </Card>
        )}
      </TabsContent>

      {/* What-If Tab */}
      <TabsContent value="whatif" className="mt-4">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <WhatIfScenarios
            initialFeatures={carFeatures}
            initialPrediction={result}
            onUpdate={onUpdate}
          />
        </Suspense>
      </TabsContent>

      {/* Export Tab */}
      <TabsContent value="export" className="mt-4">
        <Card className="border-[#2a2d3a] bg-[#1a1d29] p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">{t('exportShareOptions')}</h3>
            <Suspense fallback={<Skeleton className="h-10 w-full" />}>
              <ShareExportMenu result={result} carFeatures={carFeatures} showPdfExport={false} />
            </Suspense>
            <p className="text-sm text-[#94a3b8] mt-4">
              {t('exportDescription')}
            </p>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
