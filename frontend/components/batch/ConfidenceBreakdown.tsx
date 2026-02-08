'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BatchPredictionResult } from '@/lib/types'

interface ConfidenceBreakdownProps {
  result: BatchPredictionResult
  children: React.ReactNode
}

export function ConfidenceBreakdown({ result, children }: ConfidenceBreakdownProps) {
  const confidencePercent = result.confidence_interval
    ? Math.round(
        (1 -
          (result.confidence_interval.upper - result.confidence_interval.lower) /
            result.predicted_price) *
          100
      )
    : 75

  // Simulate confidence factors (in real app, these would come from the API)
  const confidenceFactors = [
    {
      name: 'Data Completeness',
      value: 85,
      description: 'All required fields provided',
    },
    {
      name: 'Historical Accuracy',
      value: 90,
      description: 'Past predictions match actual sales',
    },
    {
      name: 'Market Data Availability',
      value: 75,
      description: 'Similar cars found in database',
    },
  ]

  const missingFields: string[] = []
  if (!result.car.condition || result.car.condition === 'Unknown') {
    missingFields.push('Service history')
  }
  if (!result.car.mileage || result.car.mileage === 0) {
    missingFields.push('Verified mileage')
  }

  const getColor = (value: number) => {
    if (value >= 80) return 'text-green-500'
    if (value >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getBgColor = (value: number) => {
    if (value >= 80) return 'bg-green-500'
    if (value >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl border-[#2a2d3a] bg-[#1a1d29]">
        <DialogHeader>
          <DialogTitle>Confidence Score Breakdown</DialogTitle>
          <DialogDescription className="text-[#94a3b8]">
            Detailed analysis of prediction confidence
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Overall Confidence */}
          <div className="text-center p-4 rounded-lg bg-[#2a2d3a] border border-[#2a2d3a]">
            <p className="text-sm text-[#94a3b8] mb-2">Overall Confidence</p>
            <p className={`text-4xl font-bold ${getColor(confidencePercent)}`}>
              {confidencePercent}%
            </p>
          </div>

          {/* Confidence Factors */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Confidence Factors</h3>
            {confidenceFactors.map((factor, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{factor.name}</p>
                    <p className="text-xs text-[#94a3b8]">{factor.description}</p>
                  </div>
                  <span className={`text-sm font-semibold ${getColor(factor.value)}`}>
                    {factor.value}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#0f1117] border border-[#2a2d3a]">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${getBgColor(factor.value)}`}
                    style={{ width: `${factor.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Missing Information Warnings */}
          {missingFields.length > 0 && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-500 mb-2">
                    Missing Information (Affects Accuracy)
                  </p>
                  <ul className="space-y-1">
                    {missingFields.map((field, index) => (
                      <li key={index} className="text-xs text-[#94a3b8]">
                        ⚠️ {field} not available (-5% confidence)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="p-4 rounded-lg bg-[#2a2d3a] border border-[#2a2d3a]">
            <p className="text-sm font-medium text-white mb-2">Suggestions to Improve Accuracy</p>
            <ul className="space-y-2 text-sm text-[#94a3b8]">
              {missingFields.includes('Service history') && (
                <li>• Add service records for +8% confidence</li>
              )}
              {missingFields.includes('Verified mileage') && (
                <li>• Verify mileage for +3% confidence</li>
              )}
              <li>• Get vehicle inspection for +5% confidence</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
