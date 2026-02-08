"use client"

import { Button } from '@/components/ui/button'
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { generateValuationPDF } from '@/lib/pdfGenerator'

interface ExportButtonsProps {
  result: PredictionResponse
  carFeatures: CarFeatures
}

export function ExportButtons({ result, carFeatures }: ExportButtonsProps) {
  const { toast } = useToast()

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
    try {
      await generateValuationPDF(result, carFeatures)
      toast({
        title: 'Success',
        description: 'Valuation certificate downloaded successfully',
      })
    } catch (error) {
      console.error('PDF export error:', error)
      toast({
        title: 'Error',
        description: 'Failed to export PDF file',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportExcel}
        className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a]"
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a]"
      >
        <FileText className="mr-2 h-4 w-4" />
        Export PDF
      </Button>
    </div>
  )
}






