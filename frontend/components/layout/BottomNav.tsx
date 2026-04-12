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
import { readMarketUnseenCount } from "@/lib/push/market-badge"

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
  /** Tooltip only when bottom nav is visible (md:hidden breakpoint) */
  const [isMobileNavViewport, setIsMobileNavViewport] = useState(false)
  /** Horizontal center of Predict tab in viewport px — avoids % guesswork and motion/transform conflicts */
  const predictTabRef = useRef<HTMLAnchorElement | null>(null)
  const [predictTabCenterX, setPredictTabCenterX] = useState<number | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  /** Keeps portal mounted until exit animation finishes */
  const [hintPortalOpen, setHintPortalOpen] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [marketUnseenCount, setMarketUnseenCount] = useState(0)

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
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () => setIsMobileNavViewport(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    readMarketUnseenCount().then(setMarketUnseenCount).catch(() => {})
    const onUnseen = (e: Event) => {
      const d = (e as CustomEvent<{ count?: number }>).detail
      if (typeof d?.count === "number") setMarketUnseenCount(d.count)
    }
    window.addEventListener("carwise-market-unseen", onUnseen)
    const onSwMessage = (event: MessageEvent) => {
      const d = event.data
      if (d?.type === "CARWISE_MARKET_UNSEEN" && typeof d.count === "number") {
        setMarketUnseenCount(d.count)
      }
    }
    navigator.serviceWorker?.addEventListener("message", onSwMessage)
    return () => {
      window.removeEventListener("carwise-market-unseen", onUnseen)
      navigator.serviceWorker?.removeEventListener("message", onSwMessage)
    }
  }, [])

  useLayoutEffect(() => {
    if (!isMobileNavViewport) {
      setPredictTabCenterX(null)
      return
    }
    if (!showPredictHint) {
      /* Keep last centerX while hint fades out (avoid unmounting portal before exit). */
      return
    }
    const el = predictTabRef.current
    if (!el) {
      setPredictTabCenterX(null)
      return
    }
    const update = () => {
      const r = el.getBoundingClientRect()
      setPredictTabCenterX(r.left + r.width / 2)
    }
    update()
    const vv = window.visualViewport
    vv?.addEventListener("resize", update)
    vv?.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      vv?.removeEventListener("resize", update)
      vv?.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      ro.disconnect()
    }
  }, [showPredictHint, isMobileNavViewport, pathname, isRTL])

  useEffect(() => {
    const shouldShow =
      showPredictHint && isMobileNavViewport && predictTabCenterX != null
    if (shouldShow) {
      setHintPortalOpen(true)
      setHintVisible(true)
    } else {
      setHintVisible(false)
    }
  }, [showPredictHint, isMobileNavViewport, predictTabCenterX])

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
  }

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

  const tooltipPortal =
    portalReady &&
    typeof document !== "undefined" &&
    hintPortalOpen &&
    predictTabCenterX != null &&
    createPortal(
      <AnimatePresence
        onExitComplete={() => {
          setHintPortalOpen(false)
          setPredictTabCenterX(null)
        }}
      >
        {hintVisible && (
          <motion.div
            key="predict-nav-hint-anchor"
            className="pointer-events-none fixed z-[95] -translate-x-1/2"
            style={{
              left: predictTabCenterX,
              bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="pointer-events-auto relative max-w-[min(280px,calc(100vw-2rem))] cursor-pointer rounded-lg border border-white/12 bg-[rgba(20,20,40,0.95)] px-4 py-2 text-center text-[14px] font-medium leading-snug text-white shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]/60"
              onClick={dismissPredictHint}
            >
              <span
                className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 h-0 w-0 border-x-[8px] border-x-transparent border-t-[8px] border-t-[rgba(20,20,40,0.95)]"
                aria-hidden
              />
              {tOnboarding("predictTooltip")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )

  return (
    <>
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
              ref={key === "predict" ? predictTabRef : undefined}
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
                {key === "market" &&
                  (marketUnseenCount > 0 ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white/25 bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm"
                      aria-label={String(marketUnseenCount)}
                    >
                      {marketUnseenCount > 9 ? "9+" : marketUnseenCount}
                    </span>
                  ) : (
                    <span
                      className="bottom-nav-dot-pulse absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-rose-500 will-change-transform"
                      aria-hidden
                    />
                  ))}
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
    </nav>
    {tooltipPortal}
    </>
  )
}
