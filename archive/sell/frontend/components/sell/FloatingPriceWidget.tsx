"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Loader2 } from 'lucide-react'
import { calculatePriceEstimate, type PriceEstimateParams } from '@/hooks/usePriceEstimate'

interface FloatingPriceWidgetProps {
  formData: Record<string, any>
}

/**
 * Floating price preview widget
 * Shows estimated price as user fills form
 */
export function FloatingPriceWidget({ formData }: FloatingPriceWidgetProps) {
  const [price, setPrice] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  // Calculate price with 500ms debounce
  useEffect(() => {
    // Check if we have minimum required data
    const hasRequiredData = 
      formData.make &&
      formData.model &&
      formData.year &&
      formData.mileage

    if (!hasRequiredData) {
      setPrice(0)
      setShow(false)
      setLoading(false)
      return
    }

    setShow(true)
    setLoading(true)

    // Debounce calculation (500ms)
    const timer = setTimeout(() => {
      const params: PriceEstimateParams = {
        make: formData.make,
        model: formData.model,
        year: formData.year,
        mileage: formData.mileage,
        condition: formData.condition,
        has_accident: formData.has_accident,
        premium_features: formData.premium_features,
        location: formData.location,
      }

      const estimatedPrice = calculatePriceEstimate(params)
      setPrice(estimatedPrice)
      setLoading(false)
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [
    formData.make,
    formData.model,
    formData.year,
    formData.mileage,
    formData.condition,
    formData.has_accident,
    formData.premium_features,
    formData.location,
  ])

  if (!show || price === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-32 right-6 z-40 hidden md:block"
    >
      <div className="bg-[#1a1d29] border border-[#2a2d3a] rounded-lg shadow-xl p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-[#5B7FFF]" />
          <span className="text-xs text-[#94a3b8] uppercase tracking-wide">
            Estimated Price
          </span>
        </div>
        
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#5B7FFF]" />
            <div className="h-8 bg-[#0f1117] rounded w-24 animate-pulse" />
          </div>
        ) : (
          <PriceDisplay value={price} />
        )}
      </div>
    </motion.div>
  )
}

/**
 * Mobile banner version
 */
export function FloatingPriceWidgetMobile({ formData }: FloatingPriceWidgetProps) {
  const [price, setPrice] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const hasRequiredData = 
      formData.make &&
      formData.model &&
      formData.year &&
      formData.mileage

    if (!hasRequiredData) {
      setPrice(0)
      setShow(false)
      return
    }

    setShow(true)
    setLoading(true)

    const timer = setTimeout(() => {
      const params: PriceEstimateParams = {
        make: formData.make,
        model: formData.model,
        year: formData.year,
        mileage: formData.mileage,
        condition: formData.condition,
        has_accident: formData.has_accident,
        premium_features: formData.premium_features,
        location: formData.location,
      }

      const estimatedPrice = calculatePriceEstimate(params)
      setPrice(estimatedPrice)
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [
    formData.make,
    formData.model,
    formData.year,
    formData.mileage,
    formData.condition,
    formData.has_accident,
    formData.premium_features,
    formData.location,
  ])

  if (!show || price === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-20 left-0 right-0 z-40 md:hidden px-4"
    >
      <div className="bg-[#1a1d29] border border-[#2a2d3a] rounded-lg shadow-xl p-3 mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#5B7FFF]" />
            <span className="text-xs text-[#94a3b8] uppercase">
              Estimated Price
            </span>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#5B7FFF]" />
          ) : (
            <span className="text-lg font-bold text-white">
              ${price.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Animated price display with counting effect
 */
function PriceDisplay({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const duration = 800 // ms
    const steps = 30
    const increment = value / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [value])

  return (
    <motion.div
      key={value}
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      className="text-2xl font-bold text-white"
    >
      ${displayValue.toLocaleString()}
    </motion.div>
  )
}

// Legacy export for backward compatibility
export async function estimatePrice(formData: Record<string, any>): Promise<number | null> {
  const params: PriceEstimateParams = {
    make: formData.make,
    model: formData.model,
    year: formData.year,
    mileage: formData.mileage,
    condition: formData.condition,
    has_accident: formData.has_accident,
    premium_features: formData.premium_features,
    location: formData.location,
  }
  
  const price = calculatePriceEstimate(params)
  return price > 0 ? price : null
}