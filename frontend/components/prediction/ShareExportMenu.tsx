"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Share2, Copy, Check, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { generateValuationPDF } from '@/lib/pdfGenerator'

interface ShareExportMenuProps {
  result: PredictionResponse
  carFeatures: CarFeatures
  showPdfExport?: boolean
}

export function ShareExportMenu({ result, carFeatures, showPdfExport = true }: ShareExportMenuProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isProcessingPDF, setIsProcessingPDF] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<string>('')

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

  const handleExportExcel = async () => {
    try {
      const data = [{
        'Make': carFeatures.make,
        'Model': carFeatures.model,
        'Year': carFeatures.year,
        'Mileage (km)': carFeatures.mileage,
        'Condition': carFeatures.condition,
        'Fuel Type': carFeatures.fuel_type,
        'Location': carFeatures.location,
        'Predicted Price': result.predicted_price,
        'Lower CI': result.confidence_interval?.lower || '',
        'Upper CI': result.confidence_interval?.upper || '',
        'Market Average': result.market_comparison?.market_average || '',
        'Deal Score': result.deal_score?.label || '',
      }]

      const blob = await apiClient.exportExcel(data)
      apiClient.downloadBlob(blob, `car-prediction-${carFeatures.make}-${carFeatures.model}-${Date.now()}.xlsx`)

      toast({
        title: 'Success',
        description: 'Excel file downloaded successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export Excel file',
        variant: 'destructive',
      })
    }
  }

  const handleExportPDF = async () => {
    setIsProcessingPDF(true)
    setPdfProgress('Initializing...')

    try {
      await generateValuationPDF(result, carFeatures, (message) => {
        setPdfProgress(message)
        console.log('PDF Progress:', message)
      })

      toast({
        title: 'Success',
        description: 'Valuation certificate downloaded successfully',
      })
    } catch (error) {
      console.error('PDF export error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to export PDF file',
        variant: 'destructive',
      })
    } finally {
      setIsProcessingPDF(false)
      setPdfProgress('')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto border-[#2a2d3a] bg-transparent hover:bg-[#2a2d3a] text-white hover:text-white"
        >
          Share / Export
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopy}>
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
        </DropdownMenuItem>
        {typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function' && (
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {showPdfExport && (
          <DropdownMenuItem
            onClick={handleExportPDF}
            disabled={isProcessingPDF}
          >
            <FileText className="mr-2 h-4 w-4" />
            {isProcessingPDF ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2">⏳</span>
                {pdfProgress || 'Processing Image...'}
              </span>
            ) : (
              'Export PDF'
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
