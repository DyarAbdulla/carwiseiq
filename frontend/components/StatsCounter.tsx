"use client"

import { useState, useEffect, useRef } from "react"
import { useLocale, useTranslations } from "next-intl"
import { defaultLocale } from "@/i18n"
import { Database, Factory, Award } from "lucide-react"
import {
  MODEL_FIT_R2_PERCENT,
  TRAINING_LISTING_COUNT_DISPLAY,
  UNIQUE_MAKE_COUNT_DISPLAY,
} from "@/lib/platformPublicStats"

function useCountUp(end: number, duration = 2000, startOnMount = true) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    if (!startOnMount) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          const start = 0
          const startTime = performance.now()
          const step = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            const easeOut = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(easeOut * end))
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration, startOnMount, hasAnimated])

  return { count, ref }
}

export function StatsCounter() {
  const t = useTranslations("home.stats")
  const locale = useLocale() || defaultLocale
  const { count: listingsCount, ref: carsRef } = useCountUp(TRAINING_LISTING_COUNT_DISPLAY, 2000)
  const { count: makesCount, ref: makesRef } = useCountUp(UNIQUE_MAKE_COUNT_DISPLAY, 2000)

  return (
    <section className="relative z-10 w-full py-8 sm:py-10" aria-label={t("listingsAnalyzed")}>
      <div className="container mx-auto px-3 sm:px-6 max-w-[1200px]">
        <div className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-3 sm:p-6">
          <ul className="grid grid-cols-3 gap-2 sm:gap-6 md:gap-10 items-stretch text-center sm:text-start list-none m-0 p-0">
            <li className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rtl:sm:flex-row-reverse min-w-0">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Database className="h-4 w-4 sm:h-6 sm:w-6 text-indigo-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <span ref={carsRef} className="block text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">
                  {listingsCount.toLocaleString(locale)}+
                </span>
                <div className="text-[10px] sm:text-sm text-slate-600 dark:text-slate-300 leading-snug">{t("listingsAnalyzed")}</div>
              </div>
            </li>
            <li className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rtl:sm:flex-row-reverse min-w-0 border-x border-white/10 px-1 sm:px-0">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Factory className="h-4 w-4 sm:h-6 sm:w-6 text-purple-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <span ref={makesRef} className="block text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">
                  {makesCount.toLocaleString(locale)}+
                </span>
                <div className="text-[10px] sm:text-sm text-slate-600 dark:text-slate-300 leading-snug">{t("makesCovered")}</div>
              </div>
            </li>
            <li className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rtl:sm:flex-row-reverse min-w-0">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Award className="h-4 w-4 sm:h-6 sm:w-6 text-blue-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                  {MODEL_FIT_R2_PERCENT}%
                </div>
                <div className="text-[10px] sm:text-sm text-slate-600 dark:text-slate-300 leading-snug">{t("modelFitR2")}</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
