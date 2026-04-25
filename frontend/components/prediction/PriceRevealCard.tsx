"use client"

import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { safeText, safeNumber } from '@/lib/safeDisplay'
import {
  formatCurrency,
  formatApproxIqdFromUsd,
  normalizeConfidencePercentForDisplay,
  confidencePercentFromInterval,
} from '@/lib/utils'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Bookmark, Check, Copy } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { activityHelpers } from '@/lib/activityLogger'

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

function useCountUp(endValue: number, duration: number = 1500) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    setIsAnimating(true)
    setDisplayValue(0)
    const startTime = Date.now()
    const startValue = 0
    const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutExpo(progress)
      const currentValue = Math.floor(startValue + (endValue - startValue) * easedProgress)
      setDisplayValue(currentValue)
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
        setIsAnimating(false)
      }
    }
    requestAnimationFrame(animate)
  }, [endValue, duration])

  return { displayValue, isAnimating }
}

interface PriceRevealCardProps {
  result: PredictionResponse
  carFeatures: CarFeatures
  predictionId?: number
}

export function PriceRevealCard({ result, carFeatures, predictionId }: PriceRevealCardProps) {
  const t = useTranslations('predict.result')
  const predicted = safeNumber(result.predicted_price, 0)
  const { displayValue, isAnimating } = useCountUp(predicted, 1500)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confettiTriggered, setConfettiTriggered] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const locale = useLocale()

  const low = result.confidence_interval?.lower ?? predicted * 0.85
  const high = result.confidence_interval?.upper ?? predicted * 1.15
  const span = Math.max(high - low, 1)
  const priceMarkerPct = Math.min(100, Math.max(0, ((predicted - low) / span) * 100))

  const confidencePercent = Math.min(
    100,
    Math.max(
      0,
      normalizeConfidencePercentForDisplay(result.confidence_percent) ??
        confidencePercentFromInterval(predicted, result.confidence_interval) ??
        (result.confidence_level === 'high' ? 92 : result.confidence_level === 'medium' ? 82 : 65)
    )
  )

  const luxuryNote =
    result.luxury_reference_note?.trim() || t('defaultLuxuryNote')

  useEffect(() => {
    if (!isAnimating && !confettiTriggered && displayValue === predicted) {
      setConfettiTriggered(true)
      const duration = 3000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now()
        if (timeLeft <= 0) {
          return clearInterval(interval)
        }
        const particleCount = 50 * (timeLeft / duration)
        void confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
          colors: ['#10b981', '#3b82f6', '#8b5cf6', '#a78bfa', '#f59e0b', '#ef4444'],
        })
      }, 250)
      return () => clearInterval(interval)
    }
  }, [isAnimating, confettiTriggered, displayValue, predicted])

  const shineX = useMotionValue(-100)
  const shineSpring = useSpring(shineX, { stiffness: 50, damping: 30 })
  useEffect(() => {
    const interval = setInterval(() => {
      shineX.set(100)
      setTimeout(() => shineX.set(-100), 2000)
    }, 4000)
    return () => clearInterval(interval)
  }, [shineX])
  const shineXPercent = useTransform(shineSpring, (value) => `${value}%`)

  const copyMainPrice = async () => {
    try {
      await navigator.clipboard.writeText(formatCurrency(predicted))
      setCopied(true)
      toast({ title: t('copyPriceTitle'), description: t('copyPriceDescription') })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: t('errorTitle'), description: t('copyFailed'), variant: 'destructive' })
    }
  }

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast({
        title: t('loginRequired'),
        description: t('loginToSave'),
        variant: 'destructive',
      })
      router.push(`/${locale}/login`)
      return
    }

    setSaving(true)
    try {
      if (predictionId) {
        setSaved(true)
        toast({ title: t('alreadySavedTitle'), description: t('alreadySavedDescription') })
        setTimeout(() => setSaved(false), 3000)
        return
      }

      const savedPredictions = JSON.parse(localStorage.getItem('saved_predictions') || '[]')
      const predictionData = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        carFeatures,
        result,
        displayName: `${safeText(carFeatures.year)} ${safeText(carFeatures.make)} ${safeText(carFeatures.model)}`,
      }
      savedPredictions.unshift(predictionData)
      localStorage.setItem('saved_predictions', JSON.stringify(savedPredictions.slice(0, 50)))
      activityHelpers.logPredictionSaved(predictionData.id)
      setSaved(true)
      toast({ title: t('savedTitle'), description: t('savedDescription') })
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast({ title: t('errorTitle'), description: t('saveFailed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden pb-4"
    >
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
        <motion.div
          style={{ x: shineXPercent }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12 pointer-events-none z-10"
        />

        <div className="absolute inset-0 -z-0 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-indigo-600/20 opacity-90" />
        <div className="absolute inset-0 -z-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-900/30" />

        <div className="text-center mb-6 relative z-[1]">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl md:text-3xl font-bold text-white mb-1"
          >
            {safeText(carFeatures.year)} {safeText(carFeatures.make)} {safeText(carFeatures.model)}
            {carFeatures.trim && carFeatures.trim !== '__none__' ? ` ${safeText(carFeatures.trim)}` : ''}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-slate-400 text-sm"
          >
            {t('predictedMarketValue')}
          </motion.p>
        </div>

        <div className="text-center mb-6 relative z-[1]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative inline-flex flex-col items-center gap-1"
          >
            <div className="relative rounded-2xl px-4 py-3 md:px-6 md:py-4 overflow-hidden min-w-[min(100%,20rem)]">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-violet-500/25 to-fuchsia-500/30 opacity-60 blur-2xl" />
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139, 92, 246, 0.45) 0%, transparent 60%)',
                }}
              />
              <div className="relative flex items-center justify-center gap-2 flex-wrap">
                <div
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight"
                  style={{
                    background: 'linear-gradient(135deg, #2dd4bf 0%, #3b82f6 40%, #a78bfa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 0 24px rgba(34, 211, 238, 0.45))',
                  }}
                >
                  {formatCurrency(displayValue)}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={copyMainPrice}
                  className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 shrink-0"
                  aria-label={t('copyPriceAria')}
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-violet-100/95 tabular-nums mt-1 drop-shadow">
              ≈ {formatApproxIqdFromUsd(displayValue)}
            </p>
            {isAnimating && (
              <motion.div
                className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-400/20 via-indigo-400/25 to-purple-400/20 blur-3xl"
                animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </motion.div>

          <div className="mt-5 max-w-lg mx-auto text-left sm:text-center space-y-2">
            <p className="text-xs text-slate-500 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span className="text-slate-400">{t('rangeLow')}</span>
              <span className="font-mono text-slate-300">{formatCurrency(low)}</span>
              <span className="text-slate-600">←</span>
              <span className="text-cyan-300/90 font-medium">{t('rangeEstimate')}</span>
              <span className="text-slate-600">→</span>
              <span className="text-slate-400">{t('rangeHigh')}</span>
              <span className="font-mono text-slate-300">{formatCurrency(high)}</span>
            </p>
            <div
              className="relative h-2.5 rounded-full bg-slate-800/80 border border-white/10 overflow-hidden"
              role="img"
              aria-label={t('rangeBarAria')}
            >
              <div
                className="absolute top-0 bottom-0 start-0 bg-slate-600/20 rounded-full"
                style={{ width: `${100}%` }}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-300 to-violet-500 shadow-lg shadow-cyan-500/40 border-2 border-white/90"
                style={{ left: `${priceMarkerPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">{t('rangeBarCaption')}</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="space-y-4 relative z-[1]"
        >
          {result.luxury_adjusted ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95 leading-snug">
              {safeText(luxuryNote)}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{t('confidenceScore')}</span>
              <span className="text-violet-300 font-semibold">
                {t('confidenceAccurate', { n: Math.round(confidencePercent) })}
              </span>
            </div>
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidencePercent}%` }}
                transition={{ delay: 1.5, duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 rounded-full"
              />
            </div>
          </div>
          <p className="text-center text-xs text-slate-500">
            {new Date().toLocaleDateString(locale === 'ku' || locale === 'ar' ? 'ar-IQ' : 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.5 }}
        className="mt-4"
      >
        <Button
          onClick={handleSave}
          disabled={saving || saved}
          variant="outline"
          className="w-full h-12 border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold"
        >
          {saved ? (
            <>
              <Check className="h-5 w-5 mr-2" />
              {t('savedState')}
            </>
          ) : (
            <>
              {saving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="inline-block"
                >
                  <Bookmark className="h-5 w-5 mr-2 inline-block" />
                </motion.div>
              ) : (
                <Bookmark className="h-5 w-5 mr-2" />
              )}
              {saving ? t('saving') : t('saveToHistory')}
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  )
}
