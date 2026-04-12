"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { incrementVisitCount } from "@/lib/push/engagement"

/** Counts visits (route changes) for the push permission banner eligibility. */
export function PushEngagementTracker() {
  const pathname = usePathname()

  useEffect(() => {
    incrementVisitCount()
  }, [pathname])

  return null
}
