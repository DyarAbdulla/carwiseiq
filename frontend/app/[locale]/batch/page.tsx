"use client"
export const runtime = 'edge';

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileSpreadsheet, Download, X, FileDown, ArrowUpDown, ArrowUp, ArrowDown, Link as LinkIcon, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import type { CarFeatures, BatchPredictionResult } from '@/lib/types'
import Papa from 'papaparse'
import { motion, AnimatePresence } from 'framer-motion'
import { detectPlatform, isValidUrl, isCarListingUrl } from '@/utils/platformDetection'
import { PlatformBadge } from '@/components/batch/PlatformBadge'
import { LoadingStages } from '@/components/batch/LoadingStages'
import { UrlResultCard } from '@/components/batch/UrlResultCard'
import { StatsDashboard } from '@/components/batch/StatsDashboard'
import { FilterPanel } from '@/components/batch/FilterPanel'
import { DealQualityTooltip } from '@/components/batch/DealQualityTooltip'
import { ConfidenceBreakdown } from '@/components/batch/ConfidenceBreakdown'
import { BulkUrlProcessor } from '@/components/batch/BulkUrlProcessor'
import { ExportOptions } from '@/components/batch/ExportOptions'
import { CompareMode } from '@/components/batch/CompareMode'
import { MobileCardView } from '@/components/batch/MobileCardView'
import { PriceAlertManager } from '@/components/batch/PriceAlertManager'
import { ErrorDisplay, createError } from '@/components/batch/ErrorDisplay'
import { useFavorites } from '@/hooks/useFavorites'
import { Checkbox } from '@/components/ui/checkbox'

type SortField = 'make' | 'model' | 'year' | 'mileage' | 'condition' | 'predicted_price' | 'confidence' | 'deal_rating'
type SortDirection = 'asc' | 'desc' | null

interface ExtendedResult extends BatchPredictionResult {
  confidence_percent?: number
  price_range?: { min: number; max: number }
  deal_rating?: 'Good' | 'Fair' | 'Poor'
}

