"use client"

import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useState, useEffect } from 'react'
import type { CarFeatures, PredictionResponse } from '@/lib/types'

interface SaveToCompareProps {
  carFeatures: CarFeatures
  result: PredictionResponse
}

const MAX_COMPARE_CARS = 5
const STORAGE_KEY = 'compare_cars'

export function SaveToCompare({ carFeatures, result }: SaveToCompareProps) {
  const { toast } = useToast()
  const [savedCount, setSavedCount] = useState(0)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
      setSavedCount(saved.length)

      // Check if this car is already saved
      const carId = `${carFeatures.make}-${carFeatures.model}-${carFeatures.year}`
      setIsSaved(saved.some((c: any) => c.id === carId))
    }
  }, [carFeatures])

  const handleSave = () => {
    if (typeof window === 'undefined') return

    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')

      if (isSaved) {
        // Remove if already saved
        const carId = `${carFeatures.make}-${carFeatures.model}-${carFeatures.year}`
        const filtered = saved.filter((c: any) => c.id !== carId)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
        setIsSaved(false)
        setSavedCount(filtered.length)
        toast({
          title: 'Removed',
          description: 'Car removed from comparison list',
        })
      } else {
        // Add if not at max
        if (saved.length >= MAX_COMPARE_CARS) {
          toast({
            title: 'Limit Reached',
            description: `You can only save up to ${MAX_COMPARE_CARS} cars for comparison`,
            variant: 'destructive',
          })
          return
        }

        const carId = `${carFeatures.make}-${carFeatures.model}-${carFeatures.year}`
        const carToSave = {
          id: carId,
          features: carFeatures,
          result: result,
          savedAt: new Date().toISOString(),
        }

        saved.push(carToSave)
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
        setIsSaved(true)
        setSavedCount(saved.length)

        // Log activity
        const carIds = saved.map((c: any) => c.id)
        activityHelpers.logComparisonSaved(saved.length, carIds)

        toast({
          title: 'Saved!',
          description: `Car saved for comparison (${saved.length}/${MAX_COMPARE_CARS})`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save car',
        variant: 'destructive',
      })
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleSave}
      className={`w-full border-[#2a2d3a] ${isSaved
        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
        : 'bg-[#1a1d29] hover:bg-[#2a2d3a]'
        }`}
    >
      {isSaved ? (
        <>
          <X className="mr-2 h-4 w-4" />
          Remove from Compare ({savedCount}/{MAX_COMPARE_CARS})
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          Save to Compare ({savedCount}/{MAX_COMPARE_CARS})
        </>
      )}
    </Button>
  )
}






