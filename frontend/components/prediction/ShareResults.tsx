"use client"

import { Button } from '@/components/ui/button'
import { Share2, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface ShareResultsProps {
  result: PredictionResponse
  carFeatures: CarFeatures
}

export function ShareResults({ result, carFeatures }: ShareResultsProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const generateShareText = () => {
    const carInfo = `${carFeatures.year} ${carFeatures.make} ${carFeatures.model}`
    const price = formatCurrency(result.predicted_price)
    return `🚗 Car Price Prediction: ${carInfo}\n💰 Estimated Value: ${price}\n\nPredicted using CarWiseIQ`
  }

  const generateShareUrl = () => {
    const params = new URLSearchParams({
      make: carFeatures.make,
      model: carFeatures.model,
      year: carFeatures.year.toString(),
      mileage: carFeatures.mileage.toString(),
      condition: carFeatures.condition,
      price: result.predicted_price.toString(),
    })
    return `${window.location.origin}/predict?${params.toString()}`
  }

  const handleCopy = async () => {
    try {
      const text = generateShareText()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: 'Copied!',
        description: 'Prediction details copied to clipboard',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: 'Car Price Prediction',
      text: generateShareText(),
      url: generateShareUrl(),
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        // User cancelled or error
        console.log('Share cancelled')
      }
    } else {
      // Fallback to copy
      handleCopy()
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a]"
      >
        {copied ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Copy Results
          </>
        )}
      </Button>
      {typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function' && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a]"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      )}
    </div>
  )
}


