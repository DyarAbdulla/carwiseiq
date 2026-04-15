"use client"

import { useTranslations, useLocale } from "next-intl"
import { defaultLocale } from "@/i18n"
import Link from "next/link"
import { BookOpen, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export function BlogSection() {
  const t = useTranslations("blog")
  const locale = useLocale() || defaultLocale

  return (
    <section className="w-full py-8 sm:py-12" aria-labelledby="blog-section-title">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-indigo-400" aria-hidden />
            </div>
            <h2 id="blog-section-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {t("title")}
            </h2>
          </div>
          <p className="text-slate-600 dark:text-slate-300 mb-6">{t("subtitle")}</p>
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold touch-manipulation"
          >
            {t("readMore")}
            <ArrowRight className="h-5 w-5 rtl:rotate-180" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
