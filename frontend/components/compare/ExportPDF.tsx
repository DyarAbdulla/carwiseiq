"use client"

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface ExportPDFProps {
  data: unknown
  onSuccess?: () => void
  onError?: (e: Error) => void
  variant?: 'outline' | 'default'
  className?: string
}

export function ExportPDF({ data, onSuccess, onError, variant = 'outline', className }: ExportPDFProps) {
  const handleClick = () => {
    try {
      if (typeof window === 'undefined') return
      window.print()
      onSuccess?.()
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error('Export failed'))
    }
  }
  return (
    <Button variant={variant} className={className} onClick={handleClick}>
      <Download className="mr-2 h-4 w-4" />
      Export PDF
    </Button>
  )
}
