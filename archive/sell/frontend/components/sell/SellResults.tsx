"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import type { SellCarResponse } from '@/lib/types'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Lightbulb, DollarSign, Star, Download, Mail, Share2, ArrowLeft, AlertTriangle, FileText, Printer, Link as LinkIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useState, useEffect } from 'react'
import { validatePrediction, logSuspiciousPrediction } from '@/lib/predictionValidation'
import { formatCurrency } from '@/lib/utils'
import { ConfidenceBreakdown, calculateConfidenceFactors, getConfidenceLevel } from './ConfidenceBreakdown'
import { WhyThisPriceEnhanced } from './WhyThisPriceEnhanced'
import { SmartAlerts } from './SmartAlerts'
import { MarketInsights } from './MarketInsights'
import { WhatIfScenariosEnhanced } from './WhatIfScenariosEnhanced'
import { PredictionHistory } from './PredictionHistory'
import { AnimatedPrice } from './AnimatedPrice'

interface SellResultsProps {
  result: SellCarResponse
}

function AdjustmentRow({ name, amount, reason }: { name: string; amount: number; reason?: string }) {
  const isPositive = amount > 0
  const isNegative = amount < 0
  const Icon = isPositive ? TrendingUp : TrendingDown
  const color = isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-white/60'
  const bgColor = isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : isNegative ? 'bg-red-500/10 border-red-500/20' : 'bg-white/[0.02] border-white/10'

  return (
    <div className={`flex items-start justify-between p-3 rounded-lg border backdrop-blur-sm ${bgColor}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
        <div>
          <span className="text-white font-medium">{name}</span>
          {reason && <p className="text-sm text-white/50 mt-0.5">{reason}</p>}
        </div>
      </div>
      <span className={`font-semibold ${color}`}>
        {isPositive ? '+' : ''}{amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
      </span>
    </div>
  )
}

export function SellResults({ result }: SellResultsProps) {
  const { toast } = useToast()
  const {
    base_price,
    final_price,
    adjustments,
    recommendations,
    recommended_prices,
    confidence_interval,
    condition_analysis,
    market_comparison
  } = result
  const totalAdjustment = final_price - base_price
  const adjustmentPercent = ((totalAdjustment / base_price) * 100).toFixed(1)
  const confidencePercentage = confidence_interval
    ? ((final_price - confidence_interval.lower) / (confidence_interval.upper - confidence_interval.lower)) * 100
    : 95

  // Validate prediction against market average
  const marketAvg = market_comparison?.market_average
  const predictionValidation = marketAvg 
    ? validatePrediction(final_price, marketAvg)
    : { isValid: true }

  // Calculate confidence factors and level
  const confidenceFactors = calculateConfidenceFactors(market_comparison, confidence_interval)
  const confidenceScore = confidence_interval
    ? ((confidence_interval.upper - confidence_interval.lower) / final_price) * 100
    : 20.0
  const confidenceLevel = getConfidenceLevel(confidenceScore)

  // Log suspicious predictions
  useEffect(() => {
    if (marketAvg && !predictionValidation.isValid) {
      logSuspiciousPrediction(final_price, marketAvg, {
        base_price,
        adjustments: adjustments.length,
        condition: condition_analysis?.overall_condition,
      })
    }
  }, [final_price, marketAvg, predictionValidation.isValid, base_price, adjustments.length, condition_analysis])

  const handleDownloadReport = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      doc.setFontSize(18)
      doc.text('Car Selling Price Report', 20, 20)

      doc.setFontSize(12)
      let y = 40
      doc.text(`Final Estimated Price: $${final_price.toLocaleString()}`, 20, y)
      y += 10
      doc.text(`Base Price: $${base_price.toLocaleString()}`, 20, y)
      y += 10
      if (confidence_interval) {
        doc.text(`95% Confidence: $${confidence_interval.lower.toLocaleString()} - $${confidence_interval.upper.toLocaleString()}`, 20, y)
        y += 10
      }

      if (recommended_prices && recommended_prices.length > 0) {
        y += 10
        doc.setFontSize(14)
        doc.text('Recommended Listing Prices:', 20, y)
        y += 10
        doc.setFontSize(12)
        recommended_prices.forEach(rec => {
          doc.text(`${rec.label}: $${rec.price.toLocaleString()} (${rec.percentage}%)`, 20, y)
          y += 10
        })
      }

      doc.save(`selling-price-report-${Date.now()}.pdf`)

      toast({
        title: 'Success',
        description: 'Report downloaded successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download report',
        variant: 'destructive',
      })
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: 'Car Selling Price Estimate',
      text: `My car's estimated selling price: $${final_price.toLocaleString()}`,
      url: window.location.href,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        // User cancelled
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareData.text)
      toast({
        title: 'Copied!',
        description: 'Price estimate copied to clipboard',
      })
    }
  }

  const handleEmail = () => {
    const subject = encodeURIComponent('Car Selling Price Estimate')
    const body = encodeURIComponent(`My car's estimated selling price: $${final_price.toLocaleString()}\n\nBase Price: $${base_price.toLocaleString()}\n\nView full report: ${window.location.href}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleCopyLink = async () => {
    try {
      const shareableUrl = window.location.href
      await navigator.clipboard.writeText(shareableUrl)
      toast({
        title: 'Link Copied!',
        description: 'Shareable link copied to clipboard',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      })
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Recommended Listing Prices */}
      {recommended_prices && recommended_prices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glassBorder rounded-2xl">
            <Card
              className="glassCard rounded-2xl"
              style={{
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                filter: 'none',
              }}
            >
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  💰 Recommended Listing Prices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommended_prices.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border backdrop-blur-sm ${
                        idx === 1
                          ? 'border-indigo-500/40 bg-indigo-500/10'
                          : 'border-white/10 bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-semibold ${
                          idx === 1 ? 'text-indigo-400' : 'text-white'
                        }`}>
                          {rec.label}
                        </span>
                        {idx === 1 && (
                          <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded border border-indigo-500/40">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className={`text-2xl font-bold mb-2 ${
                        idx === 1 ? 'text-indigo-400' : 'text-white'
                      }`}>
                        {rec.price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                      </div>
                      <p className="text-xs text-white/60 mb-1">
                        {rec.percentage}% of market value
                      </p>
                      <p className="text-xs text-white/50">
                        {rec.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
      {/* Estimated Selling Price - Large Premium Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="glassBorder rounded-3xl overflow-hidden">
          <div
            className="glassCard rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden"
            style={{
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              filter: 'none',
            }}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-green-500/15 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-8 w-8" />
              <span className="text-xl font-medium">Estimated Selling Price</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4">
              <AnimatedPrice 
                value={final_price} 
                className="text-5xl md:text-6xl lg:text-7xl font-bold"
              />
            </h1>
            {confidence_interval && (
              <div className="space-y-2 mb-4">
                <p className="text-lg opacity-90">
                  95% Confidence: {confidence_interval.lower.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} - {confidence_interval.upper.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                </p>
                <div className="max-w-md mx-auto">
                  <Progress value={confidencePercentage} className="h-3" />
                </div>
              </div>
            )}
              <p className="text-lg text-white/80">
                Base Value: {base_price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                <span className={`ml-2 ${totalAdjustment >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  ({totalAdjustment >= 0 ? '+' : ''}{adjustmentPercent}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Smart Alerts */}
      <SmartAlerts
        prediction={result}
        marketData={market_comparison ? {
          averagePrice: market_comparison.market_average,
          averageMileage: 0 // Would come from backend in production
        } : undefined}
        onScrollToSection={(section) => {
          // Scroll to section if needed
          const element = document.getElementById(section)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' })
          }
        }}
      />

      {/* Prediction Validation Warning */}
      {!predictionValidation.isValid && predictionValidation.warning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Unusual Prediction Detected</AlertTitle>
            <AlertDescription>
              {predictionValidation.warning}
              {predictionValidation.suggestedRange && (
                <>
                  <br />
                  <span className="mt-2 block">
                    Expected range: {formatCurrency(predictionValidation.suggestedRange.min)} - {formatCurrency(predictionValidation.suggestedRange.max)}
                  </span>
                </>
              )}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Confidence Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
      >
        <div className="glassBorder rounded-2xl">
          <Card
            className="glassCard rounded-2xl"
            style={{
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              filter: 'none',
            }}
          >
            <CardContent className="pt-6">
              <ConfidenceBreakdown
                confidence={confidenceLevel}
                confidenceScore={confidenceScore}
                factors={confidenceFactors}
              />
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Why This Price - Enhanced */}
      <WhyThisPriceEnhanced
        basePrice={base_price}
        finalPrice={final_price}
        adjustments={adjustments}
      />

      {/* Condition Analysis */}
      {condition_analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="glassBorder rounded-2xl">
            <Card
              className="glassCard rounded-2xl"
              style={{
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                filter: 'none',
              }}
            >
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                Condition Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {condition_analysis.overall_condition !== undefined && (
                  <div className="text-center">
                    <p className="text-sm text-white/60 mb-2">Overall</p>
                    <div className="flex items-center justify-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-6 w-6 ${
                            i < (condition_analysis.overall_condition || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'fill-white/10 text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-white mt-1">{condition_analysis.overall_condition}/5</p>
                  </div>
                )}
                {condition_analysis.interior_condition !== undefined && (
                  <div className="text-center">
                    <p className="text-sm text-white/60 mb-2">Interior</p>
                    <div className="flex items-center justify-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-6 w-6 ${
                            i < (condition_analysis.interior_condition || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'fill-white/10 text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-white mt-1">{condition_analysis.interior_condition}/5</p>
                  </div>
                )}
                {condition_analysis.exterior_condition !== undefined && (
                  <div className="text-center">
                    <p className="text-sm text-white/60 mb-2">Exterior</p>
                    <div className="flex items-center justify-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-6 w-6 ${
                            i < (condition_analysis.exterior_condition || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'fill-white/10 text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-white mt-1">{condition_analysis.exterior_condition}/5</p>
                  </div>
                )}
                {condition_analysis.mechanical_condition !== undefined && (
                  <div className="text-center">
                    <p className="text-sm text-white/60 mb-2">Mechanical</p>
                    <div className="flex items-center justify-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-6 w-6 ${
                            i < (condition_analysis.mechanical_condition || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'fill-white/10 text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-white mt-1">{condition_analysis.mechanical_condition}/5</p>
                  </div>
                )}
              </div>
            </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Market Comparison */}
      {market_comparison && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="glassBorder rounded-2xl">
            <Card
              className="glassCard rounded-2xl"
              style={{
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                filter: 'none',
              }}
            >
            <CardHeader>
              <CardTitle className="text-white">Market Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/[0.02] backdrop-blur-sm rounded-lg border border-white/10">
                  <p className="text-sm text-white/60 mb-1">Market Average</p>
                  <p className="text-2xl font-bold text-white">
                    {market_comparison.market_average.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="p-4 bg-white/[0.02] backdrop-blur-sm rounded-lg border border-white/10">
                  <p className="text-sm text-white/60 mb-1">Your Price</p>
                  <p className="text-2xl font-bold text-indigo-400">
                    {market_comparison.your_price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg border border-indigo-500/30 backdrop-blur-sm">
                <div>
                  <p className="text-sm text-white/60 mb-1">Difference</p>
                  <p className={`text-xl font-bold ${market_comparison.percentage_difference >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {market_comparison.percentage_difference >= 0 ? '+' : ''}{market_comparison.percentage_difference.toFixed(1)}%
                  </p>
                </div>
                <Badge
                  className={
                    market_comparison.badge === 'Above Average'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : market_comparison.badge === 'Below Market'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                  }
                >
                  {market_comparison.badge}
                </Badge>
              </div>
            </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Market Insights */}
      <MarketInsights
        marketComparison={market_comparison}
      />

      {/* What-If Scenarios */}
      <WhatIfScenariosEnhanced
        basePrediction={result}
      />

      {/* Adjustments Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="glassBorder rounded-2xl">
          <Card
            className="glassCard rounded-2xl"
            style={{
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              filter: 'none',
            }}
          >
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              📊 Price Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Base Price */}
            <div className="flex items-center justify-between p-3 bg-white/[0.02] backdrop-blur-sm rounded-lg border border-white/10">
              <span className="text-white/70">Base Model Prediction</span>
              <span className="text-white font-semibold">
                {base_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
            </div>

            <Separator className="bg-white/10" />

            {/* Adjustments */}
            {adjustments.length > 0 ? (
              adjustments.map((adj, idx) => (
                <AdjustmentRow
                  key={idx}
                  name={adj.name}
                  amount={adj.amount}
                  reason={adj.reason}
                />
              ))
            ) : (
              <div className="text-center py-4 text-white/50">
                No adjustments applied - standard pricing
              </div>
            )}

            <Separator className="bg-white/10" />

            {/* Final Price */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg border border-indigo-500/30 backdrop-blur-sm">
              <span className="text-white font-semibold text-lg">Final Estimated Price</span>
              <span className="text-indigo-400 font-bold text-xl">
                {final_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
            </div>
          </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="glassBorder rounded-2xl">
          <Card
            className="glassCard rounded-2xl"
            style={{
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              filter: 'none',
            }}
          >
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              Selling Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 bg-white/[0.02] backdrop-blur-sm rounded-lg border border-white/10">
                  <span className="text-yellow-400 mt-0.5">💡</span>
                  <span className="text-white/70">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Button
          onClick={handleDownloadReport}
          variant="outline"
          className="w-full border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-indigo-500/50 text-white h-12 transition-all duration-300"
        >
          <FileText className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
        <Button
          onClick={handleEmail}
          variant="outline"
          className="w-full border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-indigo-500/50 text-white h-12 transition-all duration-300"
        >
          <Mail className="mr-2 h-4 w-4" />
          Email Report
        </Button>
        <Button
          onClick={handleCopyLink}
          variant="outline"
          className="w-full border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-indigo-500/50 text-white h-12 transition-all duration-300"
        >
          <LinkIcon className="mr-2 h-4 w-4" />
          Copy Link
        </Button>
        <Button
          onClick={handlePrint}
          variant="outline"
          className="w-full border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-indigo-500/50 text-white h-12 transition-all duration-300"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </motion.div>
    </div>
  )
}
