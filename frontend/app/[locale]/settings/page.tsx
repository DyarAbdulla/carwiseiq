'use client'
export const runtime = 'edge';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export default function SettingsIndexPage() {
  const router = useRouter()
  const locale = useLocale() || 'en'

  useEffect(() => {
    router.replace(`/${locale}/settings/notifications`)
  }, [router, locale])

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
      <div className="text-[#94a3b8]">Redirecting to settings...</div>
    </div>
  )
}
