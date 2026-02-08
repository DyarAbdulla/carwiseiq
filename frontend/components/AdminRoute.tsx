'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuthContext } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading, isAdmin } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() || 'en'
  const { toast } = useToast()

  useEffect(() => {
    if (loading) return

    if (!user) {
      const returnUrl = pathname || `/${locale}/admin`
      router.push(`/${locale}/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      return
    }

    if (!isAdmin) {
      toast({
        title: 'Access denied',
        description: 'You do not have permission to view this page. Admin access required.',
        variant: 'destructive',
      })
      router.push(`/${locale}?error=admin_required`)
    }
  }, [user, loading, isAdmin, pathname, locale, router, toast])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" className="text-[#5B7FFF]" />
          <p className="text-[#94a3b8]">Checking access...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return <>{children}</>
}
