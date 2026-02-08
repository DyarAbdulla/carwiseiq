'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

/**
 * InstallPrompt Component
 * Shows an install prompt when the PWA can be installed
 * Handles beforeinstallprompt event and install flow
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Check if app is already installed
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    // Check if running as standalone (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    // Check if user dismissed the prompt (stored in localStorage)
    try {
      const dismissedTimestamp = localStorage.getItem('pwa-install-dismissed')
      if (dismissedTimestamp) {
        const dismissedDate = new Date(parseInt(dismissedTimestamp, 10))
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)

        // Show again after 7 days
        if (daysSinceDismissed < 7) {
          setIsDismissed(true)
          return
        } else {
          // Clear old dismissal
          localStorage.removeItem('pwa-install-dismissed')
        }
      }
    } catch (error) {
      // localStorage access failed, ignore
      console.warn('[PWA Install] Failed to check dismissal status:', error)
    }
  }, [])

  // Listen for beforeinstallprompt event
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt (requires passive: false)
      e.preventDefault()

      // Store the event for later use
      const installEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(installEvent)
      setIsVisible(true)
    }

    // passive: false is required when calling preventDefault() - fixes console warning
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt, { passive: false })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // Handle install button click
  const handleInstall = async () => {
    if (!deferredPrompt) {
      return
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt()

      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('[PWA Install] User accepted the install prompt')
        setIsInstalled(true)
        setIsVisible(false)
      } else {
        console.log('[PWA Install] User dismissed the install prompt')
        handleDismiss()
      }

      // Clear the deferred prompt
      setDeferredPrompt(null)
    } catch (error) {
      console.error('[PWA Install] Error showing install prompt:', error)
    }
  }

  // Handle dismiss button click
  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)

    // Store dismissal timestamp in localStorage
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString())
      }
    } catch (error) {
      console.warn('[PWA Install] Failed to save dismissal:', error)
    }
  }

  // Don't show if already installed, dismissed, or no prompt available
  if (isInstalled || isDismissed || !isVisible || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-md">
      <div className="bg-[#1e293b] border border-[#334155] rounded-lg shadow-lg p-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-white mb-1">
            Install CarWiseIQ
          </p>
          <p className="text-xs text-gray-400">
            Get faster access and work offline
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleInstall}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
          >
            Install
          </Button>
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Type definition for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Extend Window interface for TypeScript
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}
