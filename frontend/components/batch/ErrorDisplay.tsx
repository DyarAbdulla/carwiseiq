'use client'

import { AlertCircle, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

interface ErrorDisplayProps {
  error: {
    type: 'invalid_url' | 'scraping_failed' | 'api_timeout' | 'unknown'
    title: string
    message: string
    suggestion: string
    code?: string
  }
  onRetry?: () => void
  onDismiss?: () => void
}

const errorConfig = {
  invalid_url: {
    icon: AlertCircle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  scraping_failed: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  api_timeout: {
    icon: AlertCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  unknown: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  const config = errorConfig[error.type] || errorConfig.unknown
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className={`${config.bgColor} ${config.borderColor} border`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Icon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
              <div>
                <CardTitle className="text-white">{error.title}</CardTitle>
                <CardDescription className="text-[#94a3b8] mt-1">
                  {error.message}
                </CardDescription>
              </div>
            </div>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8 w-8 p-0 text-[#94a3b8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-[#0f1117] border border-[#2a2d3a]">
            <p className="text-sm font-medium text-white mb-1">💡 Suggestion:</p>
            <p className="text-sm text-[#94a3b8]">{error.suggestion}</p>
          </div>

          {error.code && (
            <div className="p-3 rounded-lg bg-[#0f1117] border border-[#2a2d3a]">
              <p className="text-xs text-[#94a3b8] font-mono">{error.code}</p>
            </div>
          )}

          <div className="flex gap-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                // Contact support - could open email or modal
                window.location.href = `mailto:support@example.com?subject=Error Report&body=Error Type: ${error.type}%0A%0A${error.message}`
              }}
              className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
            >
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function createError(error: unknown, context?: string): ErrorDisplayProps['error'] {
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMessage = String(error.message).toLowerCase()

    if (errorMessage.includes('url') || errorMessage.includes('invalid')) {
      return {
        type: 'invalid_url',
        title: 'Unable to Access Listing',
        message: 'The URL format is incorrect or the page could not be found.',
        suggestion: 'Check the URL and try again. Make sure it starts with http:// or https://',
        code: context,
      }
    }

    if (errorMessage.includes('scraping') || errorMessage.includes('extract')) {
      return {
        type: 'scraping_failed',
        title: 'Data Extraction Failed',
        message: "We couldn't extract car details from this listing.",
        suggestion:
          'Try a different platform or enter the car details manually using the form above.',
        code: context,
      }
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        type: 'api_timeout',
        title: 'Request Timed Out',
        message: 'The server took too long to respond.',
        suggestion: 'Check your internet connection and try again. The server may be busy.',
        code: context,
      }
    }
  }

  return {
    type: 'unknown',
    title: 'An Error Occurred',
    message: error instanceof Error ? error.message : 'Something went wrong',
    suggestion: 'Please try again. If the problem persists, contact support.',
    code: context,
  }
}
