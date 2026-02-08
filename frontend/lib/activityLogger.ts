"use client"

import { supabase } from './supabase'

const ACTIVITY_STORAGE_KEY = 'carwiseiq_activity_log'

export type ActivityType =
  | 'prediction'
  | 'compare'
  | 'view_listing'
  | 'favorite'
  | 'create_listing'
  | 'edit_listing'
  | 'mark_sold'

export interface ActivityMetadata {
  [key: string]: unknown
  entity_id?: string | number
  entity_type?: string
  car_make?: string
  car_model?: string
  car_year?: number
  predicted_price?: number
  listing_title?: string
  listing_price?: number
  comparison_count?: number
}

export interface StoredActivity {
  id: string
  type: ActivityType
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  user_id?: string
}

/** Save activity to localStorage (fallback when Supabase unavailable or table missing) */
function saveToLocalStorage(activity: Omit<StoredActivity, 'id' | 'created_at'>): void {
  try {
    if (typeof window === 'undefined') return
    const stored = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]')
    const entry: StoredActivity = {
      ...activity,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
    }
    stored.unshift(entry)
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(stored.slice(0, 200)))
  } catch {
    // Ignore storage errors
  }
}

/** Read activities from localStorage */
export function getLocalActivities(userId?: string): StoredActivity[] {
  try {
    if (typeof window === 'undefined') return []
    const stored = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]')
    const list = Array.isArray(stored) ? stored : []
    if (userId) {
      return list.filter((a: StoredActivity) => !a.user_id || a.user_id === userId)
    }
    return list
  } catch {
    return []
  }
}

// Cache: skip Supabase if we've seen table-not-found (avoids repeated 404s in console)
let _supabaseActivityTableMissing = false

/**
 * Log user activity to Supabase user_activity table, with localStorage fallback
 * Uses localStorage-first to avoid 404 console noise when user_activity table doesn't exist
 */
export async function logActivity(
  type: ActivityType,
  metadata: ActivityMetadata = {}
): Promise<void> {
  const payload = {
    type,
    entity_id: metadata.entity_id?.toString() || null,
    metadata: metadata as Record<string, unknown>,
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id

    // Always save to localStorage first (works offline, no 404s)
    saveToLocalStorage({ ...payload, user_id: userId })

    // Skip Supabase if we know the table doesn't exist (prevents 404 spam)
    if (_supabaseActivityTableMissing) return

    if (!userId) return

    const { error } = await supabase.from('user_activity').insert({
      user_id: userId,
      type,
      entity_id: payload.entity_id,
      metadata: payload.metadata,
    })

    if (!error) return

    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table') || error.message?.includes('404')) {
      _supabaseActivityTableMissing = true
    } else if (process.env.NODE_ENV === 'development') {
      console.error('[activityLogger] Supabase insert failed:', error)
    }
  } catch {
    // Silently use localStorage (already called above)
  }
}

/**
 * Helper functions for common activity types
 */
export const activityHelpers = {
  logPrediction: (features: {
    make: string
    model: string
    year: number
    predictedPrice: number
    predictionId?: string | number
  }) =>
    logActivity('prediction', {
      entity_id: features.predictionId?.toString() || null,
      car_make: features.make,
      car_model: features.model,
      car_year: features.year,
      predicted_price: features.predictedPrice,
    }),

  logCompare: (carIds: (string | number)[], comparisonCount: number) =>
    logActivity('compare', {
      entity_id: carIds.join(','),
      comparison_count: comparisonCount,
      compared_ids: carIds.map(id => id.toString()),
    }),

  logViewListing: (listingId: string | number, listingTitle: string) =>
    logActivity('view_listing', {
      entity_id: listingId.toString(),
      listing_title: listingTitle,
    }),

  logFavorite: (listingId: string | number, added: boolean) =>
    logActivity('favorite', {
      entity_id: listingId.toString(),
      action: added ? 'added' : 'removed',
    }),

  logCreateListing: (listingId: string | number, title: string, price: number) =>
    logActivity('create_listing', {
      entity_id: listingId.toString(),
      listing_title: title,
      listing_price: price,
    }),

  logEditListing: (listingId: string | number, title: string) =>
    logActivity('edit_listing', {
      entity_id: listingId.toString(),
      listing_title: title,
    }),

  logMarkSold: (listingId: string | number, title: string) =>
    logActivity('mark_sold', {
      entity_id: listingId.toString(),
      listing_title: title,
    }),

  // Legacy helpers for backward compatibility
  logPredictionCreated: (features: {
    make: string
    model: string
    year: number
    predictedPrice: number
  }) => activityHelpers.logPrediction(features),

  logPredictionSaved: (predictionId: string | number) =>
    logActivity('prediction', {
      entity_id: predictionId.toString(),
    }),

  logComparisonSaved: (comparisonCount: number, carIds: (string | number)[]) =>
    activityHelpers.logCompare(carIds, comparisonCount),

  logComparisonViewed: (carIds: (string | number)[]) =>
    activityHelpers.logCompare(carIds, carIds.length),

  logListingViewed: (listingId: string | number, listingTitle: string) =>
    activityHelpers.logViewListing(listingId, listingTitle),

  logListingCreated: (listingId: string | number, title: string, price: number) =>
    activityHelpers.logCreateListing(listingId, title, price),

  logListingEdited: (listingId: string | number, title: string) =>
    activityHelpers.logEditListing(listingId, title),

  logListingSold: (listingId: string | number, title: string) =>
    activityHelpers.logMarkSold(listingId, title),

  logListingAvailable: (listingId: string | number, title: string) =>
    logActivity('edit_listing', {
      entity_id: listingId.toString(),
      listing_title: title,
      action: 'marked_available',
    }),

  logFavoriteAdded: (listingId: string | number) =>
    activityHelpers.logFavorite(listingId, true),

  logFavoriteRemoved: (listingId: string | number) =>
    activityHelpers.logFavorite(listingId, false),
}
