"use client"

import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Share2, Bookmark, Check } from 'lucide-react'
import confetti from 'canvas-confetti'
import type { CreateTypes } from 'canvas-confetti'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { apiClient } from '@/lib/api'
import { activityHelpers } from '@/lib/activityLogger'

interface PriceRevealCardProps {
  result: PredictionResponse
  carFeatures: CarFeatures
  predictionId?: number
}

// Count-up animation hook
function useCountUp(endValue: number, duration: number = 1500) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    setIsAnimating(true)
    setDisplayValue(0)

    const startTime = Date.now()
    const startValue = 0

    // EaseOutExpo function
    const easeOutExpo = (t: number): number => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
    }

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

export function PriceRevealCard({ result, carFeatures, predictionId }: PriceRevealCardProps) {
  const { displayValue, isAnimating } = useCountUp(result.predicted_price, 1500)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confettiTriggered, setConfettiTriggered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const locale = useLocale()

  const low = result.confidence_interval?.lower ?? result.predicted_price * 0.85
  const high = result.confidence_interval?.upper ?? result.predicted_price * 1.15

  // Calculate confidence percentage
  const confidencePercent = result.confidence_level === 'high' ? 98 :
    result.confidence_level === 'medium' ? 85 : 72

  // Trigger confetti when animation completes
  useEffect(() => {
    if (!isAnimating && !confettiTriggered && displayValue === result.predicted_price) {
      setConfettiTriggered(true)

      // Trigger confetti burst from center
      const duration = 3000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
          colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']
        } as CreateTypes.Options)
      }, 250)

      return () => clearInterval(interval)
    }
  }, [isAnimating, confettiTriggered, displayValue, result.predicted_price])

  // Shine effect animation
  const shineX = useMotionValue(-100)
  const shineSpring = useSpring(shineX, {
    stiffness: 50,
    damping: 30,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      shineX.set(100)
      setTimeout(() => shineX.set(-100), 2000)
    }, 4000)

    return () => clearInterval(interval)
  }, [shineX])

  const handleShare = async () => {
    const shareText = `🚗 ${carFeatures.year} ${carFeatures.make} ${carFeatures.model}\n💰 Predicted Price: ${formatCurrency(result.predicted_price)}\n\nCheck out CarWiseIQ for accurate car price predictions!`
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Car Price Prediction',
          text: shareText,
          url: shareUrl,
        })
        toast({
          title: 'Shared!',
          description: 'Prediction shared successfully',
        })
      } catch (error: any) {
        // User cancelled or error occurred
        if (error.name !== 'AbortError') {
          // Fallback to clipboard
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
            toast({
              title: 'Copied!',
              description: 'Prediction link copied to clipboard',
            })
          }
        }
      }
    } else {
      // Fallback to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
        toast({
          title: 'Copied!',
          description: 'Prediction link copied to clipboard',
        })
      }
    }
  }

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please login to save predictions to your history',
        variant: 'destructive',
      })
      router.push(`/${locale}/login`)
      return
    }

    setSaving(true)
    try {
      // If predictionId exists, it's already saved
      if (predictionId) {
        setSaved(true)
        toast({
          title: 'Already Saved',
          description: 'This prediction is already in your history',
        })
        setTimeout(() => setSaved(false), 3000)
        return
      }

      // Save to localStorage as fallback
      const savedPredictions = JSON.parse(localStorage.getItem('saved_predictions') || '[]')
      const predictionData = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        carFeatures,
        result,
        displayName: `${carFeatures.year} ${carFeatures.make} ${carFeatures.model}`,
      }
      savedPredictions.unshift(predictionData)
      localStorage.setItem('saved_predictions', JSON.stringify(savedPredictions.slice(0, 50)))

      // Log activity
      activityHelpers.logPredictionSaved(predictionData.id)

      setSaved(true)
      toast({
        title: 'Saved!',
        description: 'Prediction saved to your history',
      })

      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save prediction',
        variant: 'destructive',
      })
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
      className="relative overflow-hidden"
    >
      {/* Glass Certificate Card */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
        {/* Shine Effect */}
        <motion.div
          style={{
            x: useTransform(shineSpring, (value) => `${value}%`),
          }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none z-10"
        />

        {/* Top: Car Make/Model */}
        <div className="text-center mb-8">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl md:text-3xl font-bold text-white mb-2"
          >
            {carFeatures.year} {carFeatures.make} {carFeatures.model}
            {carFeatures.trim && ` ${carFeatures.trim}`}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-slate-400 text-sm"
          >
            Predicted Market Value
          </motion.p>
        </div>

        {/* Center: Big Predicted Price with Count-Up */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative inline-block"
          >
            <div
              className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 30px rgba(16, 185, 129, 0.5))',
                textShadow: '0 0 40px rgba(59, 130, 246, 0.6)',
              }}
            >
              {formatCurrency(displayValue)}
            </div>

            {/* Glow effect pulsing */}
            {isAnimating && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-emerald-400/30 via-indigo-400/30 to-purple-400/30 blur-2xl -z-10"
                animate={{
                  opacity: [0.5, 0.8, 0.5],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
          </motion.div>

          {/* Confidence Range */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="text-slate-400 text-sm md:text-base mt-4"
          >
            Range: {formatCurrency(low)} - {formatCurrency(high)}
          </motion.p>
        </div>

        {/* Bottom: Confidence Score Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="space-y-4"
        >
          {/* Confidence Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Confidence Score</span>
              <span className="text-emerald-400 font-semibold">{confidencePercent}% Accurate</span>
            </div>
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidencePercent}%` }}
                transition={{ delay: 1.5, duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 rounded-full relative overflow-hidden"
              >
                {/* Shimmer on confidence bar */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              </motion.div>
            </div>
          </div>

          {/* Date */}
          <p className="text-center text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </motion.div>
      </div>

      {/* Share Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.5 }}
        className="flex flex-col sm:flex-row gap-3 mt-6"
      >
        <Button
          onClick={handleShare}
          className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 font-semibold"
        >
          <Share2 className="h-5 w-5 mr-2" />
          Share Result
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || saved}
          variant="outline"
          className="flex-1 h-12 border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold"
        >
          {saved ? (
            <>
              <Check className="h-5 w-5 mr-2" />
              Saved!
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
              {saving ? 'Saving...' : 'Save to History'}
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  )
}
