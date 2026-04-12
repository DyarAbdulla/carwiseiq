"use client"

import { useState, useEffect, useRef, type ComponentType, type ReactNode } from "react"
import { useTranslations, useLocale } from "next-intl"
import { motion, useInView, AnimatePresence } from "framer-motion"
import {
  Code2,
  Server,
  Brain,
  Database,
  Cloud,
  Languages,
  BarChart3,
  Target,
  Mail,
  Phone,
  Globe,
  Sparkles,
  Layers,
  Cpu,
  GitBranch,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

type BioLang = "en" | "ku" | "ar"

const GLASS_CARD =
  "overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-2xl backdrop-blur-lg transition-all duration-300 hover:bg-white/[0.06] sm:rounded-2xl sm:p-6 sm:backdrop-blur-xl"

const GLASS_PILL =
  "overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03] p-4 shadow-2xl backdrop-blur-lg transition-all duration-300 hover:bg-white/[0.06] sm:p-6 sm:backdrop-blur-xl"

/** Connect / social links only — tight padding + readable at 2-col mobile */
const GLASS_PILL_SOCIAL =
  "overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-2 shadow-2xl backdrop-blur-lg transition-all duration-300 hover:bg-white/[0.06] sm:px-4 sm:py-2 sm:backdrop-blur-xl"

const GLASS_ICON = "rounded-lg bg-white/10 p-2"

const SECTION_TITLE =
  "bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent"

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  )
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  return (
    <h2 className="mb-6 flex flex-wrap items-center justify-center gap-3 text-center text-2xl font-bold tracking-tight sm:mb-8 sm:text-3xl">
      {Icon && (
        <Icon
          className="h-8 w-8 shrink-0 text-gray-300"
          aria-hidden
        />
      )}
      <span className={SECTION_TITLE}>{children}</span>
    </h2>
  )
}

function AnimatedStat({
  end,
  label,
  suffix = "",
  prefix = "",
  decimals = 0,
  className = "",
}: {
  end: number
  label: string
  suffix?: string
  prefix?: string
  decimals?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    let start: number | null = null
    const duration = 2200
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min((now - start) / duration, 1)
      setValue(easeOutCubic(p) * end)
      if (p < 1) requestAnimationFrame(tick)
      else setValue(end)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [inView, end])

  const formatted =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString()

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={`${GLASS_CARD} flex min-h-[112px] flex-col items-center justify-center text-center sm:min-h-[140px] ${className}`}
    >
      <p className="bg-gradient-to-br from-white via-gray-100 to-gray-300 bg-clip-text text-2xl font-bold tabular-nums text-transparent sm:text-3xl md:text-4xl">
        {prefix}
        {formatted}
        {suffix}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-gray-400 sm:text-sm">{label}</p>
    </motion.div>
  )
}

const sectionMotion = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
}

