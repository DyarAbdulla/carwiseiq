"use client"

import { useState, useEffect } from 'react'
import { AlertCircle, X, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
const normalizeBaseUrl = (url?: string) => {
  if (!url) return url
  return url
    .replace('http://localhost', 'http://127.0.0.1')
    .replace('https://localhost', 'http://127.0.0.1')
}

export function APIStatusBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAPI = async () => {
      try {
        setIsChecking(true)
        // Try simple health check
        const apiUrl =
          normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL) ||
          normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ||
          'http://127.0.0.1:8000'
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const response = await fetch(`${apiUrl}/api/health`, {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (response.ok) {
          setIsOffline(false)
        } else {
          setIsOffline(true)
        }
      } catch (error) {
        setIsOffline(true)
      } finally {
        setIsChecking(false)
      }
    }

    checkAPI()
    // Check every 10 seconds
    const interval = setInterval(checkAPI, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!isOffline || isChecking) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-semibold">API Server Offline</p>
            <p className="text-sm text-red-100">
              Backend server is not running. Start it with: <code className="bg-red-700 px-1 rounded">cd backend && python -m app.main</code>
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOffline(false)}
          className="text-white hover:bg-red-700"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
