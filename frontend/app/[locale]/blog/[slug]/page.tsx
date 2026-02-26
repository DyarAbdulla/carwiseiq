import { BlogPostClient } from "./BlogPostClient"

const SLUGS = [
  "how-to-know-used-car-value",
  "10-things-before-buying",
  "best-family-cars-kurdistan",
]

const LOCALES = ["en", "ku", "ar"] as const

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    SLUGS.map((slug) => ({
      locale,
      slug,
    }))
  )
}

export default function BlogPostPage() {
  return <BlogPostClient />
}
