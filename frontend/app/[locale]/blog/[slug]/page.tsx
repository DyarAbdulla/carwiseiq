"use client"

import { notFound, useParams } from "next/navigation"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { ChevronLeft } from "lucide-react"

const POSTS: Record<string, { titleKey: string; contentKey: string }> = {
  "how-to-know-used-car-value": { titleKey: "post1", contentKey: "content1" },
  "10-things-before-buying": { titleKey: "post2", contentKey: "content2" },
  "best-family-cars-kurdistan": { titleKey: "post3", contentKey: "content3" },
}

export default function BlogPostPage() {
  const params = useParams()
  const slug = params?.slug as string
  const post = slug ? POSTS[slug] : null
  const t = useTranslations("blog")
  const locale = useLocale() || "en"

  if (!post) notFound()

  return (
    <article className="max-w-3xl mx-auto py-12 px-4">
      <Link
        href={`/${locale}/blog`}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-8 min-h-[44px]"
      >
        <ChevronLeft className="h-5 w-5" />
        {t("back")}
      </Link>
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">
        {t(post.titleKey)}
      </h1>
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t(post.contentKey)}</p>
      </div>
    </article>
  )
}
