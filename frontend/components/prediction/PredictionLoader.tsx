"use client"

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'

const STEP_INTERVAL_MS = 1800

export function PredictionLoader() {
  const t = useTranslations('predict.loader')
  const steps = [
    t('step1'),
    t('step2'),
    t('step3'),
    t('step4'),
  ]
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (steps.length === 0) return
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length)
    }, STEP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [steps.length])

  useEffect(() => {
    const start = Date.now()
    const duration = Math.max(STEP_INTERVAL_MS * steps.length, 8000)
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const p = Math.min(100, (elapsed / duration) * 100)
      setProgress(p)
      if (p >= 100) clearInterval(id)
    }, 40)
    return () => clearInterval(id)
  }, [steps.length])

  return (
    <div
      className="rounded-2xl border border-violet-500/25 bg-zinc-950/95 shadow-2xl shadow-violet-900/20 backdrop-blur-xl overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <div className="px-5 py-8 sm:px-10 sm:py-10 max-w-lg mx-auto text-center">
        <motion.div
          className="mb-5 flex justify-center"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden ring-2 ring-violet-500/40 ring-offset-2 ring-offset-zinc-950">
            <Image
              src="/carwiseiq-logo.jpg"
              alt=""
              width={96}
              height={96}
              className="object-cover w-full h-full"
              priority
            />
            <div className="absolute inset-0 bg-violet-500/20 pointer-events-none animate-pulse" />
          </div>
        </motion.div>

        <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('title')}</h3>
        <p className="text-sm text-violet-200/80 mb-6">{t('subtitle')}</p>

        <div className="space-y-2 mb-6">
          <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500"
              style={{ width: `${progress}%` }}
              layout
            />
          </div>
          <div className="flex justify-between text-xs text-violet-200/90">
            <span>{t('progress')}</span>
            <span className="font-semibold text-white tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="min-h-[56px] flex items-center justify-center px-2 mb-8">
          <AnimatePresence mode="wait">
            <motion.p
              key={steps[stepIndex] ?? stepIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="text-sm sm:text-base text-slate-100 font-medium"
            >
              {steps[stepIndex] ?? '…'}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-start">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-3 space-y-2">
            <Skeleton className="h-3 w-2/3 bg-white/10" />
            <Skeleton className="h-6 w-full bg-violet-500/15" />
            <Skeleton className="h-2 w-full bg-white/10" />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-3 space-y-2">
            <Skeleton className="h-3 w-1/2 bg-white/10" />
            <Skeleton className="h-6 w-4/5 bg-indigo-500/15" />
            <Skeleton className="h-2 w-full bg-white/10" />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-3 space-y-2">
            <Skeleton className="h-3 w-3/4 bg-white/10" />
            <Skeleton className="h-6 w-full bg-fuchsia-500/15" />
            <Skeleton className="h-2 w-4/5 bg-white/10" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-4">{t('skeletonCaption')}</p>
      </div>
    </div>
  )
}
