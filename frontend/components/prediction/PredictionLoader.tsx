"use client"

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

const PROGRESS_MS = 3000

export function PredictionLoader() {
  const t = useTranslations('predict.loader')
  const tips = [t('tip1'), t('tip2'), t('tip3')]
  const [currentTip, setCurrentTip] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (tips.length === 0) return
    const id = setInterval(() => {
      setCurrentTip((i) => (i + 1) % tips.length)
    }, 2000)
    return () => clearInterval(id)
  }, [tips.length])

  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const p = Math.min(100, (elapsed / PROGRESS_MS) * 100)
      setProgress(p)
      if (p >= 100) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="rounded-2xl border border-violet-500/25 bg-zinc-950/95 shadow-2xl shadow-violet-900/20 backdrop-blur-xl overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <div className="px-6 py-10 sm:px-10 sm:py-12 max-w-md mx-auto text-center">
        <motion.div
          className="mb-6 flex justify-center"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden ring-2 ring-violet-500/40 ring-offset-2 ring-offset-zinc-950">
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

        <div className="space-y-2 mb-8">
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

        <div className="min-h-[52px] flex items-center justify-center px-2">
          <AnimatePresence mode="wait">
            <motion.p
              key={currentTip}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="text-sm sm:text-base text-slate-200"
            >
              {tips[currentTip] ?? '…'}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
