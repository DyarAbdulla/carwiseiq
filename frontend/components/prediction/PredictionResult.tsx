"use client"

import { lazy, Suspense, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { ResultShareBar } from './ResultShareBar'

const PriceRevealCard = lazy(() => import('./PriceRevealCard').then((m) => ({ default: m.PriceRevealCard })))
const SmartDealAnalyst = lazy(() => import('./SmartDealAnalyst').then((m) => ({ default: m.SmartDealAnalyst })))
const InsightsTabs = lazy(() => import('./InsightsTabs').then((m) => ({ default: m.InsightsTabs })))
const FeedbackPrompt = lazy(() => import('./FeedbackPrompt').then((m) => ({ default: m.FeedbackPrompt })))
const AIImprovementBanner = lazy(() => import('./AIImprovementBanner').then((m) => ({ default: m.AIImprovementBanner })))

interface PredictionResultProps {
  result: PredictionResponse
  carFeatures: CarFeatures
  onUpdate?: (updates: Partial<CarFeatures>) => void
  predictionId?: number
}

export function PredictionResult({ result, carFeatures, onUpdate, predictionId }: PredictionResultProps) {
  useEffect(() => {
    void Promise.all([
      import('./PriceRevealCard'),
      import('./SmartDealAnalyst'),
      import('./InsightsTabs'),
      import('./ShareExportMenu'),
      import('./FeedbackPrompt'),
      import('./AIImprovementBanner'),
    ])
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' },
    },
  }

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 pb-28 md:pb-32"
        id="prediction-results"
      >
        <motion.div variants={itemVariants}>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PriceRevealCard
              result={result}
              carFeatures={carFeatures}
              predictionId={predictionId}
            />
          </Suspense>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <SmartDealAnalyst result={result} />
          </Suspense>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <InsightsTabs result={result} carFeatures={carFeatures} onUpdate={onUpdate} />
          </Suspense>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Suspense fallback={<Skeleton className="h-20 w-full" />}>
            <AIImprovementBanner />
          </Suspense>
        </motion.div>

        {predictionId && (
          <motion.div variants={itemVariants}>
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <FeedbackPrompt predictionId={predictionId} result={result} carFeatures={carFeatures} />
            </Suspense>
          </motion.div>
        )}
      </motion.div>

      <ResultShareBar result={result} carFeatures={carFeatures} />
    </>
  )
}
