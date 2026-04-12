"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import {
  Home,
  Sparkles,
  ArrowLeftRight,
  ShoppingBag,
  MessageCircle,
} from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const STORAGE_ONBOARDED = "carwise-onboarded"
const STORAGE_TOOLTIP = "carwise-tooltip-shown"

type NavKey = "home" | "predict" | "compare" | "market" | "ai"

const items: { key: NavKey; href: string; Icon: typeof Home; labelKey: string }[] = [
  { key: "home", href: "/", Icon: Home, labelKey: "home" },
  { key: "predict", href: "/predict", Icon: Sparkles, labelKey: "predict" },
  { key: "compare", href: "/compare", Icon: ArrowLeftRight, labelKey: "compare" },
  { key: "market", href: "/buy-sell", Icon: ShoppingBag, labelKey: "market" },
  { key: "ai", href: "/ai-assistant", Icon: MessageCircle, labelKey: "aiChat" },
]

export function BottomNav() {
  const pathname = usePathname() || ""
  const locale = useLocale() || "en"
  const isRTL = locale === "ar" || locale === "ku"
  const t = useTranslations("nav")
  const tOnboarding = useTranslations("onboarding")

  const basePathname = pathname.replace(new RegExp(`^/${locale}`), "") || "/"

  const [sparkleOnce, setSparkleOnce] = useState(false)
  const [showPredictHint, setShowPredictHint] = useState(false)
  const predictRef = useRef<HTMLAnchorElement | null>(null)
  const [hintPos, setHintPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      if (sessionStorage.getItem("cwiq-bottom-nav-sparkle")) return
      sessionStorage.setItem("cwiq-bottom-nav-sparkle", "1")
      setSparkleOnce(true)
      const id = window.setTimeout(() => setSparkleOnce(false), 2200)
      return () => window.clearTimeout(id)
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (pathname.includes("/admin1129admin")) return
    const isHome = basePathname === "/" || basePathname === ""
    if (!isHome) {
      setShowPredictHint(false)
      return
    }
    try {
      if (localStorage.getItem(STORAGE_ONBOARDED) !== "true") return
      if (localStorage.getItem(STORAGE_TOOLTIP) === "true") return
    } catch {
      return
    }
    setShowPredictHint(true)
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_TOOLTIP, "true")
      } catch {
        /* ignore */
      }
      setShowPredictHint(false)
      setHintPos(null)
    }, 5000)
    return () => window.clearTimeout(id)
  }, [basePathname, pathname])

  const dismissPredictHint = () => {
    try {
      localStorage.setItem(STORAGE_TOOLTIP, "true")
    } catch {
      /* ignore */
    }
    setShowPredictHint(false)
    setHintPos(null)
  }

  useLayoutEffect(() => {
    if (!showPredictHint || !predictRef.current) {
      setHintPos(null)
      return
    }
    const el = predictRef.current
    const update = () => {
      const r = el.getBoundingClientRect()
      setHintPos({ left: r.left + r.width / 2, top: r.top })
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [showPredictHint])

  if (pathname.includes("/admin1129admin")) {
    return null
  }

  const isActive = (key: NavKey, href: string) => {
    if (key === "home") return basePathname === "/" || basePathname === ""
    if (key === "market") return basePathname === "/buy-sell"
    if (key === "ai") return basePathname === "/ai-assistant"
    if (href === "/") return false
    return basePathname === href || basePathname.startsWith(`${href}/`)
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[90] md:hidden pointer-events-none"
      aria-label={t("bottomNavAria")}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className={cn(
          "pointer-events-auto flex h-[60px] min-h-[60px] w-full items-stretch justify-between border-t border-white/10 px-1 pt-0.5",
          isRTL && "flex-row-reverse"
        )}
        style={{
          background: "rgba(15, 15, 30, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {items.map(({ key, href, Icon, labelKey }) => {
          const active = isActive(key, href)
          const fullHref = `/${locale}${href === "/" ? "" : href}`
          return (
            <Link
              key={key}
              ref={key === "predict" ? predictRef : undefined}
              href={fullHref}
              data-onboarding-predict-tab={key === "predict" ? "" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-all duration-200 ease-out active:scale-[0.96]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f1e]"
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                {key === "market" && (
                  <span
                    className="bottom-nav-dot-pulse absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-rose-500 will-change-transform"
                    aria-hidden
                  />
                )}
                {key === "predict" && sparkleOnce && (
                  <Sparkles
                    className="bottom-nav-sparkle pointer-events-none absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-300/90 will-change-transform"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "flex items-center justify-center transition-transform duration-200 ease-out",
                    key === "ai" && "rounded-full",
                    key === "ai" &&
                      !active &&
                      "bottom-nav-ai-wrap shadow-[0_0_14px_rgba(108,92,231,0.45)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "shrink-0 transition-[transform,color] duration-200 ease-out",
                      active ? "text-[#6C5CE7]" : "text-white/50"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                    size={active ? 26 : 24}
                  />
                </span>
              </span>
              <span
                className={cn(
                  "max-w-full truncate px-0.5 text-[10px] leading-tight transition-colors duration-200 ease-out",
                  active ? "font-semibold text-white" : "font-normal text-white/50"
                )}
              >
                {labelKey === "market"
                  ? t("market")
                  : labelKey === "aiChat"
                    ? t("aiChat")
                    : t(labelKey as "home" | "predict" | "compare")}
              </span>
            </Link>
          )
        })}
      </div>
      {typeof document !== "undefined" &&
        showPredictHint &&
        hintPos &&
        createPortal(
          <AnimatePresence>
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="fixed z-[95] max-w-[min(260px,calc(100vw-2rem))] -translate-x-1/2 cursor-pointer rounded-xl border border-white/15 bg-[rgba(20,20,40,0.96)] px-3 py-2.5 text-center text-sm font-medium text-white shadow-xl backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]/60"
              style={{
                left: hintPos.left,
                top: Math.max(8, hintPos.top - 52),
              }}
              onClick={dismissPredictHint}
            >
              <span className="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 border-b border-r border-white/15 bg-[rgba(20,20,40,0.96)]" aria-hidden />
              {tOnboarding("predictTooltip")}
            </motion.button>
          </AnimatePresence>,
          document.body
        )}
    </nav>
  )
}
