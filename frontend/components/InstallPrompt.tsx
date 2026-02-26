"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

const STORAGE_KEY = "carwiseiq-pwa-prompt"
const VISIT_COUNT_KEY = "carwiseiq-visit-count"

// Hardcoded English - component is rendered outside NextIntlClientProvider (root layout)
const PWA_TEXT = {
  title: "Add to Home Screen",
  description: "Install CarWiseIQ for quick access and a better experience.",
  install: "Install",
  notNow: "Not now",
  dismiss: "Dismiss",
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed === "true") return

    let count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10)
    count += 1
    localStorage.setItem(VISIT_COUNT_KEY, String(count))
    if (count < 2) return // Show after 2nd visit

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShow(false)
      localStorage.setItem(STORAGE_KEY, "true")
    }
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-24 sm:bottom-28 left-4 right-4 sm:left-6 sm:right-6 max-w-md mx-auto z-[998] p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-xl"
      role="dialog"
      aria-labelledby="pwa-prompt-title"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 id="pwa-prompt-title" className="font-semibold text-slate-900 dark:text-white mb-1">
            {PWA_TEXT.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">{PWA_TEXT.description}</p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleInstall}
              className="min-h-[44px] bg-indigo-600 hover:bg-indigo-500 touch-manipulation"
            >
              {PWA_TEXT.install}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="min-h-[44px] touch-manipulation"
            >
              {PWA_TEXT.notNow}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center touch-manipulation"
          aria-label={PWA_TEXT.dismiss}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
