'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuthContext } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Where to send unauthenticated users. Default: 'login' */
  redirectTo?: 'login' | 'register'
}

export function ProtectedRoute({ children, redirectTo = 'login' }: ProtectedRouteProps) {
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() || 'en'

  // Debug: uncomment to see auth state when loading/user changes
  // useEffect(() => { console.log('[ProtectedRoute]', { loading, hasUser: !!user }) }, [loading, user])

  useEffect(() => {
    if (loading) return
    if (user) return

    const returnUrl = pathname || `/${locale}`
    const base = redirectTo === 'register' ? `/${locale}/register` : `/${locale}/login`
    const url = `${base}?returnUrl=${encodeURIComponent(returnUrl)}`
    router.push(url)
  }, [user, loading, pathname, locale, router, redirectTo])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" className="text-[#5B7FFF]" />
          <p className="text-[#94a3b8]">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
