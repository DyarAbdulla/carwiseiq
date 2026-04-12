"use client"

import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Car } from "lucide-react"
import { motion } from "framer-motion"
import { POPULAR_MARKET_MODELS } from "@/lib/platformPublicStats"

export function PopularCars() {
  const locale = useLocale() || "en"
  const t = useTranslations("home.popularCars")

  return (
    <section className="w-full py-8 sm:py-12" aria-labelledby="popular-cars-title">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl">
        <h2 id="popular-cars-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">
          {t("title")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">
          {t("subtitle")}
        </p>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
          {POPULAR_MARKET_MODELS.map((car, i) => (
            <motion.div
              key={`${car.make}-${car.model}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 w-[260px] sm:w-[280px]"
            >
              <Link
                href={`/${locale}/predict?make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}`}
                className="block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5 hover:bg-white/10 hover:border-white/20 transition-all h-full"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-3">
                  <Car className="h-6 w-6 text-indigo-400" aria-hidden />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg mb-1">
                  {car.make} {car.model}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{car.priceRangeUsd}</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">{t("usdNote")}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] w-full border-white/20 text-slate-900 dark:text-white hover:bg-white/10 touch-manipulation"
                  asChild
                >
                  <span>{t("cta")}</span>
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