export default function AboutPage() {
  const t = useTranslations("about")
  const locale = useLocale()
  const isRtlPage = locale === "ar" || locale === "ku"

  const [bioLang, setBioLang] = useState<BioLang>("en")

  const techItems = [
    { icon: Code2, labelKey: "techFrontend", valueKey: "techFrontendValue" },
    { icon: Server, labelKey: "techBackend", valueKey: "techBackendValue" },
    { icon: Brain, labelKey: "techAI", valueKey: "techAIValue" },
    { icon: Database, labelKey: "techDatabase", valueKey: "techDatabaseValue" },
    { icon: Cloud, labelKey: "techHosting", valueKey: "techHostingValue" },
    {
      icon: Languages,
      labelKey: "techLanguages",
      valueKey: "techLanguagesValue",
    },
  ]

  const skillRows = [
    { icon: Code2, key: "skillStack1" as const },
    { icon: Layers, key: "skillStack2" as const },
    { icon: Cpu, key: "skillStack3" as const },
    { icon: Database, key: "skillStack4" as const },
    { icon: Cloud, key: "skillStack5" as const },
    { icon: GitBranch, key: "skillStack6" as const },
  ]

  const socialLinks = [
    {
      key: "fb",
      label: t("socialFacebook"),
      href: "https://www.facebook.com/share/17NA1np366/?mibextid=wwXIfr",
      Icon: FacebookIcon,
      sub: "Dyar Abdulla Ali",
    },
    {
      key: "ig",
      label: t("socialInstagram"),
      href: "https://www.instagram.com/mr_dyarm/",
      Icon: InstagramIcon,
      sub: t("socialInstagramHandle"),
    },
    {
      key: "tt",
      label: t("socialTiktok"),
      href: "https://www.tiktok.com/@_mrdyar_",
      Icon: TikTokIcon,
      sub: t("socialTiktokHandle"),
    },
    {
      key: "phone",
      label: t("socialPhone"),
      href: "tel:+9647774472106",
      Icon: Phone,
      sub: t("socialPhoneSubtitle"),
    },
    {
      key: "email",
      label: t("socialEmail"),
      href: "mailto:dyarabdula15@gmail.com",
      Icon: Mail,
      sub: "dyarabdula15@gmail.com",
    },
    {
      key: "web",
      label: t("socialWebsite"),
      href: "https://carwiseiq.com",
      Icon: Globe,
      sub: t("socialWebsiteSubtitle"),
    },
  ]

  const bioText =
    bioLang === "en"
      ? t("founderBioEn")
      : bioLang === "ku"
        ? t("founderBioKu")
        : t("founderBioAr")
  const bioDir =
    bioLang === "ar" || bioLang === "ku" ? ("rtl" as const) : ("ltr" as const)

  return (
    <div className="relative min-h-[100dvh] text-gray-100" dir={isRtlPage ? "rtl" : "ltr"}>
      {/* Layer 1: <img> ensures static export always resolves the asset */}
      <div className="fixed inset-0 -z-20 overflow-hidden" aria-hidden>
        <img
          src="/background-about.jpg"
          alt=""
          className="h-full min-h-[100dvh] w-full object-cover object-center [transform:translateZ(0)]"
        />
      </div>
      {/* Layer 2: match viewport height (no gaps while scrolling) */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 h-full min-h-[100dvh] w-full bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-[#0a0f1c] backdrop-blur-[2px]"
      />

      {/* Layer 3: content — no min-h-screen (avoids extra empty scroll) */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-20 md:gap-8 sm:px-6 sm:pb-24 lg:px-8">
        {/* Hero: title + subtitle only (no logo boxes / cards) */}
        <header className="flex min-h-[30vh] flex-col items-center justify-center px-2 pb-2 text-center sm:min-h-[40vh] sm:pb-0 md:min-h-[42vh]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl space-y-5"
          >
            <h1 className="bg-gradient-to-br from-white via-gray-100 to-gray-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl lg:text-7xl">
              {t("title")}
            </h1>
            <p className="text-lg font-medium leading-relaxed text-gray-300/95 sm:text-xl">
              {t("subtitle")}
            </p>
          </motion.div>
        </header>

        {/* Founder */}
        <motion.section {...sectionMotion}>
          <div className={GLASS_CARD}>
            <div className="flex flex-col items-center gap-6 sm:gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
              <div className="flex w-full flex-col items-center lg:col-span-4">
                <div
                  className="aspect-square w-[min(100%,260px)] max-w-[260px] shrink-0 overflow-hidden rounded-full ring-2 ring-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                >
                  <Image
                    src="/logoabout.jpg"
                    alt={t("founderName")}
                    width={260}
                    height={260}
                    className="h-full w-full rounded-full object-cover object-center"
                    unoptimized
                    priority
                  />
                </div>
                <p className="mt-4 max-w-xs text-center text-sm font-medium text-purple-300/90 sm:mt-5">
                  {t("founderHighlight")}
                </p>
              </div>

              <div className="w-full text-center lg:col-span-8 lg:text-start">
                <div className="space-y-4 sm:space-y-5">
                  <div>
                    <h3 className="text-2xl font-bold text-white sm:text-3xl">
                      {t("founderName")}
                    </h3>
                    <p className="mt-1 text-lg font-medium text-purple-200/90" dir="rtl">
                      {t("founderNameKurdish")}
                    </p>
                    <p className="mt-2 font-semibold text-purple-300/90">
                      {t("founderRole")}
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm leading-relaxed text-gray-400 sm:text-base">
                    <li>{t("founderAge")}</li>
                    <li>{t("founderLocation")}</li>
                    <li>{t("founderUniversity")}</li>
                    <li>{t("founderStatus")}</li>
                  </ul>

                  <div className="space-y-3 pt-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                      {t("founderTitle")}
                    </p>
                    <div
                      role="tablist"
                      aria-label={t("founderTitle")}
                      className="mx-auto inline-flex w-auto max-w-fit flex-wrap justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1 lg:mx-0 lg:w-full lg:max-w-md lg:justify-start"
                    >
                      {(
                        [
                          ["en", t("tabEn")],
                          ["ku", t("tabKu")],
                          ["ar", t("tabAr")],
                        ] as const
                      ).map(([code, label]) => (
                        <button
                          key={code}
                          type="button"
                          role="tab"
                          aria-selected={bioLang === code}
                          onClick={() => setBioLang(code)}
                          className={`min-h-[44px] flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all sm:min-w-[4.5rem] ${
                            bioLang === code
                              ? "bg-white/[0.12] text-white shadow-inner shadow-black/20"
                              : "text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={bioLang}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        dir={bioDir}
                        className={`${GLASS_CARD} mt-2 text-start text-sm leading-relaxed text-gray-300 sm:text-base`}
                      >
                        {bioText}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Skills */}
        <motion.section {...sectionMotion}>
          <SectionHeading icon={Sparkles}>{t("skillsTitle")}</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {skillRows.map(({ icon: Icon, key }) => (
              <motion.div
                key={key}
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className={GLASS_CARD}
              >
                <div className="flex items-start gap-4">
                  <div className={GLASS_ICON}>
                    <Icon className="h-5 w-5 text-gray-200" />
                  </div>
                  <p className="pt-0.5 text-sm font-medium leading-relaxed text-gray-200 sm:text-base">
                    {t(key)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section {...sectionMotion}>
          <SectionHeading icon={BarChart3}>{t("statsTitle")}</SectionHeading>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            <AnimatedStat end={62000} suffix="+" label={t("statCars")} />
            <AnimatedStat
              end={95.9}
              suffix="%"
              decimals={1}
              label={t("statAccuracy")}
            />
            <AnimatedStat end={3} label={t("statLanguages")} />
            <AnimatedStat end={4} suffix="+" label={t("statDevelopment")} />
          </div>
          {/* 5th stat: full-width row, centered (balanced below the 4-column grid) */}
          <div className="mt-6 flex w-full justify-center sm:mt-8">
            <div className="w-full max-w-sm sm:max-w-md">
              <AnimatedStat end={90} suffix="+" label={t("statBrands")} />
            </div>
          </div>
        </motion.section>

        {/* Built with */}
        <motion.section {...sectionMotion}>
          <h2
            className={`mb-6 text-center text-2xl font-bold tracking-tight sm:mb-8 sm:text-3xl ${SECTION_TITLE}`}
          >
            {t("techTitle")}
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {techItems.map(({ icon: Icon, labelKey, valueKey }) => (
              <motion.li
                key={labelKey}
                whileHover={{ y: -2 }}
                className={GLASS_CARD}
              >
                <div className="flex items-start gap-4">
                  <div className={GLASS_ICON}>
                    <Icon className="h-6 w-6 text-gray-200" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{t(labelKey)}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-400">
                      {t(valueKey)}
                    </p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* Vision */}
        <motion.section {...sectionMotion} className={GLASS_CARD}>
          <h2 className="mb-6 flex flex-wrap items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Target className="h-8 w-8 shrink-0 text-gray-300" aria-hidden />
            <span className={SECTION_TITLE}>{t("visionTitle")}</span>
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
            {t("visionText")}
          </p>
        </motion.section>

        {/* Connect */}
        <motion.section {...sectionMotion} className="pb-8">
          <h2
            className={`mb-6 text-center text-2xl font-bold tracking-tight sm:mb-8 sm:text-3xl ${SECTION_TITLE}`}
          >
            {t("connectTitle")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {socialLinks.map(({ key, label, href, Icon, sub }) => (
              <Link
                key={key}
                href={href}
                target={key === "phone" || key === "email" ? undefined : "_blank"}
                rel={
                  key === "phone" || key === "email"
                    ? undefined
                    : "noopener noreferrer"
                }
                className={`${GLASS_PILL_SOCIAL} group flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] sm:gap-3`}
              >
                <span
                  className={`${GLASS_ICON} flex h-8 w-8 shrink-0 items-center justify-center sm:h-10 sm:w-10`}
                >
                  <Icon className="h-4 w-4 text-gray-200 sm:h-5 sm:w-5" />
                </span>
                <div className="min-w-0 flex-1 text-start">
                  <p className="font-semibold text-[10px] leading-tight text-white xs:text-xs sm:text-sm">
                    {label}
                  </p>
                  <p className="truncate text-[10px] leading-snug text-gray-400 group-hover:text-gray-200 xs:text-xs sm:text-sm">
                    {sub}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
