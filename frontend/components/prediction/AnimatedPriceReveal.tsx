"use client"

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'

interface AnimatedPriceRevealProps {
  price: number
  className?: string
}

export function AnimatedPriceReveal({ price, className }: AnimatedPriceRevealProps) {
  const [displayPrice, setDisplayPrice] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    setIsAnimating(true)
    setDisplayPrice(0)
    
    const duration = 1500 // 1.5 seconds
    const steps = 60
    const increment = price / steps
    const stepDuration = duration / steps
    
    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      const newPrice = Math.min(price, increment * currentStep)
      setDisplayPrice(newPrice)
      
      if (currentStep >= steps) {
        setDisplayPrice(price)
        setIsAnimating(false)
        clearInterval(timer)
      }
    }, stepDuration)
    
    return () => clearInterval(timer)
  }, [price])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <motion.div
        animate={isAnimating ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.3, repeat: isAnimating ? Infinity : 0, repeatDelay: 0.2 }}
        className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-500 bg-clip-text text-transparent"
      >
        {formatCurrency(displayPrice)}
      </motion.div>
    </motion.div>
  )
}






