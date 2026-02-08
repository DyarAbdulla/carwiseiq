'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { X, GitCompare, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { BatchPredictionResult } from '@/lib/types'

interface ExtendedResult extends BatchPredictionResult {
  confidence_percent?: number
  deal_rating?: 'Good' | 'Fair' | 'Poor'
}

interface CompareModeProps {
  results: ExtendedResult[]
  selectedIds: Set<number>
  onSelectionChange: (id: number, selected: boolean) => void
  onClearSelection: () => void
}

export function CompareMode({
  results,
  selectedIds,
  onSelectionChange,
  onClearSelection,
}: CompareModeProps) {
  const [isComparing, setIsComparing] = useState(false)
  const selectedResults = results.filter((_, index) => selectedIds.has(index))

  if (selectedIds.size === 0) return null

  const handleCompare = () => {
    if (selectedIds.size >= 2 && selectedIds.size <= 4) {
      setIsComparing(true)
    }
  }

  if (isComparing && selectedResults.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card className="border-[#5B7FFF]/30 bg-[#1a1d29]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Compare Cars ({selectedResults.length})</CardTitle>
                <CardDescription className="text-[#94a3b8]">
                  Side-by-side comparison of selected cars
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsComparing(false)
                  onClearSelection()
                }}
                className="text-[#94a3b8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-flex gap-4 min-w-full">
                {selectedResults.map((result, idx) => (
                  <Card
                    key={idx}
                    className="min-w-[280px] border-[#2a2d3a] bg-[#0f1117]"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-white text-lg">
                          {result.car.make} {result.car.model}
                        </h3>
                        <p className="text-sm text-[#94a3b8]">{result.car.year}</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-[#94a3b8]">Price:</span>
                          <p className="text-[#5B7FFF] font-bold text-lg">
                            {formatCurrency(result.predicted_price)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[#94a3b8]">Mileage:</span>
                          <p className="text-white">{result.car.mileage.toLocaleString()} km</p>
                        </div>
                        <div>
                          <span className="text-[#94a3b8]">Condition:</span>
                          <p className="text-white">{result.car.condition}</p>
                        </div>
                        <div>
                          <span className="text-[#94a3b8]">Confidence:</span>
                          <p className="text-white">{result.confidence_percent ?? 'N/A'}%</p>
                        </div>
                        {result.deal_rating && (
                          <div>
                            <span className="text-[#94a3b8]">Deal:</span>
                            <span
                              className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <Card className="border-[#5B7FFF]/30 bg-[#1a1d29]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#5B7FFF]" />
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedIds.size} car{selectedIds.size > 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-[#94a3b8]">
                  Select 2-4 cars to compare side-by-side
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedIds.size >= 2 && selectedIds.size <= 4 && (
                <Button
                  onClick={handleCompare}
                  className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90"
                >
                  <GitCompare className="mr-2 h-4 w-4" />
                  Compare Selected
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClearSelection}
                className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
