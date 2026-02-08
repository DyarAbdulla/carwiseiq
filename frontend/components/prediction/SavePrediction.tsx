"use client"

import { Button } from '@/components/ui/button'
import { Save, Check } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

interface SavePredictionProps {
  result: PredictionResponse
  carFeatures: CarFeatures
}

export function SavePrediction({ result, carFeatures }: SavePredictionProps) {
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const locale = useLocale()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please login to save predictions to your dashboard',
        variant: 'destructive',
      })
      router.push(`/${locale}/login`)
      return
    }

    setSaving(true)
    try {
      // Save to localStorage for now (can be replaced with API call later)
      const savedPredictions = JSON.parse(localStorage.getItem('saved_predictions') || '[]')
      const predictionData = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        carFeatures,
        result,
        displayName: `${carFeatures.year} ${carFeatures.make} ${carFeatures.model}`,
      }
      savedPredictions.unshift(predictionData)
      localStorage.setItem('saved_predictions', JSON.stringify(savedPredictions.slice(0, 50))) // Keep last 50

      setSaved(true)
      toast({
        title: 'Saved!',
        description: 'Prediction saved to your dashboard',
      })
      
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save prediction',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSave}
      disabled={saving || saved}
      className="w-full sm:w-auto border-[#2a2d3a] bg-transparent hover:bg-[#2a2d3a] text-white hover:text-white"
    >
      {saved ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Saved!
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Prediction'}
        </>
      )}
    </Button>
  )
}

