"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Share2, Copy, Check, FileText, FileSpreadsheet, ChevronDown, MessageCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { generateValuationPDF } from '@/lib/pdfGenerator'
import { cn } from '@/lib/utils'

interface ShareExportMenuProps {
  result: PredictionResponse
  carFeatures: CarFeatures
  showPdfExport?: boolean
  /** Compact trigger for bottom share bar */
  variant?: 'default' | 'bar' | 'embedded'
}

export function ShareExportMenu({
  result,
  carFeatures,
  showPdfExport = true,
  variant = 'default',
}: ShareExportMenuProps) {
  const t = useTranslations('predict.result')
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isProcessingPDF, setIsProcessingPDF] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<string>('')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://carwiseiq.com'

  const siteHost = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const generateShareText = () => {
    const carInfo = `${carFeatures.year} ${carFeatures.make} ${carFeatures.model}`.trim()
    const price = formatCurrency(result.predicted_price)
    return t('whatsappShareBody', { car: carInfo, price, site: siteHost })
  }

  const generateShareUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.href
    }
    const params = new URLSearchParams({
      make: carFeatures.make,
      model: carFeatures.model,
      year: carFeatures.year.toString(),
      mileage: carFeatures.mileage.toString(),
      condition: carFeatures.condition,
      price: result.predicted_price.toString(),
    })
    return `${siteUrl}/predict?${params.toString()}`
  }

  const openWhatsApp = () => {
    const text = generateShareText()
    const u = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(u, '_blank', 'noopener,noreferrer')
  }

  const handleCopy = async () => {
    try {
      const text = generateShareText()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: t('copiedTitle'),
        description: t('copiedDescription'),
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: t('errorTitle'),
        description: t('copyFailed'),
        variant: 'destructive',
      })
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: t('shareMenuTitle'),
      text: generateShareText(),
      url: generateShareUrl(),
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        console.log('Share cancelled')
      }
    } else {
      handleCopy()
    }
  }

  const handleExportExcel = async () => {
    try {
      const data = [
        {
          Make: carFeatures.make,
          Model: carFeatures.model,
          Year: carFeatures.year,
          'Mileage (km)': carFeatures.mileage,
          Condition: carFeatures.condition,
          'Fuel Type': carFeatures.fuel_type,
          Location: carFeatures.location,
          'Predicted Price': result.predicted_price,
          'Lower CI': result.confidence_interval?.lower || '',
          'Upper CI': result.confidence_interval?.upper || '',
          'Market Average': result.market_comparison?.market_average || '',
          'Deal Score': result.deal_score?.label || '',
        },
      ]

      const blob = await apiClient.exportExcel(data)
      apiClient.downloadBlob(blob, `car-prediction-${carFeatures.make}-${carFeatures.model}-${Date.now()}.xlsx`)

      toast({
        title: t('excelSuccess'),
        description: t('excelSuccessDesc'),
      })
    } catch (error) {
      toast({
        title: t('errorTitle'),
        description: t('excelFailed'),
        variant: 'destructive',
      })
    }
  }

  const handleExportPDF = async () => {
    setIsProcessingPDF(true)
    setPdfProgress(t('pdfInitializing'))

    try {
      await generateValuationPDF(result, carFeatures, (message) => {
        setPdfProgress(message)
        console.log('PDF Progress:', message)
      })

      toast({
        title: t('pdfSuccess'),
        description: t('pdfSuccessDesc'),
      })
    } catch (error) {
      console.error('PDF export error:', error)
      toast({
        title: t('errorTitle'),
        description: error instanceof Error ? error.message : t('pdfFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsProcessingPDF(false)
      setPdfProgress('')
    }
  }

  const triggerClass =
    variant === 'bar'
      ? 'h-9 px-3 border-violet-500/40 bg-violet-600/20 hover:bg-violet-500/30 text-white rounded-xl text-sm'
      : variant === 'embedded'
        ? 'h-10 px-4 border-violet-500/40 bg-gradient-to-r from-indigo-600/25 to-violet-600/25 hover:from-indigo-500/35 hover:to-violet-500/35 text-white rounded-xl text-sm shadow-md shadow-violet-900/20'
      : 'w-full sm:w-auto border-[#2a2d3a] bg-transparent hover:bg-[#2a2d3a] text-white hover:text-white'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(triggerClass)}>
          <span className="flex items-center gap-2">
            <Share2 className="h-4 w-4 shrink-0" />
            {t('shareExport')}
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[#1a1d29] border-[#2a2d3a] text-white">
        <DropdownMenuItem
          onClick={openWhatsApp}
          className="cursor-pointer focus:bg-violet-500/20"
        >
          <MessageCircle className="mr-2 h-4 w-4 text-emerald-400" />
          {t('shareWhatsApp')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer focus:bg-violet-500/20">
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              {t('copiedAction')}
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              {t('copyResults')}
            </>
          )}
        </DropdownMenuItem>
        {typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function' && (
          <DropdownMenuItem onClick={handleShare} className="cursor-pointer focus:bg-violet-500/20">
            <Share2 className="mr-2 h-4 w-4" />
            {t('nativeShare')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-white/10" />
        {showPdfExport && (
          <DropdownMenuItem onClick={handleExportPDF} disabled={isProcessingPDF} className="focus:bg-violet-500/20">
            <FileText className="mr-2 h-4 w-4" />
            {isProcessingPDF ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2">⏳</span>
                {pdfProgress || t('pdfProcessing')}
              </span>
            ) : (
              t('exportPdf')
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleExportExcel} className="focus:bg-violet-500/20">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t('exportExcel')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
