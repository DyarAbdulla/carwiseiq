"use client"
export const runtime = 'edge';

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Target, Car, Clock, ArrowRight, Eye, Heart, Edit, Plus, ShoppingCart, Filter, Calendar, CheckCircle2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthSession } from '@/lib/useAuthSession'
import { useToast } from '@/hooks/use-toast'
import { motion } from 'framer-motion'
import type { ActivityType } from '@/lib/activityLogger'
import { getLocalActivities } from '@/lib/activityLogger'

interface ActivityLog {
  id: string
  type: ActivityType
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  user_id?: string
}

interface PredictionHistoryItem {
  id: string
  timestamp: string
  predicted_price: number
  confidence_level?: string
  confidence_interval?: { lower: number; upper: number }
  car_features: {
    make: string
    model: string
    year: number
    mileage: number
    condition: string
    location: string
    fuel_type: string
  }
  feedback?: {
    rating?: number
    is_accurate?: boolean
    updated_at?: string
    feedback_reasons?: string[]
    correct_make?: string
    correct_model?: string
    correct_price?: number
  }
}

export default function ActivityHistoryPage() {
  const t = useTranslations('feedback.history')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const { user, sessionLoaded } = useAuthSession()

  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [predictions, setPredictions] = useState<PredictionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionHistoryItem | null>(null)
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all')

  useEffect(() => {
    if (sessionLoaded) {
      loadHistory()
    }
  }, [sessionLoaded, filterType])

  const loadHistory = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      let activityData: ActivityLog[] = []

      // Load from Supabase user_activity table (always load all types, filter client-side)
      try {
        const { data, error } = await supabase
          .from('user_activity')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)

        if (!error && data) {
          activityData = data as ActivityLog[]
        }
      } catch {
        activityData = []
      }

      // Merge with localStorage activities (fallback when Supabase table missing or for anonymous-first data)
      const localActivities = getLocalActivities(user.id)
      const merged = [...activityData]
      const seenIds = new Set(activityData.map((a) => a.id))
      for (const la of localActivities) {
        if (!seenIds.has(la.id)) {
          seenIds.add(la.id)
          merged.push(la)
        }
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const filtered = filterType === 'all' ? merged : merged.filter((a) => a.type === filterType)
      setActivities(filtered)

      // Also load prediction history from API (for backward compatibility)
      try {
        const { apiClient } = await import('@/lib/api')
        const response = await apiClient.getPredictionHistory(100, 0)
        setPredictions(response.predictions || [])
      } catch {
        // Non-critical
      }
    } catch (error: unknown) {
      console.error('Error loading history:', error)
      toast({
        title: tCommon?.('error') || 'Error',
        description: error instanceof Error ? error.message : 'Failed to load activity history',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(dateString)
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    })
  }

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'prediction':
        return Target
      case 'compare':
        return ShoppingCart
      case 'view_listing':
        return Eye
      case 'create_listing':
        return Plus
      case 'edit_listing':
        return Edit
      case 'mark_sold':
        return CheckCircle2
      case 'favorite':
        return Heart
      default:
        return Clock
    }
  }

  const getActivityLabel = (type: ActivityType, metadata?: Record<string, unknown>) => {
    if (type === 'favorite' && metadata?.action === 'removed') {
      return 'Removed from Favorites'
    }
    if (type === 'favorite' && metadata?.action === 'added') {
      return 'Added to Favorites'
    }
    switch (type) {
      case 'prediction':
        return 'Price Prediction'
      case 'compare':
        return 'Car Comparison'
      case 'view_listing':
        return 'Viewed Listing'
      case 'create_listing':
        return 'Created Listing'
      case 'edit_listing':
        return 'Edited Listing'
      case 'mark_sold':
        return 'Marked as Sold'
      case 'favorite':
        return 'Favorited'
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'prediction':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
      case 'compare':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30'
      case 'view_listing':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
      case 'favorite':
        return 'text-pink-400 bg-pink-500/10 border-pink-500/30'
      case 'create_listing':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      case 'edit_listing':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      case 'mark_sold':
        return 'text-red-400 bg-red-500/10 border-red-500/30'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    }
  }

  const activityTypes: Array<{ value: ActivityType | 'all'; label: string }> = [
    { value: 'all', label: 'All Activities' },
    { value: 'prediction', label: 'Predictions' },
    { value: 'compare', label: 'Comparisons' },
    { value: 'view_listing', label: 'Views' },
    { value: 'favorite', label: 'Favorites' },
    { value: 'create_listing', label: 'Created Listings' },
    { value: 'edit_listing', label: 'Edited Listings' },
    { value: 'mark_sold', label: 'Marked Sold' },
  ]

  if (!sessionLoaded) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Please login to view your activity history</p>
          <Button onClick={() => window.location.href = '/login'}>Login</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const allItems = [
    ...activities.map((activity) => ({
      type: 'activity' as const,
      data: activity,
      timestamp: activity.created_at,
    })),
    ...predictions.map((prediction) => ({
      type: 'prediction' as const,
      data: prediction,
      timestamp: prediction.timestamp,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const filteredItems = filterType === 'all'
    ? allItems
    : allItems.filter((item) => {
      if (item.type === 'activity') {
        return item.data.type === filterType
      }
      // Legacy predictions map to 'prediction' type
      return filterType === 'prediction'
    })

  return (
    <div className="relative min-h-screen text-slate-900 dark:text-gray-100">
      {/* Ambient gradient glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">Activity History</h1>
            <p className="text-slate-600 dark:text-slate-400">Track all your activities across the platform</p>
          </div>

          {/* Filter Bar - wraps on mobile, touch-friendly */}
          <div className="flex flex-wrap gap-2">
            {activityTypes.map((type) => (
              <Button
                key={type.value}
                onClick={() => setFilterType(type.value)}
                variant={filterType === type.value ? 'default' : 'outline'}
                className={`min-h-[44px] touch-manipulation ${filterType === type.value
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white'
                  }`}
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2 shrink-0" />
                <span className="text-sm">{type.label}</span>
              </Button>
            ))}
          </div>

          {/* Timeline Feed */}
          {filteredItems.length === 0 ? (
            <div className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-12 md:p-16 text-center shadow-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="relative mb-6">
                  <Clock className="h-20 w-20 text-slate-400 dark:text-slate-400/50 mx-auto" />
                  <Car className="h-12 w-12 text-indigo-400/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h3 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white mb-2">No Activity Yet</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">Start using the platform to see your activity history here</p>
                <Button
                  onClick={() => window.location.href = '/predict'}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 h-12 px-8"
                >
                  Start Your First Prediction
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item, index) => {
                if (item.type === 'prediction') {
                  const prediction = item.data as PredictionHistoryItem
                  const car = prediction.car_features
                  return (
                    <motion.div
                      key={`prediction-${prediction.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Target className="h-5 w-5 text-indigo-400" />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              {car.make} {car.model} ({car.year})
                            </h3>
                            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                              Prediction
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(prediction.timestamp)}</span>
                          </div>
                          <div className="text-2xl font-bold text-indigo-400">
                            {formatPrice(prediction.predicted_price)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                } else {
                  const activity = item.data as ActivityLog
                  const Icon = getActivityIcon(activity.type)
                  const colorClass = getActivityColor(activity.type)
                  const metadata = activity.metadata || {}

                  return (
                    <motion.div
                      key={`activity-${activity.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className={`h-5 w-5 ${colorClass.split(' ')[0]}`} />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              {getActivityLabel(activity.type, metadata as Record<string, unknown>)}
                            </h3>
                            <Badge className={`${colorClass}`}>
                              {activity.type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                            <Clock className="h-4 w-4" />
                            <span>{formatTimeAgo(activity.created_at)}</span>
                            <span className="text-slate-500">•</span>
                            <span>{formatDate(activity.created_at)}</span>
                          </div>
                          {/* Display metadata */}
                          {metadata.listing_title && (
                            <p className="text-slate-900 dark:text-white mb-2">{metadata.listing_title}</p>
                          )}
                          {metadata.car_make && metadata.car_model && (
                            <p className="text-slate-900 dark:text-white mb-2">
                              {metadata.car_year} {metadata.car_make} {metadata.car_model}
                            </p>
                          )}
                          {metadata.predicted_price && (
                            <p className="text-indigo-400 text-lg font-semibold">
                              {formatPrice(metadata.predicted_price as number)}
                            </p>
                          )}
                          {metadata.listing_price && (
                            <p className="text-emerald-400 text-lg font-semibold">
                              {formatPrice(metadata.listing_price as number)}
                            </p>
                          )}
                          {metadata.comparison_count && (
                            <p className="text-purple-400 text-lg font-semibold">
                              Compared {metadata.comparison_count} cars
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                }
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
