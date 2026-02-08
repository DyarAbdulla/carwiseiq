/**
 * Utility for managing recent prediction searches
 */

import type { CarFeatures, PredictionResponse } from './types'

export interface RecentSearch {
  id: string
  timestamp: number
  features: CarFeatures
  prediction: PredictionResponse
}

const STORAGE_KEY = 'car_price_recent_searches'
const MAX_RECENT_SEARCHES = 10

/**
 * Get all recent searches from localStorage
 */
export function getRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const searches: RecentSearch[] = JSON.parse(stored)
    // Sort by timestamp (newest first)
    return searches.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error('Error reading recent searches:', error)
    return []
  }
}

/**
 * Add a new search to recent searches
 */
export function addRecentSearch(features: CarFeatures, prediction: PredictionResponse): void {
  if (typeof window === 'undefined') return
  
  try {
    const searches = getRecentSearches()
    
    // Create new search entry
    const newSearch: RecentSearch = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      features,
      prediction,
    }
    
    // Add to beginning and limit to MAX_RECENT_SEARCHES
    const updated = [newSearch, ...searches].slice(0, MAX_RECENT_SEARCHES)
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving recent search:', error)
  }
}

/**
 * Remove a search by ID
 */
export function removeRecentSearch(id: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const searches = getRecentSearches()
    const filtered = searches.filter(s => s.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error removing recent search:', error)
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Format timestamp to relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'Just now'
}







