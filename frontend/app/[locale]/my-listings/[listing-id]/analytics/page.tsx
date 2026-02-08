"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, TrendingUp, Eye, Heart, MessageSquare, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ChartSkeleton } from '@/components/common/LoadingSkeleton'

interface AnalyticsData {
  listing_id: number
  views_count: number
  views_over_time: Array<{ date: string; views: number }>
  saves_count: number
  messages_count: number
  engagement_rate: number
  performance: 'high' | 'average' | 'low'
  performance_color: 'green' | 'yellow' | 'red'
  suggestions: string[]
}

export default function ListingAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const listingId = parseInt(params?.['listing-id'] as string)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  
  const t = useTranslations('analytics')
  const tCommon = useTranslations('common')
  const toastHook = useToast()
  const toast = toastHook || { toast: () => {} }

  useEffect(() => {
    if (listingId) {
      loadAnalytics()
    }
  }, [listingId])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const data = await apiClient.getListingAnalytics(listingId)
      setAnalytics(data)
    } catch (error: any) {
      console.error('Error loading analytics:', error)
      if (toast?.toast) {
        toast.toast({
          title: 'Error',
          description: error.message || 'Failed to load analytics',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-8 bg-[#2a2d3a] rounded w-64 animate-pulse"></div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-[#2a2d3a] rounded animate-pulse"></div>
            ))}
          </div>
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="container py-8">
        <Card className="border-[#2a2d3a] bg-[#1a1d29]">
          <CardContent className="py-12 text-center">
            <p className="text-white/70">Analytics not available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const performanceColors = {
    green: 'text-green-500 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
    red: 'text-red-500 bg-red-500/10 border-red-500/30',
  }

  return (
    <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            className="text-white hover:bg-[#2a2d3a]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Listing Analytics</h1>
            <p className="text-sm text-[#94a3b8]">Listing ID: {listingId}</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card className="border-[#2a2d3a] bg-[#1a1d29]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Eye className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-[#94a3b8]">Total Views</p>
                  <p className="text-2xl font-bold text-white">{analytics.views_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a2d3a] bg-[#1a1d29]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <Heart className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-[#94a3b8]">Favorites</p>
                  <p className="text-2xl font-bold text-white">{analytics.saves_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a2d3a] bg-[#1a1d29]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-[#94a3b8]">Messages</p>
                  <p className="text-2xl font-bold text-white">{analytics.messages_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a2d3a] bg-[#1a1d29]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${performanceColors[analytics.performance_color]}`}>
                  <TrendingUp className={`h-6 w-6`} />
                </div>
                <div>
                  <p className="text-sm text-[#94a3b8]">Engagement</p>
                  <p className="text-2xl font-bold text-white">{analytics.engagement_rate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Indicator */}
        <Card className="border-[#2a2d3a] bg-[#1a1d29] mb-6">
          <CardHeader>
            <CardTitle className="text-white">Performance Indicator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-lg border ${performanceColors[analytics.performance_color]}`}>
              <div className="flex items-center gap-3">
                {analytics.performance === 'high' && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                {analytics.performance === 'average' && <AlertCircle className="h-6 w-6 text-yellow-500" />}
                {analytics.performance === 'low' && <XCircle className="h-6 w-6 text-red-500" />}
                <div>
                  <p className="font-semibold text-white capitalize">
                    {analytics.performance === 'high' && 'High Engagement'}
                    {analytics.performance === 'average' && 'Average Engagement'}
                    {analytics.performance === 'low' && 'Low Engagement'}
                  </p>
                  <p className="text-sm text-[#94a3b8]">
                    {analytics.engagement_rate.toFixed(1)}% engagement rate
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Views Over Time Chart */}
        <Card className="border-[#2a2d3a] bg-[#1a1d29] mb-6">
          <CardHeader>
            <CardTitle className="text-white">Views Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.views_over_time}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8' }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return `${date.getMonth() + 1}/${date.getDate()}`
                  }}
                />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1d29',
                    border: '1px solid #2a2d3a',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#5B7FFF"
                  strokeWidth={2}
                  dot={{ fill: '#5B7FFF', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Suggestions */}
        {analytics.suggestions.length > 0 && (
          <Card className="border-[#2a2d3a] bg-[#1a1d29]">
            <CardHeader>
              <CardTitle className="text-white">Suggestions to Improve</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {analytics.suggestions.map((suggestion, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-[#2a2d3a] rounded-lg"
                  >
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-white/80 text-sm">{suggestion}</p>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
