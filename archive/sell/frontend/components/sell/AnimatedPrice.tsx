"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

interface AnimatedPriceProps {
  value: number
  className?: string
  duration?: number
}

export function AnimatedPrice({ value, className = '', duration = 1500 }: AnimatedPriceProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const steps = 60
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
  }, [value, duration])

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200 }}
      className={className}
    >
      {formatCurrency(displayValue)}
    </motion.span>
  )
}
