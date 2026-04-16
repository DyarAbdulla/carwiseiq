"use client"

import { useLocale, useTranslations } from "next-intl"
import { defaultLocale } from "@/i18n"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { POPULAR_MARKET_MODELS, popularMarketModelImagePath } from "@/lib/platformPublicStats"

export function PopularCars() {
  const locale = useLocale() || defaultLocale
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
                className="block rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden hover:bg-white/10 hover:border-white/20 transition-all h-full"
              >
                <div className="relative aspect-[16/10] w-full bg-slate-900/40 overflow-hidden">
                  <img
                    src={popularMarketModelImagePath(car.make, car.model)}
                    alt={`${car.make} ${car.model}`}
                    className="h-full w-full object-cover object-center"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement
                      el.src = "/images/cars/default-car.svg"
                      el.onerror = null
                    }}
                  />
                </div>
                <div className="p-4 sm:p-5 pt-3 sm:pt-4">
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
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
