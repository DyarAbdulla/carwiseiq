'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, TrendingDown, TrendingUp, Minus, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { CarFeatures } from '@/lib/types'

interface UrlResultCardProps {
  extractedData: CarFeatures
  predictedPrice: number
  listingPrice?: number
  priceComparison?: {
    listing_price: number
    predicted_price: number
    difference: number
    difference_percent: number
    is_above_market: boolean
    is_below_market: boolean
  }
  confidenceInterval?: {
    lower: number
    upper: number
  }
  listingUrl?: string
  carImage?: string
  message?: string
}

export function UrlResultCard({
  extractedData,
  predictedPrice,
  listingPrice,
  priceComparison,
  confidenceInterval,
  listingUrl,
  carImage,
  message,
}: UrlResultCardProps) {
  const dealQuality =
    priceComparison?.is_below_market === true
      ? 'Good'
      : priceComparison?.is_above_market === true
      ? 'Poor'
      : 'Fair'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-[#5B7FFF]/30 bg-[#1a1d29]/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Prediction Results</CardTitle>
              <CardDescription className="text-[#94a3b8]">
                Extracted car details and predicted price
              </CardDescription>
            </div>
            {listingUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(listingUrl, '_blank')}
                className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Original Listing
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Car Image */}
          {carImage && (
            <div className="w-full overflow-hidden rounded-lg border border-[#2a2d3a]">
              <img
                src={carImage}
                alt={`${extractedData.make} ${extractedData.model}`}
                className="w-full h-auto max-h-[300px] object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Predicted Price - Large and Highlighted */}
          <div className="text-center p-6 rounded-lg bg-[#5B7FFF]/10 border border-[#5B7FFF]/30">
            <p className="text-sm text-[#94a3b8] mb-2">Predicted Market Price</p>
            <p className="text-4xl font-bold text-[#5B7FFF]">{formatCurrency(predictedPrice)}</p>
            {confidenceInterval && (
              <p className="text-sm text-[#94a3b8] mt-2">
                Range: {formatCurrency(confidenceInterval.lower)} -{' '}
                {formatCurrency(confidenceInterval.upper)}
              </p>
            )}
          </div>

          {/* Comparison Table */}
          {listingPrice && priceComparison && (
            <div className="border border-[#2a2d3a] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0f1117]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#94a3b8] border-b border-[#2a2d3a]">
                      Original Listing
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#94a3b8] border-b border-[#2a2d3a]">
                      Our Prediction
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-white border-b border-[#2a2d3a]">
                      {formatCurrency(listingPrice)}
                    </td>
                    <td className="px-4 py-3 text-[#5B7FFF] font-semibold border-b border-[#2a2d3a]">
                      {formatCurrency(predictedPrice)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-[#94a3b8] text-sm">Condition</td>
                    <td className="px-4 py-3 text-white">{extractedData.condition}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-[#94a3b8] text-sm">Market Position</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {priceComparison.is_below_market ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-green-500" />
                            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                              Below Market
                            </Badge>
                          </>
                        ) : priceComparison.is_above_market ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-red-500" />
                            <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                              Above Market
                            </Badge>
                          </>
                        ) : (
                          <>
                            <Minus className="h-4 w-4 text-yellow-500" />
                            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                              At Market
                            </Badge>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Extracted Car Details */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-[#94a3b8]">Make</p>
              <p className="text-white font-semibold">{extractedData.make}</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Model</p>
              <p className="text-white font-semibold">{extractedData.model}</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Year</p>
              <p className="text-white font-semibold">{extractedData.year}</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Mileage</p>
              <p className="text-white font-semibold">{extractedData.mileage.toLocaleString()} km</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Condition</p>
              <p className="text-white font-semibold">{extractedData.condition}</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Fuel Type</p>
              <p className="text-white font-semibold">{extractedData.fuel_type}</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Engine Size</p>
              <p className="text-white font-semibold">{extractedData.engine_size}L</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Cylinders</p>
              <p className="text-white font-semibold">{extractedData.cylinders}</p>
            </div>
            <div>
              <p className="text-sm text-[#94a3b8]">Location</p>
              <p className="text-white font-semibold">{extractedData.location}</p>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[#2a2d3a] border border-[#2a2d3a]">
              <AlertCircle className="h-5 w-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#94a3b8]">{message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
