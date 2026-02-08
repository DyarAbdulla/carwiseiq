"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthSession } from '@/lib/useAuthSession'
import { useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { sessionLoaded, user } = useAuthSession()
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() || 'en'

  useEffect(() => {
    // Only redirect after session has loaded
    if (!sessionLoaded) return

    // If no user, redirect to login
    if (!user) {
      const returnUrl = pathname || `/${locale}`
      router.push(`/${locale}/login?returnUrl=${encodeURIComponent(returnUrl)}`)
    }
  }, [sessionLoaded, user, pathname, locale, router])

  // Show loading spinner only while session is loading (deterministic - will always resolve)
  if (!sessionLoaded) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#5B7FFF]" />
          <p className="text-[#94a3b8]">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // After session loaded, if no user, show nothing (redirecting)
  if (!user) {
    return null
  }

  return <>{children}</>
}
