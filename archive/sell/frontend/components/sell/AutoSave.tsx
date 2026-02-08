"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, CheckCircle2 } from 'lucide-react'
import { useDebounce } from 'react-use'

const STORAGE_KEY = 'car_sell_form_draft'
const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

export interface AutoSaveData {
  formData: Record<string, any>
  timestamp: number
}

interface AutoSaveProps {
  formData: Record<string, any>
  onRestore?: (data: AutoSaveData) => void
}

/**
 * Hook to auto-save form data to localStorage
 */
export function useAutoSave(formData: Record<string, any>, enabled: boolean = true) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showIndicator, setShowIndicator] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced save function
  const saveToStorage = useCallback(() => {
    if (!enabled || !formData) return

    try {
      setIsSaving(true)
      const data: AutoSaveData = {
        formData: { ...formData },
        timestamp: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setLastSaved(new Date())
      setShowIndicator(true)
      
      // Hide indicator after 3 seconds
      setTimeout(() => setShowIndicator(false), 3000)
    } catch (error) {
      console.error('Failed to save form data:', error)
    } finally {
      setIsSaving(false)
    }
  }, [formData, enabled])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      saveToStorage()
    }, AUTO_SAVE_INTERVAL)

    return () => {
      clearInterval(interval)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [enabled, saveToStorage])

  // Save immediately when form data changes (debounced)
  useDebounce(
    () => {
      if (enabled && formData) {
        saveToStorage()
      }
    },
    2000, // Wait 2 seconds after user stops typing
    [formData]
  )

  return {
    isSaving,
    lastSaved,
    showIndicator,
    saveManually: saveToStorage
  }
}

/**
 * Get saved form data from localStorage
 */
export function getSavedFormData(): AutoSaveData | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    
    const data: AutoSaveData = JSON.parse(saved)
    
    // Check if data is older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    if (data.timestamp < sevenDaysAgo) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Failed to load saved form data:', error)
    return null
  }
}

/**
 * Clear saved form data from localStorage
 */
export function clearSavedFormData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear saved form data:', error)
  }
}

/**
 * Auto-save indicator component
 */
export function AutoSaveIndicator({ isSaving, lastSaved, showIndicator }: {
  isSaving: boolean
  lastSaved: Date | null
  showIndicator: boolean
}) {
  if (!showIndicator && !isSaving) return null

  return (
    <AnimatePresence>
      {(showIndicator || isSaving) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-[#1a1d29] border border-[#2a2d3a] rounded-lg shadow-lg"
        >
          {isSaving ? (
            <>
              <Save className="h-4 w-4 text-[#5B7FFF] animate-pulse" />
              <span className="text-sm text-white">Saving...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-white">Auto-saved</span>
              {lastSaved && (
                <span className="text-xs text-[#94a3b8]">
                  {formatTimeAgo(lastSaved)}
                </span>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Format timestamp as time ago
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}