"use client"
export const runtime = 'edge';

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"

export default function SellPage() {
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    router.replace(`/${locale}/sell/step1`)
  }, [router, locale])

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <p className="text-gray-400">Redirecting…</p>
    </div>
  )
}
