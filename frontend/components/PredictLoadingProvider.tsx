"use client"

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'

interface PredictLoadingContextValue {
  loading: boolean
  setLoading: (v: boolean) => void
}

const PredictLoadingContext = createContext<PredictLoadingContextValue | null>(null)

const MIN_VISIBLE_TIME = 600 // Minimum 600ms visible time to prevent flashing

export function PredictLoadingProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('predict.loading')
  const [loading, setLoadingState] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const loadingStartTimeRef = useRef<number | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setLoading = useCallback((v: boolean) => {
    if (v) {
      // Starting loading - show immediately
      loadingStartTimeRef.current = Date.now()
      setLoadingState(true)
      setShowOverlay(true)

      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    } else {
      // Stopping loading - ensure minimum visible time
      const elapsed = loadingStartTimeRef.current ? Date.now() - loadingStartTimeRef.current : 0
      const remainingTime = Math.max(0, MIN_VISIBLE_TIME - elapsed)

      if (remainingTime > 0) {
        // Wait for minimum time before hiding
        hideTimeoutRef.current = setTimeout(() => {
          setLoadingState(false)
          setShowOverlay(false)
          loadingStartTimeRef.current = null
        }, remainingTime)
      } else {
        // Already shown for minimum time, hide immediately
        setLoadingState(false)
        setShowOverlay(false)
        loadingStartTimeRef.current = null
      }
    }
  }, [])

  const value = { loading, setLoading }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  // Manage body scroll - restore after overlay disappears
  useEffect(() => {
    if (showOverlay) {
      document.body.style.overflow = 'hidden'
    } else {
      // Small delay to ensure smooth transition
      const timeout = setTimeout(() => {
        document.body.style.overflow = ''
      }, 400)
      return () => clearTimeout(timeout)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showOverlay])

  return (
    <PredictLoadingContext.Provider value={value}>
      <div className="relative">
        {children}
        {/* Loading Background Overlay - Only shows when loading */}
        <AnimatePresence mode="wait">
          {showOverlay && (
            <motion.div
              key="loading-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="fixed inset-0 z-[9999] pointer-events-none"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
              }}
            >
              {/* Dark Gradient Overlay Layer (z-10) - Enhanced for readability */}
              <div
                className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-sm"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />

              {/* Title and Subtitle Layer (z-20) - Centered at top */}
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-16 sm:pt-20 md:pt-24">
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-center px-4"
                >
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg">
                    {t('predicting')}
                  </h2>
                  <p className="text-base sm:text-lg md:text-xl text-white/90 drop-shadow-md">
                    {t('analyzing')}
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PredictLoadingContext.Provider>
  )
}

export function usePredictLoading() {
  const ctx = useContext(PredictLoadingContext)
  return ctx ?? { loading: false, setLoading: () => { } }
}
