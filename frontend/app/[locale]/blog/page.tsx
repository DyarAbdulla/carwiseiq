"use client"

import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { defaultLocale } from "@/i18n"

const BLOG_POSTS = [
  { slug: "how-to-know-used-car-value", titleKey: "post1" },
  { slug: "10-things-before-buying", titleKey: "post2" },
  { slug: "best-family-cars-kurdistan", titleKey: "post3" },
]

export default function BlogPage() {
  const t = useTranslations("blog")
  const locale = useLocale() || defaultLocale

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t("title")}</h1>
      <p className="text-slate-600 dark:text-slate-300 mb-8">{t("subtitle")}</p>
      <div className="space-y-6">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/${locale}/blog/${post.slug}`}
            className="block p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
          >
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t(post.titleKey)}</h2>
          </Link>
        ))}
      </div>
    </div>
  )
}