export default function BatchPage() {
  // All hooks must be called before any conditional returns
  const [mounted, setMounted] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<BatchPredictionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentProcessing, setCurrentProcessing] = useState({ current: 0, total: 0 })
  const [dragActive, setDragActive] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [urlInput, setUrlInput] = useState('')
  const [filteredResults, setFilteredResults] = useState<ExtendedResult[]>([])
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [urlLoading, setUrlLoading] = useState(false)
  const [detectedPlatform, setDetectedPlatform] = useState<ReturnType<typeof detectPlatform>>(null)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<number>>(new Set())
  const [error, setError] = useState<ReturnType<typeof createError> | null>(null)
  const statsDashboardRef = useRef<HTMLDivElement>(null)
  const favorites = useFavorites()
  const [isMobile, setIsMobile] = useState(false)
  const [inputMode, setInputMode] = useState<'bulk-url' | 'csv'>('bulk-url')
  const [urlResult, setUrlResult] = useState<{
    extracted_data: CarFeatures
    predicted_price: number
    listing_price?: number
    price_comparison?: {
      listing_price: number
      predicted_price: number
      difference: number
      difference_percent: number
      is_above_market: boolean
      is_below_market: boolean
    }
    confidence_interval?: {
      lower: number
      upper: number
    }
    message?: string
    listing_url?: string
    car_image?: string
  } | null>(null)

  // All hooks must be called unconditionally
  const t = useTranslations('batch')
  const tCommon = useTranslations('common')
  const toastHook = useToast()
  const toast = toastHook || { toast: () => { } }

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const checkMobile = () => setIsMobile(window.innerWidth < 768)
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // Platform detection when URL changes
  useEffect(() => {
    if (urlInput && urlInput.trim()) {
      const platform = detectPlatform(urlInput)
      setDetectedPlatform(platform)
    } else {
      setDetectedPlatform(null)
    }
  }, [urlInput])

  // Enhanced results with computed fields - MUST be before conditional return
  const enhancedResults: ExtendedResult[] = useMemo(() => {
    if (results.length === 0) return []

    const avgPrice = results.reduce((sum, r) => sum + (r.predicted_price || 0), 0) / results.length

    return results.map((result) => {
      const confidencePercent = result.confidence_interval
        ? Math.round((1 - (result.confidence_interval.upper - result.confidence_interval.lower) / result.predicted_price) * 100)
        : undefined

      const priceRange = result.confidence_interval
        ? { min: result.confidence_interval.lower, max: result.confidence_interval.upper }
        : undefined

      // Determine deal rating based on price relative to average
      let dealRating: 'Good' | 'Fair' | 'Poor' = 'Fair'
      if (result.predicted_price > 0 && avgPrice > 0) {
        const priceRatio = result.predicted_price / avgPrice
        if (priceRatio < 0.85) dealRating = 'Good'
        else if (priceRatio > 1.15) dealRating = 'Poor'
        else dealRating = 'Fair'
      }

      return {
        ...result,
        confidence_percent: confidencePercent,
        price_range: priceRange,
        deal_rating: dealRating,
      }
    })
  }, [results])

  // Sorting logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Update filtered results when enhanced results change
  useEffect(() => {
    setFilteredResults(enhancedResults)
  }, [enhancedResults])

  const sortedResults = useMemo(() => {
    const resultsToSort = filteredResults.length > 0 ? filteredResults : enhancedResults
    if (!sortField || !sortDirection) return resultsToSort

    return [...resultsToSort].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'make':
          aVal = a.car.make
          bVal = b.car.make
          break
        case 'model':
          aVal = a.car.model
          bVal = b.car.model
          break
        case 'year':
          aVal = a.car.year
          bVal = b.car.year
          break
        case 'mileage':
          aVal = a.car.mileage
          bVal = b.car.mileage
          break
        case 'condition':
          aVal = a.car.condition
          bVal = b.car.condition
          break
        case 'predicted_price':
          aVal = a.predicted_price
          bVal = b.predicted_price
          break
        case 'confidence':
          aVal = a.confidence_percent ?? 0
          bVal = b.confidence_percent ?? 0
          break
        case 'deal_rating':
          const ratingOrder = { 'Good': 1, 'Fair': 2, 'Poor': 3 }
          aVal = ratingOrder[a.deal_rating ?? 'Fair']
          bVal = ratingOrder[b.deal_rating ?? 'Fair']
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredResults, enhancedResults, sortField, sortDirection])

  // Summary stats
  const summaryStats = useMemo(() => {
    if (sortedResults.length === 0) return null

    const successful = sortedResults.filter(r => !r.error)
    const avgPrice = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.predicted_price, 0) / successful.length
      : 0

    const bestDeal = sortedResults
      .filter(r => !r.error && r.deal_rating === 'Good')
      .sort((a, b) => a.predicted_price - b.predicted_price)[0]

    const highestValue = sortedResults
      .filter(r => !r.error)
      .sort((a, b) => b.predicted_price - a.predicted_price)[0]

    return {
      total: sortedResults.length,
      successful: successful.length,
      failed: sortedResults.filter(r => r.error).length,
      averagePrice: avgPrice,
      bestDeal: bestDeal ? `${bestDeal.car.make} ${bestDeal.car.model}` : 'N/A',
      highestValue: highestValue ? `${highestValue.car.make} ${highestValue.car.model}` : 'N/A',
    }
  }, [sortedResults])

  // Don't render until mounted
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#94a3b8]">Loading...</div>
      </div>
    )
  }

  // Download sample CSV
  const handleDownloadSample = () => {
    if (typeof window === 'undefined') {
      console.warn('Download is only available in the browser')
      return
    }

    try {
      const sampleData = [
        {
          year: '2020',
          mileage: '30000',
          engine_size: '2.5',
          cylinders: '4',
          make: 'Toyota',
          model: 'Camry',
          condition: 'Good',
          fuel_type: 'Gasoline',
          location: 'California'
        },
        {
          year: '2019',
          mileage: '45000',
          engine_size: '3.5',
          cylinders: '6',
          make: 'Honda',
          model: 'Accord',
          condition: 'Excellent',
          fuel_type: 'Gasoline',
          location: 'New York'
        },
        {
          year: '2021',
          mileage: '15000',
          engine_size: '2.0',
          cylinders: '4',
          make: 'Ford',
          model: 'Fusion',
          condition: 'Very Good',
          fuel_type: 'Hybrid',
          location: 'Texas'
        }
      ]

      const csv = Papa.unparse(sampleData)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'sample_batch_cars.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      if (toast?.toast) {
        toast.toast({
          title: tCommon('success'),
          description: 'Sample CSV downloaded successfully',
        })
      }
    } catch (error) {
      console.error('Error downloading sample CSV:', error)
      if (toast?.toast) {
        toast.toast({
          title: tCommon('error') || 'Error',
          description: 'Failed to download sample CSV',
          variant: 'destructive',
        })
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e?.target?.files && e.target.files[0]) {
        const selectedFile = e.target.files[0]
        validateAndSetFile(selectedFile)
      }
    } catch (error) {
      console.error('Error handling file change:', error)
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: 'Failed to process file',
          variant: 'destructive',
        })
      }
    }
  }

  const validateAndSetFile = (selectedFile: File | null | undefined) => {
    try {
      if (!selectedFile) {
        if (toast?.toast) {
          toast.toast({
            title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
            description: 'No file selected',
            variant: 'destructive',
          })
        }
        return
      }

      // Validate file type
      if (!selectedFile.name || !selectedFile.name.endsWith('.csv')) {
        if (toast?.toast) {
          toast.toast({
            title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
            description: 'Please upload a CSV file',
            variant: 'destructive',
          })
        }
        return
      }

      // Validate file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        if (toast?.toast) {
          toast.toast({
            title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
            description: 'File size must be less than 5MB',
            variant: 'destructive',
          })
        }
        return
      }

      setFile(selectedFile)
    } catch (error) {
      console.error('Error validating file:', error)
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: 'Failed to validate file',
          variant: 'destructive',
        })
      }
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e?.dataTransfer?.files && e.dataTransfer.files[0]) {
        validateAndSetFile(e.dataTransfer.files[0])
      }
    } catch (error) {
      console.error('Error handling file drop:', error)
      setDragActive(false)
    }
  }

  const handleProcess = async () => {
    console.log('🚀 [Batch] Process button clicked')

    if (!file) {
      console.log('❌ [Batch] No file selected')
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: 'Please select a CSV file',
          variant: 'destructive',
        })
      }
      return
    }

    console.log('📄 [Batch] File selected:', file.name, 'Size:', file.size, 'bytes')
    setLoading(true)
    setResults([])
    setProgress(0)
    setCurrentProcessing({ current: 0, total: 0 })

    try {
      console.log('📊 [Batch] Starting CSV parsing...')

      // Read file content for parsing
      const reader = new FileReader()
      reader.onload = async (e) => {
        const content = e.target?.result as string
        console.log('📄 [Batch] Raw CSV content (first 500 chars):')
        console.log(content.substring(0, 500))
        console.log('📄 [Batch] Raw CSV lines:', content.split('\n').length)

        setProgress(25)

        // Parse the string content instead of File object
        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          complete: async (parseResults) => {
            console.log('✅ [Batch] CSV parsed successfully')
            console.log('📋 [Batch] Total rows:', parseResults.data.length)
            console.log('🔍 [Batch] Parse results meta:', parseResults.meta)
            console.log('🔍 [Batch] Headers detected:', parseResults.meta?.fields)
            console.log('🔍 [Batch] First 3 rows (raw):', parseResults.data.slice(0, 3))
            console.log('🔍 [Batch] Sample row keys:', parseResults.data[0] ? Object.keys(parseResults.data[0]) : 'No data')
            console.log('🔍 [Batch] Sample row values:', parseResults.data[0])

            // Set preview (first 5 rows)
            setCsvPreview(parseResults.data.slice(0, 5))
            setProgress(50)

            // Validate row count (max 1000)
            if (parseResults.data.length > 1000) {
              if (toast?.toast) {
                toast.toast({
                  title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
                  description: 'Maximum 1000 rows allowed. Please split your file.',
                  variant: 'destructive',
                })
              }
              setLoading(false)
              setProgress(0)
              setCurrentProcessing({ current: 0, total: 0 })
              return
            }

            // Filter and log each row
            const allRows = parseResults.data as any[]
            console.log('🔍 [Batch] Starting row filtering...')
            console.log('🔍 [Batch] Total raw rows:', allRows.length)

            const validRows = allRows.filter((row: any, index: number) => {
              const hasYear = !!row.year
              const hasMake = !!row.make
              const hasModel = !!row.model
              const isValid = hasYear && hasMake && hasModel

              if (index < 3) {
                console.log(`🔍 [Batch] Row ${index + 1}:`, row)
                console.log(`  - year: "${row.year}" (${hasYear})`)
                console.log(`  - make: "${row.make}" (${hasMake})`)
                console.log(`  - model: "${row.model}" (${hasModel})`)
                console.log(`  - Valid: ${isValid}`)
              }

              return isValid
            })

            console.log('🔍 [Batch] Valid rows after filter:', validRows.length)

            const cars: CarFeatures[] = validRows.map((row: any) => ({
              year: parseInt(row.year),
              mileage: parseFloat(row.mileage) || 0,
              engine_size: parseFloat(row.engine_size) || 2.5,
              cylinders: parseInt(row.cylinders) || 4,
              make: row.make,
              model: row.model,
              condition: row.condition || 'Good',
              fuel_type: row.fuel_type || 'Gasoline',
              location: row.location || 'Unknown',
            }))

            console.log('🚗 [Batch] Valid cars parsed:', cars.length)
            console.log('📦 [Batch] First car sample:', cars[0])

            if (cars.length === 0) {
              console.log('❌ [Batch] No valid cars found')
              if (toast?.toast) {
                toast.toast({
                  title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
                  description: 'No valid car data found in CSV. Please check required columns: year, make, model',
                  variant: 'destructive',
                })
              }
              setLoading(false)
              setProgress(0)
              setCurrentProcessing({ current: 0, total: 0 })
              return
            }

            setProgress(60)
            setCurrentProcessing({ current: 0, total: cars.length })

            // Process predictions with progress updates
            console.log('🔮 [Batch] Sending batch prediction request...')
            console.log('📊 [Batch] Number of cars to predict:', cars.length)

            // Use batch endpoint with progress tracking simulation
            try {
              const response = await apiClient.predictBatch(cars)
              setProgress(100)
              setCurrentProcessing({ current: cars.length, total: cars.length })
              setResults(response)

              console.log('✅ [Batch] Predictions received:', response.length)
              console.log('💰 [Batch] First prediction sample:', response[0])

              if (toast?.toast) {
                toast.toast({
                  title: (tCommon && typeof tCommon === 'function' ? tCommon('success') : null) || 'Success',
                  description: `Processed ${response.length} cars successfully`,
                })
              }
            } catch (error: any) {
              console.error('❌ [Batch] Batch prediction failed:', error)
              if (toast?.toast) {
                toast.toast({
                  title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
                  description: error?.message || 'Failed to process batch',
                  variant: 'destructive',
                })
              }
              setLoading(false)
              setProgress(0)
              setCurrentProcessing({ current: 0, total: 0 })
            }
          },
          error: (error: Error) => {
            console.error('❌ [Batch] Papa Parse error:', error)
            if (toast?.toast) {
              toast.toast({
                title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
                description: `CSV parsing error: ${error?.message || 'Unknown error'}`,
                variant: 'destructive',
              })
            }
            setLoading(false)
            setProgress(0)
            setCurrentProcessing({ current: 0, total: 0 })
          },
        })
      }

      // Read file as text
      reader.readAsText(file)
    } catch (error: any) {
      console.error('❌ [Batch] Error processing batch:', error)
      console.error('❌ [Batch] Error message:', error?.message)
      console.error('❌ [Batch] Error stack:', error?.stack)
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: error?.message || 'Failed to process batch',
          variant: 'destructive',
        })
      }
      setLoading(false)
      setProgress(0)
      setCurrentProcessing({ current: 0, total: 0 })
    } finally {
      console.log('🏁 [Batch] Process completed, loading:', false)
      setLoading(false)
    }
  }

  const handleSortClick = (field: SortField) => (e: React.MouseEvent) => {
    e.preventDefault()
    handleSort(field)
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    if (sortDirection === 'asc') return <ArrowUp className="h-3 w-3 ml-1 text-[#5B7FFF]" />
    if (sortDirection === 'desc') return <ArrowDown className="h-3 w-3 ml-1 text-[#5B7FFF]" />
    return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
  }

  const handleExportCSV = () => {
    if (typeof window === 'undefined') {
      console.warn('Export is only available in the browser')
      return
    }

    if (sortedResults.length === 0) {
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: 'No results to export',
          variant: 'destructive',
        })
      }
      return
    }

    try {
      const exportData = sortedResults.map((result) => ({
        make: result.car.make,
        model: result.car.model,
        year: result.car.year,
        mileage: result.car.mileage,
        condition: result.car.condition,
        fuel_type: result.car.fuel_type,
        location: result.car.location,
        predicted_price: result.predicted_price,
        confidence_percent: result.confidence_percent ?? 'N/A',
        price_range_min: result.price_range?.min ?? 'N/A',
        price_range_max: result.price_range?.max ?? 'N/A',
        deal_rating: result.deal_rating ?? 'N/A',
        error: result.error ?? '',
      }))

      const csv = Papa.unparse(exportData)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      apiClient.downloadBlob(blob, 'batch_predictions.csv')

      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('success') : null) || 'Success',
          description: 'CSV file exported successfully',
        })
      }
    } catch (error: any) {
      console.error('Error exporting CSV:', error)
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: error?.message || 'Failed to export CSV',
          variant: 'destructive',
        })
      }
    }
  }

  const handleExportExcel = async () => {
    if (typeof window === 'undefined') {
      console.warn('Export is only available in the browser')
      return
    }

    if (sortedResults.length === 0) {
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: 'No results to export',
          variant: 'destructive',
        })
      }
      return
    }

    try {
      const exportData = sortedResults.map((result) => ({
        make: result.car.make,
        model: result.car.model,
        year: result.car.year,
        mileage: result.car.mileage,
        condition: result.car.condition,
        fuel_type: result.car.fuel_type,
        location: result.car.location,
        predicted_price: result.predicted_price,
        confidence_percent: result.confidence_percent ?? 'N/A',
        price_range_min: result.price_range?.min ?? 'N/A',
        price_range_max: result.price_range?.max ?? 'N/A',
        deal_rating: result.deal_rating ?? 'N/A',
        error: result.error ?? '',
      }))

      const blob = await apiClient.exportExcel(exportData)
      apiClient.downloadBlob(blob, 'batch_predictions.xlsx')

      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('success') : null) || 'Success',
          description: 'Excel file exported successfully',
        })
      }
    } catch (error: any) {
      console.error('Error exporting Excel:', error)
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: error?.message || 'Failed to export Excel',
          variant: 'destructive',
        })
      }
    }
  }


  const handleUrlPredict = async () => {
    if (!urlInput || !urlInput.trim()) {
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: 'Please enter a car listing URL',
          variant: 'destructive',
        })
      }
      return
    }

    // Validate URL format
    if (!isValidUrl(urlInput.trim())) {
      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('error') : null) || 'Error',
          description: 'Invalid URL format. Please enter a valid URL starting with http:// or https://',
          variant: 'destructive',
        })
      }
      return
    }

    // Warn if URL doesn't look like a car listing
    if (!isCarListingUrl(urlInput.trim()) && !detectedPlatform) {
      if (toast?.toast) {
        toast.toast({
          title: 'Warning',
          description: 'This URL may not be a car listing. Continue anyway?',
          variant: 'default',
        })
      }
    }

    setUrlLoading(true)
    setUrlResult(null)

    try {
      const result = await apiClient.predictFromUrl(urlInput.trim())
      setUrlResult({
        ...result,
        listing_url: urlInput.trim(),
      })

      if (toast?.toast) {
        toast.toast({
          title: (tCommon && typeof tCommon === 'function' ? tCommon('success') : null) || 'Success',
          description: 'Car details extracted and price predicted successfully',
        })
      }
    } catch (error: any) {
      console.error('Error predicting from URL:', error)
      const errorDisplay = createError(error, urlInput)
      setError(errorDisplay)
      if (toast?.toast) {
        toast.toast({
          title: errorDisplay.title,
          description: errorDisplay.message,
          variant: 'destructive',
        })
      }
    } finally {
      setUrlLoading(false)
    }
  }

  return (
    <div className="container py-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">{(t && typeof t === 'function' ? t('title') : null) || 'Batch Prediction'}</h1>
          <p className="text-[#94a3b8]">{(t && typeof t === 'function' ? t('description') : null) || 'Upload a CSV file to predict prices for multiple cars'}</p>
        </div>

        {/* Input Section with Ambient Glow */}
        <div className="relative mb-8">
          {/* Purple/Indigo Ambient Glow */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-500/20 via-indigo-500/15 to-transparent rounded-3xl blur-3xl opacity-50" />

          {/* Floating Tab Toggle - Standalone Pill */}
          <div className="flex items-center gap-2 mb-6 p-1 bg-black/40 backdrop-blur-sm rounded-full border border-white/10 w-fit">
            <button
              onClick={() => setInputMode('bulk-url')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${inputMode === 'bulk-url'
                  ? 'bg-[#5B7FFF] text-white shadow-lg shadow-[#5B7FFF]/20'
                  : 'text-[#94a3b8] hover:text-white'
                }`}
            >
              Bulk URL
            </button>
            <button
              onClick={() => setInputMode('csv')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${inputMode === 'csv'
                  ? 'bg-[#5B7FFF] text-white shadow-lg shadow-[#5B7FFF]/20'
                  : 'text-[#94a3b8] hover:text-white'
                }`}
            >
              CSV Upload
            </button>
          </div>

          {/* Bulk URL Mode */}
          {inputMode === 'bulk-url' && (
            <BulkUrlProcessor
              onResults={(bulkResults) => {
                const newResults = bulkResults.map((r) => ({
                  car: r.result.extracted_data,
                  predicted_price: r.result.predicted_price,
                  confidence_interval: r.result.confidence_interval,
                }))
                setResults([...results, ...newResults])
              }}
            />
          )}

          {/* CSV Upload Mode */}
          {inputMode === 'csv' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Upload CSV File</h3>
                <p className="text-sm text-slate-400 mb-4">
                  {(t && typeof t === 'function' ? t('upload.instructions') : null) || 'Upload a CSV file with car data'}
                </p>
              </div>

              {/* Step Progress Visual */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center flex-1">
                  <div className={`flex flex-col items-center flex-1 ${file ? 'opacity-100' : 'opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${file ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/10 text-slate-400'
                      }`}>
                      {file ? <CheckCircle2 className="h-5 w-5" /> : '1'}
                    </div>
                    <span className="text-xs text-slate-400">Upload</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-2 ${file ? 'bg-indigo-600' : 'bg-white/10'}`} />
                  <div className={`flex flex-col items-center flex-1 ${loading ? 'opacity-100' : 'opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${loading ? 'bg-indigo-600 text-white' : file ? 'bg-white/5 border border-white/10 text-slate-400' : 'bg-white/5 border border-white/10 text-slate-400'
                      }`}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : '2'}
                    </div>
                    <span className="text-xs text-slate-400">Processing</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-2 ${results.length > 0 ? 'bg-indigo-600' : 'bg-white/10'}`} />
                  <div className={`flex flex-col items-center flex-1 ${results.length > 0 ? 'opacity-100' : 'opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${results.length > 0 ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/10 text-slate-400'
                      }`}>
                      {results.length > 0 ? <CheckCircle2 className="h-5 w-5" /> : '3'}
                    </div>
                    <span className="text-xs text-slate-400">Results</span>
                  </div>
                </div>
              </div>

              {/* Glass Dropzone */}
              <div className="flex items-center gap-4">
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed rounded-2xl cursor-pointer transition-all backdrop-blur-xl bg-white/5 border-white/10 ${dragActive
                        ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/30 scale-[1.02]'
                        : 'hover:border-indigo-500/50 hover:bg-white/10'
                      }`}
                  >
                    {file ? (
                      <div className="text-center p-6">
                        <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4 mx-auto">
                          <FileSpreadsheet className="h-8 w-8 text-indigo-400" />
                        </div>
                        <p className="text-base text-white font-semibold mb-1">{file.name}</p>
                        <p className="text-sm text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                        <p className="text-xs text-indigo-400 mt-2">Ready to process</p>
                      </div>
                    ) : (
                      <div className="text-center p-6">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 mx-auto">
                          <Upload className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-base text-white font-medium mb-2">{(t && typeof t === 'function' ? t('upload.placeholder') : null) || 'Click to upload CSV file'}</p>
                        <p className="text-sm text-slate-400">
                          Drag & drop or click to browse
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          Max 5MB • Up to 1000 rows
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Progress Bar */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#94a3b8]">
                        {currentProcessing.total > 0
                          ? `Processing ${currentProcessing.current}/${currentProcessing.total} cars...`
                          : 'Processing...'}
                      </span>
                      <span className="text-[#5B7FFF] font-medium">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <motion.div
                        className="h-full bg-[#5B7FFF]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={handleProcess}
                  disabled={!file || loading}
                  className="flex-1 bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 min-w-[120px]"
                >
                  {loading ? 'Processing...' : ((t && typeof t === 'function' ? t('process') : null) || 'Process')}
                </Button>
                <Button
                  onClick={handleDownloadSample}
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download Sample CSV
                </Button>
                {file && !loading && (
                  <Button
                    onClick={() => {
                      setFile(null)
                      setResults([])
                      setProgress(0)
                      setCurrentProcessing({ current: 0, total: 0 })
                    }}
                    variant="outline"
                    size="icon"
                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* URL Prediction Section */}
        <div className="mb-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon className="h-5 w-5 text-[#5B7FFF]" />
              <h3 className="text-xl font-semibold text-white">Predict Price from Car Listing URL</h3>
            </div>
            <p className="text-sm text-[#94a3b8]">
              Paste a car listing URL to extract details and predict price
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type="url"
                    placeholder="https://www.iqcars.net/en/car/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !urlLoading) {
                        handleUrlPredict()
                      }
                    }}
                    disabled={urlLoading}
                    className="pr-12"
                  />
                  {detectedPlatform && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <PlatformBadge platform={detectedPlatform} />
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleUrlPredict}
                  disabled={!urlInput.trim() || urlLoading}
                  className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 min-w-[180px]"
                >
                  {urlLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze & Predict Price'
                  )}
                </Button>
              </div>

              {/* Loading Stages */}
              {urlLoading && <LoadingStages isLoading={urlLoading} />}
            </div>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <ErrorDisplay
                  error={error}
                  onRetry={handleUrlPredict}
                  onDismiss={() => setError(null)}
                />
              )}
            </AnimatePresence>

            {/* URL Prediction Results */}
            <AnimatePresence>
              {urlResult && (
                <UrlResultCard
                  extractedData={urlResult.extracted_data}
                  predictedPrice={urlResult.predicted_price}
                  listingPrice={urlResult.listing_price}
                  priceComparison={urlResult.price_comparison}
                  confidenceInterval={urlResult.confidence_interval}
                  listingUrl={urlResult.listing_url}
                  carImage={urlResult.car_image}
                  message={urlResult.message}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Filter Panel */}
        {enhancedResults.length > 0 && (
          <FilterPanel results={enhancedResults} onFilterChange={setFilteredResults} />
        )}

        {/* Summary Stats Row - Floating Numbers */}
        <AnimatePresence>
          {summaryStats && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="flex flex-col items-start">
                  <p className="text-xs uppercase tracking-wider text-[#94a3b8] mb-1">Total Cars</p>
                  <p className="text-3xl font-bold text-white">{summaryStats.total}</p>
                </div>
                <div className="flex flex-col items-start">
                  <p className="text-xs uppercase tracking-wider text-[#94a3b8] mb-1">Successful</p>
                  <p className="text-3xl font-bold text-green-500">{summaryStats.successful}</p>
                </div>
                <div className="flex flex-col items-start">
                  <p className="text-xs uppercase tracking-wider text-[#94a3b8] mb-1">Failed</p>
                  <p className="text-3xl font-bold text-red-500">{summaryStats.failed}</p>
                </div>
                <div className="flex flex-col items-start">
                  <p className="text-xs uppercase tracking-wider text-[#94a3b8] mb-1">Average Price</p>
                  <p className="text-3xl font-bold text-[#5B7FFF]">
                    {formatCurrency(summaryStats.averagePrice)}
                  </p>
                </div>
                <div className="flex flex-col items-start">
                  <p className="text-xs uppercase tracking-wider text-[#94a3b8] mb-1">Best Deal</p>
                  <p className="text-xl font-semibold text-green-500">{summaryStats.bestDeal}</p>
                </div>
                <div className="flex flex-col items-start">
                  <p className="text-xs uppercase tracking-wider text-[#94a3b8] mb-1">Highest Value</p>
                  <p className="text-xl font-semibold text-[#5B7FFF]">{summaryStats.highestValue}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Statistics Dashboard */}
        {enhancedResults.length > 0 && (
          <div className="mb-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Analytics Dashboard</h3>
              <p className="text-sm text-[#94a3b8]">
                Visual insights into your batch predictions
              </p>
            </div>
            <div ref={statsDashboardRef}>
              <StatsDashboard results={enhancedResults} />
            </div>
          </div>
        )}

        {/* Price Alert Manager - Always visible for managing alerts */}
        <PriceAlertManager />

        {/* Compare Mode */}
        {selectedForCompare.size > 0 && (
          <CompareMode
            results={sortedResults}
            selectedIds={selectedForCompare}
            onSelectionChange={(id, selected) => {
              const newSet = new Set(selectedForCompare)
              if (selected) {
                if (newSet.size < 4) {
                  newSet.add(id)
                }
              } else {
                newSet.delete(id)
              }
              setSelectedForCompare(newSet)
            }}
            onClearSelection={() => setSelectedForCompare(new Set())}
          />
        )}

        {/* Results Table - Desktop View */}
        <AnimatePresence>
          {mounted && !isMobile && sortedResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">{(t && typeof t === 'function' ? t('results.title') : null) || 'Results'}</h3>
                    <p className="text-sm text-[#94a3b8]">
                      {sortedResults.length} cars processed
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button
                      onClick={handleExportExcel}
                      variant="outline"
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Export Excel
                    </Button>
                    <ExportOptions results={enhancedResults} statsDashboardRef={statsDashboardRef} />
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10">
                  <div className="inline-block min-w-full align-middle">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow className="border-white/10 bg-white/5 backdrop-blur-md">
                          <TableHead className="text-xs uppercase tracking-wider text-[#94a3b8] w-12 hidden md:table-cell font-semibold">
                            Compare
                          </TableHead>
                          <TableHead
                            className="text-xs uppercase tracking-wider text-[#94a3b8] cursor-pointer hover:text-white transition-colors font-semibold"
                            onClick={handleSortClick('make')}
                          >
                            <div className="flex items-center">
                              Make
                              {getSortIcon('make')}
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-xs uppercase tracking-wider text-[#94a3b8] cursor-pointer hover:text-white transition-colors font-semibold"
                            onClick={handleSortClick('model')}
                          >
                            <div className="flex items-center">
                              Model
                              {getSortIcon('model')}
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-xs uppercase tracking-wider text-[#94a3b8] cursor-pointer hover:text-white transition-colors font-semibold"
                            onClick={handleSortClick('year')}
                          >
                            <div className="flex items-center">
                              Year
                              {getSortIcon('year')}
                            </div>
                          </TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-[#94a3b8] hidden md:table-cell font-semibold">Mileage</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-[#94a3b8] hidden lg:table-cell font-semibold">Condition</TableHead>
                          <TableHead
                            className="text-right text-xs uppercase tracking-wider text-[#94a3b8] cursor-pointer hover:text-white transition-colors font-semibold"
                            onClick={handleSortClick('predicted_price')}
                          >
                            <div className="flex items-center justify-end">
                              Price
                              {getSortIcon('predicted_price')}
                            </div>
                          </TableHead>
                          <TableHead
                            className="text-center text-xs uppercase tracking-wider text-[#94a3b8] cursor-pointer hover:text-white transition-colors hidden lg:table-cell font-semibold"
                            onClick={handleSortClick('confidence')}
                          >
                            <div className="flex items-center justify-center">
                              Confidence
                              {getSortIcon('confidence')}
                            </div>
                          </TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-[#94a3b8] hidden xl:table-cell font-semibold">Price Range</TableHead>
                          <TableHead
                            className="text-center text-xs uppercase tracking-wider text-[#94a3b8] cursor-pointer hover:text-white transition-colors font-semibold"
                            onClick={handleSortClick('deal_rating')}
                          >
                            <div className="flex items-center justify-center">
                              Deal
                              {getSortIcon('deal_rating')}
                            </div>
                          </TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-[#94a3b8] text-center font-semibold">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {sortedResults.map((result, index) => {
                            const favoriteId = `${result.car.make}-${result.car.model}-${result.car.year}-${index}`
                            const isFavorite = favorites.isFavorite(favoriteId)

                            return (
                              <motion.tr
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.02 }}
                                className="border-b border-white/10 hover:bg-white/10 hover:backdrop-blur-md transition-all cursor-pointer"
                              >
                                <TableCell className="text-center hidden md:table-cell">
                                  <Checkbox
                                    checked={selectedForCompare.has(index)}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set(selectedForCompare)
                                      if (checked && newSet.size < 4) {
                                        newSet.add(index)
                                      } else {
                                        newSet.delete(index)
                                      }
                                      setSelectedForCompare(newSet)
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="text-white font-medium">{result.car.make}</TableCell>
                                <TableCell className="text-white">{result.car.model}</TableCell>
                                <TableCell className="text-white">{result.car.year}</TableCell>
                                <TableCell className="text-white hidden md:table-cell">
                                  {result.car.mileage.toLocaleString()} km
                                </TableCell>
                                <TableCell className="text-white hidden lg:table-cell">{result.car.condition}</TableCell>
                                <TableCell className="text-right font-semibold text-[#5B7FFF]">
                                  {result.error ? (
                                    <span className="text-red-500">N/A</span>
                                  ) : (
                                    formatCurrency(result.predicted_price)
                                  )}
                                </TableCell>
                                <TableCell className="text-center hidden lg:table-cell">
                                  {result.confidence_percent !== undefined ? (
                                    <ConfidenceBreakdown result={result}>
                                      <span className={`font-medium cursor-pointer hover:underline ${result.confidence_percent >= 80 ? 'text-green-500' :
                                          result.confidence_percent >= 60 ? 'text-yellow-500' :
                                            'text-red-500'
                                        }`}>
                                        {result.confidence_percent}%
                                      </span>
                                    </ConfidenceBreakdown>
                                  ) : (
                                    <span className="text-[#94a3b8]">N/A</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-[#94a3b8] text-sm hidden xl:table-cell">
                                  {result.price_range ? (
                                    <div className="flex flex-col">
                                      <span>{formatCurrency(result.price_range.min)}</span>
                                      <span className="text-xs">to {formatCurrency(result.price_range.max)}</span>
                                    </div>
                                  ) : (
                                    'N/A'
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {result.deal_rating && summaryStats && (
                                    <DealQualityTooltip
                                      result={result}
                                      averagePrice={summaryStats.averagePrice}
                                    >
                                      <span className={`px-2 py-1 rounded text-xs font-semibold cursor-help ${result.deal_rating === 'Good' ? 'bg-green-500/30 text-green-400 shadow-lg shadow-green-500/20' :
                                          result.deal_rating === 'Poor' ? 'bg-red-500/30 text-red-400 shadow-lg shadow-red-500/20' :
                                            'bg-yellow-500/30 text-yellow-400 shadow-lg shadow-yellow-500/20'
                                        }`}>
                                        {result.deal_rating}
                                      </span>
                                    </DealQualityTooltip>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {result.error ? (
                                    <span className="text-red-500 text-xs" title={result.error}>
                                      ⚠️
                                    </span>
                                  ) : (
                                    <span className="text-green-500">✓</span>
                                  )}
                                </TableCell>
                              </motion.tr>
                            )
                          })}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Card View */}
        {mounted && isMobile && sortedResults.length > 0 && (
          <MobileCardView
            results={sortedResults}
            isFavorite={(index) => {
              const result = sortedResults[index]
              const favoriteId = `${result.car.make}-${result.car.model}-${result.car.year}-${index}`
              return favorites.isFavorite(favoriteId)
            }}
            onToggleFavorite={(index) => {
              const result = sortedResults[index]
              const favoriteId = `${result.car.make}-${result.car.model}-${result.car.year}-${index}`
              favorites.toggleFavorite({
                id: favoriteId,
                make: result.car.make,
                model: result.car.model,
                year: result.car.year,
                predictedPrice: result.predicted_price,
                timestamp: Date.now(),
              })
            }}
            onViewDetails={(index) => {
              // Could open a modal or navigate to details
              const result = sortedResults[index]
              console.log('View details for:', result)
            }}
          />
        )}
      </div>
    </div>
  )
}
