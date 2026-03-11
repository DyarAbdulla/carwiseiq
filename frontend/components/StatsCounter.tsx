"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { Database, Users, Award } from "lucide-react"

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
  const { count: carsValued, ref: carsRef } = useCountUp(55000, 2000)
  const { count: happyUsers, ref: usersRef } = useCountUp(12000, 2000)

  return (
    <section className="relative z-10 w-full py-8 sm:py-10" aria-labelledby="stats-title">
      <div className="container mx-auto px-3 sm:px-6 max-w-[1200px]">
        <div className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-8 md:gap-12">
            <div className="flex items-center gap-3 rtl:flex-row-reverse rtl:gap-3" role="listitem">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Database className="h-6 w-6 text-indigo-400" aria-hidden />
              </div>
              <div>
                <span ref={carsRef} className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {carsValued.toLocaleString()}+
                </span>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t("carsValued")}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rtl:flex-row-reverse rtl:gap-3" role="listitem">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-purple-400" aria-hidden />
              </div>
              <div>
                <span ref={usersRef} className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {happyUsers.toLocaleString()}+
                </span>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t("happyUsers")}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rtl:flex-row-reverse rtl:gap-3" role="listitem">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <Award className="h-6 w-6 text-blue-400" aria-hidden />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">99%</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t("accuracyRate")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
