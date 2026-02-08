"use client"

import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Home, RefreshCw, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ServerErrorPage() {
  const t = useTranslations('common')
  const locale = useLocale() || 'en'
  const router = useRouter()

  const handleRefresh = () => {
    router.refresh()
    window.location.reload()
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-[#0f1117] px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 500 Illustration */}
        <div className="mb-8">
          <div className="relative">
            <div className="text-9xl md:text-[12rem] font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 opacity-20">
              500
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <AlertCircle className="h-20 w-20 text-red-500" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {t('errorTitle') || 'Something went wrong!'}
        </h1>
        <p className="text-lg text-[#94a3b8] mb-2">
          We encountered an unexpected error while processing your request.
        </p>
        <p className="text-sm text-[#94a3b8] mb-8">
          Our team has been notified and is working on a fix. Please try again later.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleRefresh}
            className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 text-white hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('tryAgain') || 'Try Again'}
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
