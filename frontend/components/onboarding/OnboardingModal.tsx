"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import {
  Car,
  Sparkles,
  Wand2,
  Scale,
  ShoppingBag,
  MessageCircle,
  Bot,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const CARWISE_OPEN_ONBOARDING_EVENT = "carwise-open-onboarding"
const STORAGE_ONBOARDED = "carwise-onboarded"

const SLIDE_COUNT = 4

export function OnboardingModal() {
  const t = useTranslations("onboarding")
  const locale = useLocale() || "en"
  const pathname = usePathname() || ""
  const router = useRouter()
  const isRTL = locale === "ar" || locale === "ku"

  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef<number | null>(null)

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_ONBOARDED, "true")
    } catch {
      /* ignore */
    }
    setOpen(false)
  }, [])

  const skip = useCallback(() => {
    finish()
  }, [finish])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return
    if (pathname.includes("/admin1129admin")) return

    const checkOpen = () => {
      try {
        if (localStorage.getItem(STORAGE_ONBOARDED) === "true") return
        setOpen(true)
      } catch {
        setOpen(true)
      }
    }

    checkOpen()

    const onReplay = () => {
      if (pathname.includes("/admin1129admin")) return
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener(CARWISE_OPEN_ONBOARDING_EVENT, onReplay)
    return () => window.removeEventListener(CARWISE_OPEN_ONBOARDING_EVENT, onReplay)
  }, [mounted, pathname])

  useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    if (!node) return

    const focusables = Array.from(
      node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("data-focus-guard"))

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        skip()
        return
      }
      if (e.key !== "Tab" || focusables.length === 0) return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, index, skip])

  const goNext = useCallback(() => {
    if (index >= SLIDE_COUNT - 1) {
      finish()
      router.push(`/${locale}`)
      return
    }
    setIndex((i) => Math.min(SLIDE_COUNT - 1, i + 1))
  }, [finish, index, locale, router])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragStartX.current
    dragStartX.current = null
    if (start == null) return
    const dx = e.clientX - start
    const threshold = 56
    const forward = isRTL ? dx > threshold : dx < -threshold
    const back = isRTL ? dx < -threshold : dx > threshold
    if (forward) goNext()
    else if (back) goPrev()
  }

  if (!mounted || typeof document === "undefined") return null
  if (!open) return null

  const pct = (100 / SLIDE_COUNT) * index

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-0 sm:p-4"
        role="presentation"
      >
        <motion.button
          type="button"
          aria-label={t("closeBackdrop")}
          className="absolute inset-0 bg-black/65 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={skip}
        />
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-desc"
          className={cn(
            "relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-[400px] flex-col overflow-hidden rounded-t-3xl border border-white/12 shadow-2xl sm:rounded-3xl",
            "bg-[rgba(20,20,40,0.96)]"
          )}
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
        >
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-end px-4 pt-3">
              <button
                type="button"
                onClick={skip}
                className="rounded-lg px-2 py-1 text-[14px] font-medium text-white/50 transition-colors hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]/50"
              >
                {t("skip")}
              </button>
            </div>

            <div
              className="relative min-h-[280px] flex-1 touch-pan-y overflow-hidden px-5 pb-2"
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="relative h-full w-full overflow-hidden" dir="ltr">
                <motion.div
                  className="flex h-full"
                  style={{ width: `${SLIDE_COUNT * 100}%` }}
                  animate={{ x: `-${pct}%` }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                >
                  <div className="flex h-full w-1/4 shrink-0 flex-col items-center px-1 text-center">
                    <SlideVisual>
                      <div className="relative">
                        <Car className="h-16 w-16 text-violet-300 sm:h-20 sm:w-20" strokeWidth={1.25} />
                        <Sparkles className="absolute -right-1 -top-1 h-7 w-7 text-amber-300" />
                      </div>
                    </SlideVisual>
                    <h2 id="onboarding-title" className="mt-4 text-2xl font-bold leading-tight text-white">
                      {t("slide1Title")}
                    </h2>
                    <p id="onboarding-desc" className="mt-2 text-base font-normal leading-relaxed text-white/70">
                      {t("slide1Subtitle")}
                    </p>
                  </div>
                  <div className="flex h-full w-1/4 shrink-0 flex-col items-center px-1 text-center">
                    <SlideVisual>
                      <Wand2 className="h-16 w-16 text-violet-300 sm:h-20 sm:w-20" strokeWidth={1.25} />
                    </SlideVisual>
                    <h2 className="mt-4 text-2xl font-bold leading-tight text-white">{t("slide2Title")}</h2>
                    <p className="mt-2 text-base font-normal leading-relaxed text-white/70">{t("slide2Subtitle")}</p>
                    <PredictPriceTicker t={t} />
                  </div>
                  <div className="flex h-full w-1/4 shrink-0 flex-col items-center px-1 text-center">
                    <SlideVisual>
                      <div className="flex items-center gap-2">
                        <Scale className="h-14 w-14 text-indigo-300 sm:h-16 sm:w-16" strokeWidth={1.25} />
                        <ShoppingBag className="h-14 w-14 text-purple-300 sm:h-16 sm:w-16" strokeWidth={1.25} />
                      </div>
                    </SlideVisual>
                    <h2 className="mt-4 text-2xl font-bold leading-tight text-white">{t("slide3Title")}</h2>
                    <p className="mt-2 text-base font-normal leading-relaxed text-white/70">{t("slide3Subtitle")}</p>
                  </div>
                  <div className="flex h-full w-1/4 shrink-0 flex-col items-center px-1 text-center">
                    <SlideVisual>
                      <div className="relative">
                        <MessageCircle className="h-16 w-16 text-violet-300 sm:h-20 sm:w-20" strokeWidth={1.25} />
                        <Bot className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border border-white/20 bg-[#6C5CE7]/90 p-1 text-white" />
                      </div>
                    </SlideVisual>
                    <h2 className="mt-4 text-2xl font-bold leading-tight text-white">{t("slide4Title")}</h2>
                    <p className="mt-2 text-base font-normal leading-relaxed text-white/70">{t("slide4Subtitle")}</p>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="flex shrink-0 justify-center gap-2 pb-3 pt-1" role="tablist" aria-label={t("progressLabel")}>
              {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                <span
                  key={i}
                  role="presentation"
                  className={cn(
                    "h-2 w-2 rounded-full transition-all duration-300",
                    i === index ? "scale-110 bg-[#6C5CE7]" : "bg-white/20"
                  )}
                />
              ))}
            </div>

            <div className="shrink-0 border-t border-white/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={goNext}
                className="w-full rounded-xl bg-[#6C5CE7] py-3 text-center text-base font-semibold text-white shadow-lg shadow-[#6C5CE7]/25 transition-transform hover:bg-[#5b4cdb] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98]"
              >
                {index >= SLIDE_COUNT - 1 ? t("getStarted") : t("next")}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}

function SlideVisual({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-28 w-full items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/15 to-purple-600/10">
      {children}
    </div>
  )
}

function PredictPriceTicker({ t }: { t: (key: string) => string }) {
  const raw = t("tickerPrices")
  const samples = raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
  const safe = samples.length > 0 ? samples : ["$18,200", "$21,500", "$19,800", "$24,300"]
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % safe.length), 1600)
    return () => window.clearInterval(id)
  }, [safe.length])
  return (
    <motion.p
      key={safe[i]}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="mt-4 font-mono text-lg font-semibold tabular-nums text-emerald-400"
    >
      {safe[i]}
    </motion.p>
  )
}
