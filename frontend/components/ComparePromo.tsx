"use client"

import { useTranslations, useLocale } from "next-intl"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3 } from "lucide-react"
import { motion } from "framer-motion"

export function ComparePromo() {
  const t = useTranslations("home.comparePromo")
  const locale = useLocale() || "en"

  return (
    <section className="w-full py-8 sm:py-12" aria-labelledby="compare-promo-title">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/20 md:border-white/10 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 backdrop-blur-xl p-6 sm:p-8 md:p-10"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-bold text-indigo-400">1</span>
              </div>
              <div className="text-center md:text-start">
                <span className="text-3xl sm:text-4xl font-bold text-slate-400/80">VS</span>
              </div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-bold text-purple-400">2</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-start">
              <h2 id="compare-promo-title" className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {t("headline")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">{t("subtext")}</p>
              <Link href={`/${locale}/compare`}>
                <Button
                  size="lg"
                  className="min-h-[48px] px-6 sm:px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold touch-manipulation"
                >
                  <BarChart3 className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" aria-hidden />
                  {t("cta")}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
