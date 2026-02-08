"use client"

import { Button } from '@/components/ui/button'
import { Share2 } from 'lucide-react'

interface ShareComparisonProps {
  mode: 'marketplace' | 'prediction'
  ids?: number[]
  predictionState?: { cars: unknown[] }
  onCopy?: () => void
  variant?: 'outline' | 'default'
  className?: string
}

export function ShareComparison({
  mode,
  ids,
  predictionState,
  onCopy,
  variant = 'outline',
  className,
}: ShareComparisonProps) {
  const handleClick = () => {
    try {
      if (typeof window === 'undefined') return
      const locale = window.location.pathname.split('/')[1] || 'en'
      let url = `${window.location.origin}/${locale}/compare`
      if (mode === 'marketplace' && ids?.length) {
        url += `?ids=${ids.join(',')}`
      }
      navigator.clipboard?.writeText(url).then(() => onCopy?.())
    } catch {
      onCopy?.()
    }
  }
  return (
    <Button variant={variant} className={className} onClick={handleClick}>
      <Share2 className="mr-2 h-4 w-4" />
      Share
    </Button>
  )
}
