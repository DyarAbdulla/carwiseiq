"use client"

import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Home, Search, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function NotFoundPage() {
  const t = useTranslations('common')
  const locale = useLocale() || 'en'
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/${locale}/predict?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-[#0f1117] px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="relative">
            <div className="text-9xl md:text-[12rem] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl">🚗</div>
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {t('pageNotFound') || 'Page Not Found'}
        </h1>
        <p className="text-lg text-[#94a3b8] mb-8">
          {t('pageNotFoundMessage') || "The page you're looking for doesn't exist or has been moved."}
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-8 max-w-md mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#94a3b8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for cars..."
                className="w-full pl-10 pr-4 py-3 bg-[#1a1d29] border border-[#2a2d3a] rounded-lg text-white placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#5B7FFF]"
              />
            </div>
            <Button
              type="submit"
              className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90"
            >
              Search
            </Button>
          </div>
        </form>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${locale}`}>
            <Button
              className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 text-white hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Home className="mr-2 h-4 w-4" />
              {t('goHome') || 'Go Home'}
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="border-[#2a2d3a] hover:bg-[#1a1d29] text-white hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
