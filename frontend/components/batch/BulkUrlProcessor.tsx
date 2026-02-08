'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, Clock, Link as LinkIcon, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { detectPlatform, isValidUrl } from '@/utils/platformDetection'
import type { CarFeatures } from '@/lib/types'
import { UrlProgressBar } from './UrlProgressBar'
import { UrlListSkeleton } from './UrlListSkeleton'
import { motion, AnimatePresence } from 'framer-motion'

interface UrlStatus {
  url: string
  status: 'pending' | 'processing' | 'success' | 'error'
  result?: {
    extracted_data: CarFeatures
    predicted_price: number
  }
  error?: string
}

interface BulkUrlProcessorProps {
  onResults: (results: Array<{ url: string; result: any }>) => void
}

export function BulkUrlProcessor({ onResults }: BulkUrlProcessorProps) {
  const [urls, setUrls] = useState<string>('')
  const [urlStatuses, setUrlStatuses] = useState<UrlStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const toastHook = useToast()
  const toast = toastHook || { toast: () => {} }

  const MAX_URLS = 10
  const CONCURRENT_LIMIT = 3

  const parseUrls = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && isValidUrl(line))
      .slice(0, MAX_URLS)
  }

  const processUrls = async () => {
    const urlList = parseUrls(urls)

    if (urlList.length === 0) {
      if (toast?.toast) {
        toast.toast({
          title: 'Invalid URLs',
          description: 'Please enter at least one valid URL',
          variant: 'destructive',
        })
      }
      return
    }

    if (urlList.length > MAX_URLS) {
      if (toast?.toast) {
        toast.toast({
          title: 'Too Many URLs',
          description: `Maximum ${MAX_URLS} URLs allowed`,
          variant: 'destructive',
        })
      }
      return
    }

    setIsProcessing(true)
    const initialStatuses: UrlStatus[] = urlList.map((url) => ({
      url,
      status: 'pending',
    }))
    setUrlStatuses(initialStatuses)

    const results: Array<{ url: string; result: any }> = []
    const queue = [...urlList]
    let activePromises = 0

    const processQueue = async () => {
      while (queue.length > 0 || activePromises > 0) {
        while (activePromises < CONCURRENT_LIMIT && queue.length > 0) {
          const url = queue.shift()!
          activePromises++

          // Find index in statuses
          const statusIndex = initialStatuses.findIndex((s) => s.url === url)

          // Update to processing
          setUrlStatuses((prev) => {
            const newStatuses = [...prev]
            if (newStatuses[statusIndex]) {
              newStatuses[statusIndex] = { ...newStatuses[statusIndex], status: 'processing' }
            }
            return newStatuses
          })

          // Process URL
          apiClient
            .predictFromUrl(url)
            .then((result) => {
              results.push({ url, result })

              setUrlStatuses((prev) => {
                const newStatuses = [...prev]
                if (newStatuses[statusIndex]) {
                  newStatuses[statusIndex] = {
                    ...newStatuses[statusIndex],
                    status: 'success',
                    result,
                  }
                }
                return newStatuses
              })
            })
            .catch((error) => {
              setUrlStatuses((prev) => {
                const newStatuses = [...prev]
                if (newStatuses[statusIndex]) {
                  newStatuses[statusIndex] = {
                    ...newStatuses[statusIndex],
                    status: 'error',
                    error: error.message || 'Failed to process',
                  }
                }
                return newStatuses
              })
            })
            .finally(() => {
              activePromises--
            })
        }

        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      setIsProcessing(false)
      onResults(results)

      if (toast?.toast) {
        toast.toast({
          title: 'Processing Complete',
          description: `Processed ${results.length} URLs successfully`,
        })
      }
    }

    processQueue()
  }

  const getStatusIcon = (status: UrlStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-[#5B7FFF] animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-[#94a3b8]" />
    }
  }

  const getStatusBadge = (status: UrlStatus['status']) => {
    const variants = {
      pending: 'bg-[#2a2d3a] text-[#94a3b8]',
      processing: 'bg-[#5B7FFF]/20 text-[#5B7FFF]',
      success: 'bg-green-500/20 text-green-500',
      error: 'bg-red-500/20 text-red-500',
    }
    return (
      <Badge className={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <LinkIcon className="h-5 w-5 text-[#5B7FFF]" />
          <h3 className="text-lg font-semibold text-white">Bulk URL Processing</h3>
        </div>
        <p className="text-sm text-[#94a3b8]">
          Process up to {MAX_URLS} car listing URLs at once (paste one URL per line)
        </p>
      </div>
      <Textarea
        placeholder={`https://www.iqcars.net/en/car/...
https://www.dubizzle.com/cars/...
https://www.syarah.com/car/...`}
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        className="min-h-[200px] bg-white/5 backdrop-blur-sm border-white/10 rounded-2xl font-mono text-sm text-white placeholder:text-[#94a3b8]"
        disabled={isProcessing}
      />

        <div className="flex items-center justify-between">
          <div className="text-sm text-[#94a3b8]">
            {parseUrls(urls).length} valid URL{parseUrls(urls).length !== 1 ? 's' : ''} detected
            {parseUrls(urls).length > MAX_URLS && (
              <span className="text-red-500 ml-2">
                (Max {MAX_URLS} URLs)
              </span>
            )}
          </div>
          <Button
            onClick={processUrls}
            disabled={isProcessing || parseUrls(urls).length === 0}
            className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Process URLs'
            )}
          </Button>
        </div>

      {/* Progress Bar */}
      {isProcessing && urlStatuses.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <UrlProgressBar
            total={urlStatuses.length}
            completed={urlStatuses.filter((s) => s.status === 'success').length}
            processing={urlStatuses.filter((s) => s.status === 'processing').length}
            failed={urlStatuses.filter((s) => s.status === 'error').length}
          />
        </div>
      )}

      {/* Status List */}
      <AnimatePresence mode="wait">
        {urlStatuses.length > 0 ? (
          <motion.div
            key="status-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2 max-h-[300px] overflow-y-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4"
          >
            {urlStatuses.map((urlStatus, index) => {
              const platform = detectPlatform(urlStatus.url)
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-[#5B7FFF]/30 transition-colors"
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(urlStatus.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{urlStatus.url}</p>
                        {platform && (
                          <p className="text-xs text-[#94a3b8] mt-1">{platform.name}</p>
                        )}
                        {urlStatus.error && (
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-red-500">{urlStatus.error}</p>
                            <button
                              onClick={() => {
                                const urlList = parseUrls(urls)
                                const urlIndex = urlList.indexOf(urlStatus.url)
                                if (urlIndex >= 0) {
                                  // Retry logic can be added here
                                  toast?.toast({
                                    title: 'Retry',
                                    description: 'Retry functionality coming soon',
                                  })
                                }
                              }}
                              className="text-xs text-[#5B7FFF] hover:underline flex items-center gap-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                          </div>
                        )}
                        {urlStatus.result && (
                          <p className="text-xs text-green-500 mt-1">
                            ${urlStatus.result.predicted_price.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(urlStatus.status)}
                  </motion.div>
                )
              })}
            </motion.div>
          ) : isProcessing ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4"
            >
              <UrlListSkeleton count={parseUrls(urls).length} />
            </motion.div>
          ) : null}
        </AnimatePresence>
    </div>
  )
}
