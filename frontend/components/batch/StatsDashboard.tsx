'use client'

import { useMemo } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { BatchPredictionResult } from '@/lib/types'

interface ExtendedResult extends BatchPredictionResult {
  confidence_percent?: number
  deal_rating?: 'Good' | 'Fair' | 'Poor'
}

interface StatsDashboardProps {
  results: ExtendedResult[]
}

const COLORS = {
  good: '#10B981',
  fair: '#F59E0B',
  poor: '#EF4444',
  primary: '#5B7FFF',
  secondary: '#8B5CF6',
}

export function StatsDashboard({ results }: StatsDashboardProps) {
  const chartData = useMemo(() => {
    if (results.length === 0) return null

    const successful = results.filter((r) => !r.error)

    // Price Distribution Data
    const priceRanges = [
      { range: '$0-10k', min: 0, max: 10000, count: 0 },
      { range: '$10k-20k', min: 10000, max: 20000, count: 0 },
      { range: '$20k-30k', min: 20000, max: 30000, count: 0 },
      { range: '$30k-50k', min: 30000, max: 50000, count: 0 },
      { range: '$50k-75k', min: 50000, max: 75000, count: 0 },
      { range: '$75k+', min: 75000, max: Infinity, count: 0 },
    ]

    successful.forEach((result) => {
      const price = result.predicted_price
      for (const range of priceRanges) {
        if (price >= range.min && price < range.max) {
          range.count++
          break
        }
      }
    })

    // Deal Quality Data
    const dealQualityCounts = {
      Good: results.filter((r) => !r.error && r.deal_rating === 'Good').length,
      Fair: results.filter((r) => !r.error && r.deal_rating === 'Fair').length,
      Poor: results.filter((r) => !r.error && r.deal_rating === 'Poor').length,
    }

    const dealQualityData = Object.entries(dealQualityCounts)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name, value }))

    // Confidence Score Distribution
    const confidenceRanges = [
      { range: '0-20%', min: 0, max: 20, count: 0 },
      { range: '20-40%', min: 20, max: 40, count: 0 },
      { range: '40-60%', min: 40, max: 60, count: 0 },
      { range: '60-80%', min: 60, max: 80, count: 0 },
      { range: '80-100%', min: 80, max: 100, count: 0 },
    ]

    successful.forEach((result) => {
      const confidence = result.confidence_percent ?? 0
      for (const range of confidenceRanges) {
        if (confidence >= range.min && confidence < range.max) {
          range.count++
          break
        }
      }
    })

    // Best and Worst Deals
    const sortedByPrice = [...successful].sort((a, b) => a.predicted_price - b.predicted_price)
    const bestDeal = sortedByPrice.find((r) => r.deal_rating === 'Good') || sortedByPrice[0]
    const worstDeal =
      sortedByPrice.reverse().find((r) => r.deal_rating === 'Poor') || sortedByPrice[0]

    return {
      priceDistribution: priceRanges,
      dealQuality: dealQualityData,
      confidenceDistribution: confidenceRanges,
      bestDeal,
      worstDeal,
    }
  }, [results])

  if (!chartData || results.length === 0) return null

  return (
    <div className="space-y-6">
      {/* Best/Worst Deals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {chartData.bestDeal && (
          <div className="bg-green-50 dark:bg-green-500/10 backdrop-blur-sm border border-green-200 dark:border-green-500/20 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⭐</span>
              <h4 className="text-lg font-semibold text-green-600 dark:text-green-400">Best Deal</h4>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {chartData.bestDeal.car.make} {chartData.bestDeal.car.model}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
              {formatCurrency(chartData.bestDeal.predicted_price)}
            </p>
            <p className="text-sm text-slate-600 dark:text-[#94a3b8] mt-1">
              {chartData.bestDeal.car.year} • {chartData.bestDeal.car.mileage.toLocaleString()} km
            </p>
          </div>
        )}

        {chartData.worstDeal && (
          <div className="bg-red-50 dark:bg-red-500/10 backdrop-blur-sm border border-red-200 dark:border-red-500/20 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-lg font-semibold text-red-600 dark:text-red-400">Overpriced</h4>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {chartData.worstDeal.car.make} {chartData.worstDeal.car.model}
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
              {formatCurrency(chartData.worstDeal.predicted_price)}
            </p>
            <p className="text-sm text-slate-600 dark:text-[#94a3b8] mt-1">
              {chartData.worstDeal.car.year} • {chartData.worstDeal.car.mileage.toLocaleString()} km
            </p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Distribution */}
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Price Distribution</h4>
            <p className="text-sm text-slate-600 dark:text-[#94a3b8]">
              Number of cars by price range
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.priceDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="range" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  backdropFilter: 'blur(12px)',
                }}
              />
              <Bar dataKey="count" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Deal Quality */}
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Deal Quality</h4>
            <p className="text-sm text-[#94a3b8]">
              Breakdown of deal quality ratings
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.dealQuality}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.dealQuality.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.name === 'Good'
                        ? COLORS.good
                        : entry.name === 'Fair'
                        ? COLORS.fair
                        : COLORS.poor
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  backdropFilter: 'blur(12px)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Confidence Distribution */}
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl p-6 lg:col-span-2 shadow-sm">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Confidence Score Distribution</h4>
            <p className="text-sm text-[#94a3b8]">
              Distribution of prediction confidence scores
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.confidenceDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="range" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  backdropFilter: 'blur(12px)',
                }}
              />
              <Bar dataKey="count" fill={COLORS.secondary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
