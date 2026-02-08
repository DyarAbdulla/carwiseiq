"use client"

import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface ConfidenceFactors {
  dataAvailability: { status: 'good' | 'warning' | 'poor'; count: number }
  exactMatches: { status: 'good' | 'warning' | 'poor'; count: number }
  dataRecency: { status: 'good' | 'warning' | 'poor'; daysOld: number }
}

interface ConfidenceBreakdownProps {
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  factors: ConfidenceFactors
}

export function ConfidenceBreakdown({ 
  confidence, 
  confidenceScore, 
  factors 
}: ConfidenceBreakdownProps) {
  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'good': 
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': 
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'poor': 
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getConfidenceEmoji = () => {
    switch(confidence) {
      case 'high': return '🟢'
      case 'medium': return '🟡'
      case 'low': return '🔴'
      default: return '🟡'
    }
  }

  const getConfidenceColor = () => {
    switch(confidence) {
      case 'high': return 'text-green-400 border-green-500/30 bg-green-500/10'
      case 'medium': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
      case 'low': return 'text-red-400 border-red-500/30 bg-red-500/10'
      default: return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`mt-4 p-4 rounded-lg border ${getConfidenceColor()}`}
    >
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span>{getConfidenceEmoji()}</span>
        <span>
          {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence (±{confidenceScore}%)
        </span>
      </h4>
      
      <div className="space-y-2 text-sm">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2"
        >
          {getStatusIcon(factors.dataAvailability.status)}
          <span className="text-gray-300">
            Data availability: <span className="font-medium">{factors.dataAvailability.count}</span> similar listings
          </span>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          {getStatusIcon(factors.exactMatches.status)}
          <span className="text-gray-300">
            Exact matches: <span className="font-medium">{factors.exactMatches.count}</span> identical configurations
          </span>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2"
        >
          {getStatusIcon(factors.dataRecency.status)}
          <span className="text-gray-300">
            Data recency: Updated <span className="font-medium">{factors.dataRecency.daysOld}</span> days ago
          </span>
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * Helper function to calculate confidence factors from available data
 * This is a mock implementation - in production, this would come from the backend
 */
export function calculateConfidenceFactors(
  marketComparison?: { market_average: number },
  confidenceInterval?: { lower: number; upper: number }
): ConfidenceFactors {
  // Mock calculation based on available data
  // In production, backend should provide these values
  
  // Calculate confidence score from interval
  let confidenceScore = 20.0 // Default
  if (confidenceInterval) {
    const range = confidenceInterval.upper - confidenceInterval.lower
    const avg = (confidenceInterval.upper + confidenceInterval.lower) / 2
    if (avg > 0) {
      confidenceScore = (range / avg) * 100
    }
  }

  // Mock data availability (would come from backend)
  const similarListings = marketComparison ? Math.floor(Math.random() * 50) + 20 : 15
  const exactMatches = Math.floor(similarListings * 0.3)
  const daysOld = Math.floor(Math.random() * 30) + 1

  return {
    dataAvailability: {
      status: similarListings > 30 ? 'good' : similarListings > 15 ? 'warning' : 'poor',
      count: similarListings
    },
    exactMatches: {
      status: exactMatches > 10 ? 'good' : exactMatches > 5 ? 'warning' : 'poor',
      count: exactMatches
    },
    dataRecency: {
      status: daysOld < 7 ? 'good' : daysOld < 14 ? 'warning' : 'poor',
      daysOld
    }
  }
}

/**
 * Determine confidence level from score
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score < 15) return 'high'
  if (score < 30) return 'medium'
  return 'low'
}
