"use client"

import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Home, RefreshCw, WifiOff, Wifi } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function NetworkErrorPage() {
  const t = useTranslations('common')
  const locale = useLocale() || 'en'
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const handleRetry = () => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }
    router.refresh()
    window.location.reload()
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-[#0f1117] px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Network Error Illustration */}
        <div className="mb-8">
          <div className="relative">
            <div className="text-9xl md:text-[12rem] font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 opacity-20">
              ⚠️
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              {isOnline ? (
                <Wifi className="h-20 w-20 text-yellow-500" />
              ) : (
                <WifiOff className="h-20 w-20 text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Network Connection Error
        </h1>
        <p className="text-lg text-[#94a3b8] mb-2">
          {isOnline
            ? 'Unable to connect to our servers. Please check your connection and try again.'
            : 'You appear to be offline. Please check your internet connection.'}
        </p>
        <p className="text-sm text-[#94a3b8] mb-8">
          If the problem persists, our servers might be temporarily unavailable.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleRetry}
            className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 text-white hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
          <Link href={`/${locale}`}>
            <Button
              variant="outline"
              className="border-[#2a2d3a] hover:bg-[#1a1d29] text-white hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <Home className="mr-2 h-4 w-4" />
              {t('goHome') || 'Go Home'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
