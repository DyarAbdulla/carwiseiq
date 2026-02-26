import type { Metadata } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://carwiseiq.com"

const defaultMeta = {
  title: "CarWiseIQ - AI Car Valuation for Kurdistan & Iraq",
  description:
    "Get accurate AI-powered car price estimates for Iraq and Kurdistan. Compare vehicles, find market values, and buy or sell smarter.",
  ogImage: `${SITE_URL}/og-image.png`,
  twitterCard: "summary_large_image" as const,
}

const localeMeta: Record<string, { title: string; description: string }> = {
  en: {
    title: "CarWiseIQ - AI Car Valuation for Kurdistan & Iraq",
    description:
      "Get accurate AI-powered car price estimates for Iraq and Kurdistan. Compare vehicles, find market values, and buy or sell smarter.",
  },
  ku: {
    title: "CarWiseIQ - نرخاندنی ئۆتۆمبێل بە AI بۆ کوردستان و عێراق",
    description:
      "نرخاندنی وردی ئۆتۆمبێل بە زیرەکی دەستکرد. بەراورد بکە، نرخی بازاڕ بدۆزەرەوە، و کڕین و فرۆشتنی زیرەکانە بکە.",
  },
  ar: {
    title: "CarWiseIQ - تقييم السيارات بالذكاء الاصطناعي للعراق وكردستان",
    description:
      "احصل على تقديرات دقيقة لأسعار السيارات بالذكاء الاصطناعي. قارن المركبات، اعرف قيمتها السوقية، واشترِ أو بع بذكاء.",
  },
}

export function getMetadata(locale: string = "en"): Metadata {
  const meta = localeMeta[locale] || localeMeta.en
  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: SITE_URL,
      siteName: "CarWiseIQ",
      images: [{ url: defaultMeta.ogImage, width: 1200, height: 630 }],
      locale: locale === "ku" ? "ckb" : locale,
      type: "website",
    },
    twitter: {
      card: defaultMeta.twitterCard,
      title: meta.title,
      description: meta.description,
    },
    metadataBase: new URL(SITE_URL),
  }
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CarWiseIQ",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description: "AI-powered car valuation platform for Iraq and Kurdistan",
}

export const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "CarWiseIQ",
  url: SITE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "IQD",
  },
}
