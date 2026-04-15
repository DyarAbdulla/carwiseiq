"use client"

import { useEffect, useState, useCallback } from "react"
import { subscribeBackendBanner, setBackendHealthDown, recordApiFailureBurst, clearApiFailureBurst } from "@/lib/api-connection-state"

const HEALTH_PATH = "/api/health"
const HEALTH_TIMEOUT_MS = 5000
const HEALTH_POLL_MS = 15000

function publicApiOrigin(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .replace(/\/$/, "")
    .replace("http://localhost", "http://127.0.0.1")
    .replace("https://localhost", "http://127.0.0.1")
  return raw || "http://127.0.0.1:8000"
}

export function BackendStatusBanner() {
  const [visible, setVisible] = useState(false)

  const sync = useCallback((show: boolean) => {
    setVisible(show)
  }, [])

  useEffect(() => {
    return subscribeBackendBanner(sync)
  }, [sync])

  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      const base = publicApiOrigin()
      const controller = new AbortController()
      const t = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
      try {
        const r = await fetch(`${base}${HEALTH_PATH}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        })
        window.clearTimeout(t)
        if (cancelled) return
        if (r.ok) {
          setBackendHealthDown(false)
        } else {
          setBackendHealthDown(true)
        }
      } catch {
        window.clearTimeout(t)
        if (!cancelled) setBackendHealthDown(true)
      }
    }
    void probe()
    const interval = window.setInterval(probe, HEALTH_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const onFail = () => recordApiFailureBurst()
    const onOnline = () => clearApiFailureBurst()
    window.addEventListener("carwise-api-fail", onFail)
    window.addEventListener("carwise-api-success", onOnline)
    return () => {
      window.removeEventListener("carwise-api-fail", onFail)
      window.removeEventListener("carwise-api-success", onOnline)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] w-full border-b border-red-800/40 bg-red-600 px-3 py-2.5 text-center text-sm font-medium text-white shadow-md"
    >
      <span aria-hidden>⚠️ </span>
      We&apos;re experiencing connection issues. Some features may be unavailable.
    </div>
  )
}
