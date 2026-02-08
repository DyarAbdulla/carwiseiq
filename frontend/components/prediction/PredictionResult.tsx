"use client"

import { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import type { PredictionResponse, CarFeatures } from '@/lib/types'

// Lazy load components
const PriceRevealCard = lazy(() => import('./PriceRevealCard').then(mod => ({ default: mod.PriceRevealCard })))
const SmartDealAnalyst = lazy(() => import('./SmartDealAnalyst').then(mod => ({ default: mod.SmartDealAnalyst })))
const InsightsTabs = lazy(() => import('./InsightsTabs').then(mod => ({ default: mod.InsightsTabs })))
const ShareExportMenu = lazy(() => import('./ShareExportMenu').then(mod => ({ default: mod.ShareExportMenu })))
const FeedbackPrompt = lazy(() => import('./FeedbackPrompt').then(mod => ({ default: mod.FeedbackPrompt })))
const AIImprovementBanner = lazy(() => import('./AIImprovementBanner').then(mod => ({ default: mod.AIImprovementBanner })))

interface PredictionResultProps {
  result: PredictionResponse
  carFeatures: CarFeatures
  onUpdate?: (updates: Partial<CarFeatures>) => void
  predictionId?: number  // ID from backend after saving prediction
}

export function PredictionResult({ result, carFeatures, onUpdate, predictionId }: PredictionResultProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      id="prediction-results"
    >
      {/* Magic Moment: Price Reveal Card */}
      <motion.div variants={itemVariants}>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <PriceRevealCard
            result={result}
            carFeatures={carFeatures}
            predictionId={predictionId}
          />
        </Suspense>
      </motion.div>

      {/* Smart Deal Analyst - Main Dashboard */}
      <motion.div variants={itemVariants}>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <SmartDealAnalyst result={result} />
        </Suspense>
      </motion.div>

      {/* Additional Export Options */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <Suspense fallback={<Skeleton className="h-10 w-full sm:w-auto" />}>
          <ShareExportMenu result={result} carFeatures={carFeatures} showPdfExport={false} />
        </Suspense>
      </motion.div>

      {/* Insights Tabs */}
      <motion.div variants={itemVariants}>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <InsightsTabs
            result={result}
            carFeatures={carFeatures}
            onUpdate={onUpdate}
          />
        </Suspense>
      </motion.div>

      {/* AI Improvement Banner */}
      <motion.div variants={itemVariants}>
        <Suspense fallback={<Skeleton className="h-20 w-full" />}>
          <AIImprovementBanner />
        </Suspense>
      </motion.div>

      {/* Feedback Prompt */}
      {predictionId && (
        <motion.div variants={itemVariants}>
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <FeedbackPrompt
              predictionId={predictionId}
              result={result}
              carFeatures={carFeatures}
            />
          </Suspense>
        </motion.div>
      )}
    </motion.div>
  )
}

