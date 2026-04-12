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
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

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

  const basePathname = pathname.replace(new RegExp(`^/${locale}`), "") || "/"

  const [sparkleOnce, setSparkleOnce] = useState(false)

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
              href={fullHref}
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
    </nav>
  )
}
