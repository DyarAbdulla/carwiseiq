'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Heart, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { BatchPredictionResult } from '@/lib/types'

interface ExtendedResult extends BatchPredictionResult {
  confidence_percent?: number
  price_range?: { min: number; max: number }
  deal_rating?: 'Good' | 'Fair' | 'Poor'
}

interface ExpandableRowProps {
  result: ExtendedResult
  index: number
  isFavorite: boolean
  onToggleFavorite: () => void
}

export function ExpandableRow({ result, index, isFavorite, onToggleFavorite }: ExpandableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-[#2a2d3a]/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-[#94a3b8]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#94a3b8]" />
            )}
          </Button>
        </td>
        <td className="px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className={`h-8 w-8 p-0 ${isFavorite ? 'text-red-500' : 'text-[#94a3b8]'}`}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500' : ''}`} />
          </Button>
        </td>
        {/* Rest of cells will be rendered by parent */}
      </tr>
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <td colSpan={10} className="px-4 py-4 bg-[#0f1117] border-b border-[#2a2d3a]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-[#94a3b8] mb-3">Car Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Make:</span>
                      <span className="text-white font-medium">{result.car.make}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Model:</span>
                      <span className="text-white font-medium">{result.car.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Year:</span>
                      <span className="text-white font-medium">{result.car.year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Mileage:</span>
                      <span className="text-white font-medium">
                        {result.car.mileage.toLocaleString()} km
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Condition:</span>
                      <span className="text-white font-medium">{result.car.condition}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Fuel Type:</span>
                      <span className="text-white font-medium">{result.car.fuel_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Engine Size:</span>
                      <span className="text-white font-medium">{result.car.engine_size}L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Cylinders:</span>
                      <span className="text-white font-medium">{result.car.cylinders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Location:</span>
                      <span className="text-white font-medium">{result.car.location}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#94a3b8] mb-3">Prediction Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Predicted Price:</span>
                      <span className="text-[#5B7FFF] font-bold text-lg">
                        {formatCurrency(result.predicted_price)}
                      </span>
                    </div>
                    {result.confidence_percent !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Confidence:</span>
                        <span
                          className={`font-medium ${
                            result.confidence_percent >= 80
                              ? 'text-green-500'
                              : result.confidence_percent >= 60
                              ? 'text-yellow-500'
                              : 'text-red-500'
                          }`}
                        >
                          {result.confidence_percent}%
                        </span>
                      </div>
                    )}
                    {result.price_range && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[#94a3b8]">Price Range Min:</span>
                          <span className="text-white font-medium">
                            {formatCurrency(result.price_range.min)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#94a3b8]">Price Range Max:</span>
                          <span className="text-white font-medium">
                            {formatCurrency(result.price_range.max)}
                          </span>
                        </div>
                      </>
                    )}
                    {result.deal_rating && (
                      <div className="flex justify-between">
                        <span className="text-[#94a3b8]">Deal Rating:</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            result.deal_rating === 'Good'
                              ? 'bg-green-500/20 text-green-500'
                              : result.deal_rating === 'Poor'
                              ? 'bg-red-500/20 text-red-500'
                              : 'bg-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          {result.deal_rating}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
}
