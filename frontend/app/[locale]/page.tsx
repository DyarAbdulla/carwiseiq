"use client"

import { useState, useEffect, useMemo, memo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import {
  Target, Zap, Shield, BarChart3, Users,
  CheckCircle2, ArrowRight, Star, Globe,
  TrendingUp, Brain, MapPin,
  ChevronDown, Mail, Sparkles, Gift,
  Play, Award, TrendingDown,
  Database, CheckCircle, Clipboard, Search, Gavel, Plus, Car, Wallet,
  HelpCircle, Headphones, BookOpen, Flag, Phone, X, MessageCircle
} from 'lucide-react'
import Link from 'next/link'
import { LearnMoreModal } from '@/components/LearnMoreModal'
import { SellCarCTA } from '@/components/SellCarCTA'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api'
import { listingImageUrl } from '@/lib/utils'
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Lazy-load background video so it doesn't block initial render or main bundle
const BackgroundVideo = dynamic(
  () => import('@/components/BackgroundVideo').then((m) => m.BackgroundVideo),
  { ssr: false }
)

// TypeScript interfaces for Hero Section
interface HeroSectionProps {
  t: (key: string) => string
  locale: string
  tCommon: (key: string) => string
  onLearnMoreClick: () => void
}

// Enhanced Hero Section Component - Redesigned
const HeroSection = memo(function HeroSection({ t, locale, tCommon, onLearnMoreClick }: HeroSectionProps) {
  return (
    <section
      className="relative isolate min-h-[60vh] min-h-[60dvh] sm:min-h-[70vh] md:min-h-[calc(100vh-80px)] flex flex-col items-center justify-center overflow-hidden py-20"
      aria-labelledby="hero-title"
    >
      {/* Content */}
      <div className="relative z-10 container w-full max-w-[100%]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 sm:gap-8 text-center px-4 sm:px-6 lg:px-8">
          {/* Headline - Crystal Clear White with Cinematic Style */}
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-3xl min-[375px]:text-4xl sm:text-5xl md:text-5xl font-extrabold leading-tight tracking-tight text-center max-w-4xl mx-auto text-slate-900 dark:text-white drop-shadow-xl px-1"
          >
            {t('smartestWay')}
          </motion.h1>

          {/* Sub-headline - Lighter and thinner */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="max-w-2xl mx-auto text-[1rem] sm:text-lg md:text-xl text-slate-200 font-normal leading-relaxed px-2"
          >
            {t('heroSubheadline')}
          </motion.p>

          {/* Call to Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          >
            {/* Primary Button: Get Price Estimate */}
            <Link
              href={`/${locale}/predict`}
              aria-label="Get price estimate"
              className="w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-xl"
            >
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/30 min-h-[48px] sm:min-h-[52px] px-6 py-4 sm:px-8 sm:py-6 text-base sm:text-lg font-semibold transition-all duration-300 touch-manipulation active:scale-[0.98]"
              >
                <ArrowRight className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" aria-hidden="true" />
                {tCommon('getPriceNow') || 'Get Price Estimate'}
              </Button>
            </Link>

            {/* Secondary Button: Sell My Car */}
            <div className="w-full sm:w-auto focus-within:ring-2 focus-within:ring-white/20 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 rounded-xl">
              <SellCarCTA
                variant="outline"
                size="lg"
                showIcon={false}
                className="w-full sm:w-auto border-2 border-slate-300 dark:border-white/30 bg-white/80 dark:bg-white/5 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-400 dark:hover:border-white/40 hover:shadow-lg hover:shadow-white/10 text-slate-900 dark:text-white min-h-[48px] sm:min-h-[52px] px-6 py-4 sm:px-8 sm:py-6 text-base sm:text-lg font-semibold transition-all duration-300 rounded-xl touch-manipulation active:scale-[0.98]"
              >
                {t('nav.sellCar') || 'Sell My Car'}
              </SellCarCTA>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
})

// Memoized components for performance
const HowItWorksSection = memo(function HowItWorksSection({ t }: { t: (k: string) => string }) {
  const steps = [
    { icon: Clipboard, title: t('howItWorks.step1.title'), description: t('howItWorks.step1.description') },
    { icon: Search, title: t('howItWorks.step2.title'), description: t('howItWorks.step2.description') },
    { icon: Gavel, title: t('howItWorks.step3.title'), description: t('howItWorks.step3.description') },
  ]

  return (
    <section className="relative z-10 w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="how-it-works-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.h2
          id="how-it-works-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-10 lg:mb-12 text-slate-900 dark:text-white tracking-tight"
        >
          {t('howItWorks.title')}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 md:gap-6 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                <div className="h-full rounded-2xl border border-slate-200 dark:border-white/20 md:border-slate-200 dark:md:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 p-6 sm:p-8 flex flex-col items-center text-center shadow-sm">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/80 dark:bg-white/10 border border-slate-200 dark:border-white/20 md:border-slate-200 dark:md:border-white/10 flex items-center justify-center mb-4">
                    <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300/90">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 rtl:right-auto rtl:-left-3 -translate-y-1/2 z-10">
                    <ArrowRight className="h-5 w-5 text-indigo-400/70 rtl:rotate-180" />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
})

const ValuePropositionSection = memo(function ValuePropositionSection({ t, locale }: { t: any, locale: string }) {
  const features = [
    { icon: Gift, text: t('valueProposition.features.unlimited') },
    { icon: Users, text: t('valueProposition.features.noSignup') },
    { icon: Shield, text: t('valueProposition.features.noAds') },
    { icon: Sparkles, text: t('valueProposition.features.alwaysFree') },
  ]

  return (
    <section className="w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="value-prop-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h2 id="value-prop-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-slate-900 dark:text-white">
            {t('valueProposition.subtitle')}
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8] mb-8">
            {t('valueProposition.description')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex flex-col items-center p-4 bg-white/[0.03] backdrop-blur-xl rounded-lg border border-white/10 max-md:border-white/20 hover:bg-white/[0.05] hover:border-white/20 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all duration-300"
                >
                  <Icon className="h-8 w-8 text-[#5B7FFF] mb-2" />
                  <span className="text-sm text-center text-[#e2e8f0]">{feature.text}</span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
})

const SocialProofSection = memo(function SocialProofSection({ t, locale }: { t: any, locale: string }) {
  const testimonials = [
    {
      name: t('socialProof.testimonial1.name'),
      location: t('socialProof.testimonial1.location'),
      text: t('socialProof.testimonial1.text'),
      rating: 5
    },
    {
      name: t('socialProof.testimonial2.name'),
      location: t('socialProof.testimonial2.location'),
      text: t('socialProof.testimonial2.text'),
      rating: 5
    },
    {
      name: t('socialProof.testimonial3.name'),
      location: t('socialProof.testimonial3.location'),
      text: t('socialProof.testimonial3.text'),
      rating: 5
    },
  ]

  return (
    <section className="w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="social-proof-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-10 lg:mb-12"
        >
          <h2 id="social-proof-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-slate-900 dark:text-white">
            {t('socialProof.title')}
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8]">
            {t('socialProof.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="border border-white/10 max-md:border-white/20 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.05] hover:border-white/20 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all duration-300 h-full">
                <CardHeader>
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <CardDescription className="text-[#94a3b8] italic">
                    &quot;{testimonial.text}&quot;
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5B7FFF] to-purple-600 flex items-center justify-center">
                      <span className="text-slate-900 dark:text-white font-bold">{testimonial.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{testimonial.name}</p>
                      <p className="text-sm text-[#94a3b8]">{testimonial.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
})

const RegionalIntelligenceSection = memo(function RegionalIntelligenceSection({ t, locale }: { t: any, locale: string }) {
  const features = [
    { icon: MapPin, text: t('regionalIntelligence.features.localData') },
    { icon: TrendingUp, text: t('regionalIntelligence.features.regionalPricing') },
    { icon: Globe, text: t('regionalIntelligence.features.currencySupport') },
    { icon: BarChart3, text: t('regionalIntelligence.features.localMakes') },
  ]

  return (
    <section className="w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="regional-intel-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12 items-center max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-purple-600/20 text-purple-400 border-purple-600/50 text-xs sm:text-sm">
              {t('regionalIntelligence.subtitle')}
            </Badge>
            <h2 id="regional-intel-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-slate-900 dark:text-white">
              {t('regionalIntelligence.title')}
            </h2>
            <p className="text-sm sm:text-base text-[#94a3b8] mb-8">
              {t('regionalIntelligence.description')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-center gap-3 p-4 bg-white/[0.03] backdrop-blur-xl rounded-lg border border-white/10 max-md:border-white/20 hover:bg-white/[0.05] hover:border-white/20 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/10 transition-all duration-300"
                  >
                    <Icon className="h-6 w-6 text-purple-400" />
                    <span className="text-sm text-[#e2e8f0]">{feature.text}</span>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <Card className="border border-white/10 max-md:border-white/20 bg-white/[0.03] backdrop-blur-xl p-6 md:p-8 hover:bg-white/[0.05] hover:border-white/20 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all duration-300">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-purple-600/10 rounded-lg">
                  <span className="text-[#94a3b8]">Market Coverage</span>
                  <span className="text-2xl font-bold text-purple-400">Iraq & Kurdistan</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-purple-600/10 rounded-lg">
                  <span className="text-[#94a3b8]">Regional Data Points</span>
                  <span className="text-2xl font-bold text-purple-400">60,000+</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-purple-600/10 rounded-lg">
                  <span className="text-[#94a3b8]">Local Makes</span>
                  <span className="text-2xl font-bold text-purple-400">50+</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
})

// Popular Brands quick-links — scroll to predict CTA
const PopularBrandsSection = memo(function PopularBrandsSection({ t }: { t: (k: string) => string }) {
  const brands = ['Toyota', 'Hyundai', 'Kia', 'Nissan', 'BMW']

  const scrollToForm = () => {
    const el = document.getElementById('predict-cta')
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section className="relative z-10 w-full py-8 sm:py-10" aria-label={t('popularBrandsLabel')}>
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-4xl">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {brands.map((brand) => (
            <motion.button
              key={brand}
              type="button"
              onClick={scrollToForm}
              whileHover={{ scale: 1.05, boxShadow: '0 4px 20px rgba(99, 102, 241, 0.2)' }}
              whileTap={{ scale: 0.98 }}
              className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-full text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/20 md:border-slate-200 dark:md:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300"
            >
              {brand}
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  )
})

const InteractiveDemoSection = memo(function InteractiveDemoSection({ t, locale }: { t: any, locale: string }) {
  return (
    <section id="predict-cta" className="relative z-10 w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="demo-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 id="demo-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-slate-900 dark:text-white">
            {t('interactiveDemo.title')}
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8] mb-4">
            {t('interactiveDemo.subtitle')}
          </p>
          <p className="text-sm sm:text-base text-[#94a3b8] mb-8">
            {t('interactiveDemo.description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/predict`}>
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#5B7FFF] to-purple-600 hover:from-[#4a6fe6] hover:to-purple-500 text-white shadow-lg shadow-[#5B7FFF]/50 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 px-8 py-6 text-lg font-semibold"
              >
                {t('interactiveDemo.tryDemo')}
              </Button>
            </Link>
            <span className="self-center text-[#94a3b8]">{t('interactiveDemo.or')}</span>
            <Link href={`/${locale}/predict`}>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] backdrop-blur-md hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/20 text-slate-900 dark:text-white transition-all duration-300 px-8 py-6 text-lg font-semibold"
              >
                {t('interactiveDemo.getStarted')}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
})

const ComparisonSection = memo(function ComparisonSection({ t, locale }: { t: any, locale: string }) {
  const features = [
    { key: 'free', us: true, others: false },
    { key: 'accuracy', us: true, others: 'partial' },
    { key: 'noSignup', us: true, others: false },
    { key: 'batch', us: true, others: false },
    { key: 'compare', us: true, others: 'partial' },
    { key: 'api', us: true, others: 'paid' },
    { key: 'support', us: true, others: false },
  ]

  return (
    <section className="w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="comparison-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-10 lg:mb-12"
        >
          <h2 id="comparison-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white">
            {t('comparison.title')}
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8]">
            {t('comparison.subtitle')}
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <Card className="border border-white/10 max-md:border-white/20 bg-white/[0.03] backdrop-blur-xl overflow-visible">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-[#94a3b8] font-semibold">{t('comparison.features.free')}</th>
                    <th className="text-center p-4 text-white font-bold">{t('comparison.us')}</th>
                    <th className="text-center p-4 text-[#94a3b8] font-semibold">{t('comparison.others')}</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, index) => (
                    <motion.tr
                      key={feature.key}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      className="border-b border-white/10 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="p-4 text-[#e2e8f0]">{t(`comparison.features.${feature.key}`)}</td>
                      <td className="p-4 text-center">
                        {feature.us === true ? (
                          <CheckCircle2 className="h-6 w-6 text-green-400 mx-auto" />
                        ) : (
                          <span className="text-[#94a3b8]">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {feature.others === true ? (
                          <CheckCircle2 className="h-6 w-6 text-green-400 mx-auto" />
                        ) : feature.others === 'partial' ? (
                          <span className="text-yellow-400">Partial</span>
                        ) : feature.others === 'paid' ? (
                          <span className="text-[#94a3b8]">Paid</span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
})

const FAQSection = memo(function FAQSection({ t, locale }: { t: any, locale: string }) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const faqs = [
    { q: 'q1', question: t('faq.q1.question'), answer: t('faq.q1.answer') },
    { q: 'q2', question: t('faq.q2.question'), answer: t('faq.q2.answer') },
    { q: 'q3', question: t('faq.q3.question'), answer: t('faq.q3.answer') },
    { q: 'q4', question: t('faq.q4.question'), answer: t('faq.q4.answer') },
    { q: 'q5', question: t('faq.q5.question'), answer: t('faq.q5.answer') },
    { q: 'q6', question: t('faq.q6.question'), answer: t('faq.q6.answer') },
  ]

  const toggleItem = (q: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(q)) {
        next.delete(q)
      } else {
        next.add(q)
      }
      return next
    })
  }

  return (
    <section className="w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="faq-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-10 lg:mb-12"
        >
          <h2 id="faq-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white">
            {t('faq.title')}
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8]">
            {t('faq.subtitle')}
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openItems.has(faq.q)
            return (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Collapsible open={isOpen} onOpenChange={() => toggleItem(faq.q)}>
                  <Card className="border border-white/10 max-md:border-white/20 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.05] hover:border-white/20 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all duration-300">
                    <CollapsibleTrigger className="w-full" aria-expanded={isOpen}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-start text-white font-semibold pe-4">
                          {faq.question}
                        </CardTitle>
                        <ChevronDown
                          className={`h-5 w-5 text-[#94a3b8] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <p className="text-[#94a3b8] leading-relaxed">
                          {faq.answer}
                        </p>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
})

const NewsletterSection = memo(function NewsletterSection({ t, locale }: { t: any, locale: string }) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, this would call an API
    setSubscribed(true)
    setTimeout(() => setSubscribed(false), 3000)
  }

  return (
    <section className="w-full py-12 sm:py-14 md:py-16 lg:py-24" aria-labelledby="newsletter-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          <Mail className="h-10 w-10 sm:h-12 sm:w-12 text-[#5B7FFF] mx-auto mb-4" />
          <h2 id="newsletter-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white">
            {t('newsletter.title')}
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8] mb-2">
            {t('newsletter.subtitle')}
          </p>
          <p className="text-sm sm:text-base text-[#94a3b8] mb-8">
            {t('newsletter.description')}
          </p>

          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input
              type="email"
              placeholder={t('newsletter.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-white/[0.03] backdrop-blur-sm border border-white/10 text-white placeholder:text-[#94a3b8]"
              required
              aria-label="Email address"
            />
            <Button
              type="submit"
              className="bg-gradient-to-r from-[#5B7FFF] to-purple-600 hover:from-[#4a6fe6] hover:to-purple-500 text-white"
              disabled={subscribed}
            >
              {subscribed ? '✓ Subscribed!' : t('newsletter.subscribe')}
            </Button>
          </form>
          <p className="text-xs text-[#94a3b8] mt-4">
            {t('newsletter.privacy')}
          </p>
        </motion.div>
      </div>
    </section>
  )
})

const FinalCTASection = memo(function FinalCTASection({ t, locale }: { t: any, locale: string }) {
  return (
    <section className="w-full py-12 sm:py-14 md:py-16 lg:py-24 relative overflow-hidden" aria-labelledby="final-cta-title">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 id="final-cta-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white">
            {t('finalCta.title')}
          </h2>
          <p className="text-base sm:text-lg text-white/90 mb-2">
            {t('finalCta.subtitle')}
          </p>
          <p className="text-sm sm:text-base text-white/80 mb-8">
            {t('finalCta.description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/predict`}>
              <Button
                size="lg"
                className="bg-white text-[#5B7FFF] hover:bg-white/90 shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-6 text-lg font-semibold"
              >
                {t('finalCta.ctaButton')}
              </Button>
            </Link>
            <Link href={`/${locale}/predict`}>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white/30 bg-white/10 backdrop-blur-md hover:bg-white/20 hover:border-white/50 text-white transition-all duration-300 px-8 py-6 text-lg font-semibold"
              >
                {t('finalCta.secondaryButton')}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
})

// --- Mobile-first home sections (order: Predict, Sell, Budget, Best Deals, Compare, Stats) ---

const PredictShortcutSection = memo(function PredictShortcutSection({ t, locale }: { t: (k: string) => string; locale: string }) {
  return (
    <section className="w-full py-6 sm:py-8" aria-labelledby="predict-shortcut">
      <div className="container mx-auto px-4 sm:px-6 max-w-[100%]">
        <Link href={`/${locale}/predict`} className="block">
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-6 flex items-center justify-between gap-4 min-h-[60px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Play className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h2 id="predict-shortcut" className="text-lg font-bold text-white">{t('nav.predict')}</h2>
                <p className="text-sm text-slate-400">{t('nav.predictSubtitle')}</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 rtl:rotate-180" />
          </motion.div>
        </Link>
      </div>
    </section>
  )
})

const SellCtaSection = memo(function SellCtaSection({ t, locale }: { t: (k: string) => string; locale: string }) {
  return (
    <section className="w-full py-6 sm:py-8" aria-labelledby="sell-cta">
      <div className="container mx-auto px-4 sm:px-6 max-w-[100%]">
        <SellCarCTA as="span" showIcon={false} className="block">
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="rounded-2xl border border-slate-200 dark:border-white/20 md:border-slate-200 dark:md:border-white/10 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-xl p-5 sm:p-6 flex items-center justify-between gap-4 min-h-[60px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/30 flex items-center justify-center shrink-0">
                <Plus className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
              </div>
              <h2 id="sell-cta" className="text-lg font-bold text-slate-900 dark:text-white">{t('nav.sellCar')}</h2>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 rtl:rotate-180" />
          </motion.div>
        </SellCarCTA>
      </div>
    </section>
  )
})

const BUDGET_CHIPS = [
  { label: 'Under $5k', range: '0-5000' },
  { label: '$5k–$10k', range: '5000-10000' },
  { label: '$10k–$20k', range: '10000-20000' },
  { label: '$20k–$30k', range: '20000-30000' },
  { label: '$30k–$50k', range: '30000-50000' },
  { label: '$50k+', range: '50000-200000' },
]

const BudgetChipsSection = memo(function BudgetChipsSection({ t, locale }: { t: (k: string) => string; locale: string }) {
  return (
    <section className="w-full py-6 sm:py-8" aria-labelledby="budget-chips">
      <div className="container mx-auto px-4 sm:px-6 max-w-[100%]">
        <h2 id="budget-chips" className="text-lg font-bold text-white mb-4">{t('nav.budget')}</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide overflow-y-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          {BUDGET_CHIPS.map((chip) => (
            <Link
              key={chip.range}
              href={`/${locale}/buy-sell`}
              className="shrink-0 min-h-[44px] px-4 py-2.5 rounded-full bg-white/5 border border-white/20 md:border-white/10 text-sm font-medium text-slate-200 hover:bg-white/10 hover:border-white/20 transition-colors flex items-center gap-2"
            >
              <Wallet className="h-4 w-4 text-indigo-400" />
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
})

const BestDealsSection = memo(function BestDealsSection({ t, locale }: { t: (k: string) => string; locale: string }) {
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    apiClient.searchListings({ page_size: 6 }).then((r: any) => setDeals(r?.items || [])).catch(() => { }).finally(() => setLoading(false))
  }, [])
  return (
    <section className="w-full py-6 sm:py-8" aria-labelledby="best-deals">
      <div className="container mx-auto px-4 sm:px-6 max-w-[100%]">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 id="best-deals" className="text-lg font-bold text-white">{t('bestDeals')}</h2>
          <Link href={`/${locale}/buy-sell`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">{t('viewAll')}</Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="car-card-image-wrap shrink-0 w-[260px] h-[180px] rounded-2xl" />
            ))
            : deals.length === 0
              ? (
                <Link href={`/${locale}/buy-sell`} className="shrink-0 w-[260px] rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col items-center justify-center gap-2 min-h-[160px]">
                  <Car className="h-10 w-10 text-slate-500" />
                  <span className="text-sm text-slate-400">Browse listings</span>
                </Link>
              )
              : deals.map((d: any) => (
                <Link key={d.id} href={`/${locale}/buy-sell/${d.id}`} className="shrink-0 w-[260px] rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="aspect-[16/10] car-card-image-wrap bg-slate-800/50 relative">
                    {d.cover_image ? (
                      <img src={listingImageUrl(d.cover_image)} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : <Car className="absolute inset-0 m-auto h-12 w-12 text-slate-600" />}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-white truncate">{d.year} {d.make} {d.model}</p>
                    <p className="text-lg font-bold text-indigo-400">${d.price?.toLocaleString()}</p>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </section>
  )
})

const CompareShortcutSection = memo(function CompareShortcutSection({ t, locale }: { t: (k: string) => string; locale: string }) {
  return (
    <section className="w-full py-6 sm:py-8" aria-labelledby="compare-shortcut">
      <div className="container mx-auto px-4 sm:px-6 max-w-[100%]">
        <Link href={`/${locale}/compare`} className="block">
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-6 flex items-center justify-between gap-4 min-h-[60px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                <BarChart3 className="h-6 w-6 text-purple-400" />
              </div>
              <h2 id="compare-shortcut" className="text-lg font-bold text-white">{t('nav.compare')}</h2>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 rtl:rotate-180" />
          </motion.div>
        </Link>
      </div>
    </section>
  )
})

// Market Pulse Bento Card Section
const MarketPulseSection = memo(function MarketPulseSection({ t }: { t: (k: string) => string }) {
  return (
    <section className="relative z-10 w-full py-6 sm:py-8" aria-labelledby="market-pulse">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-6 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-500/20 border border-white/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-400" />
            </div>
            <div>
              <h3 id="market-pulse" className="text-base sm:text-lg font-semibold text-white mb-1">
                {t('marketPulseTitle')}
              </h3>
              <p className="text-sm text-slate-300/90">
                {t('marketPulseText')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
})

// Support Section - Help Center
// Floating Support Button with Modal
const FloatingSupportButton = memo(function FloatingSupportButton({ t, locale }: { t: (k: string) => string; locale: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const supportCards = [
    {
      icon: HelpCircle,
      title: t('support.faq.title') || 'Frequently Asked Questions',
      description: t('support.faq.description') || 'Find quick answers to common questions about buying, selling, and using CarWiseIQ',
      button: t('support.faq.button') || 'View FAQs',
      link: `/${locale}/terms#faq`,
      color: 'indigo'
    },
    {
      icon: Headphones,
      title: t('support.contact.title') || 'Contact Us',
      description: t('support.contact.description') || 'Get in touch with our support team for personalized assistance',
      phone: '0777 447 2106',
      email: 'carwise15@gmail.com',
      color: 'purple'
    },
    {
      icon: BookOpen,
      title: t('support.guide.title') || 'User Guide',
      description: t('support.guide.description') || 'Learn how to get the most out of CarWiseIQ\'s features',
      button: t('support.guide.button') || 'Learn More',
      link: `/${locale}/docs`,
      color: 'blue'
    },
    {
      icon: Flag,
      title: t('support.report.title') || 'Report a Problem',
      description: t('support.report.description') || 'Found a bug or suspicious listing? Let us know',
      button: t('support.report.button') || 'Report Issue',
      link: `mailto:carwise15@gmail.com?subject=Report Issue`,
      color: 'red'
    }
  ]

  const faqItems = [
    'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'
  ]

  return (
    <>
      {/* Floating Support Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed z-[1000] w-14 h-14 min-w-[56px] min-h-[56px] sm:w-14 sm:h-14 bg-[#8B5CF6] text-white rounded-full shadow-lg shadow-[#8B5CF6]/50 hover:shadow-[#8B5CF6]/70 flex items-center justify-center transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#1a1d29] right-6 rtl:right-auto rtl:left-6 touch-manipulation"
        style={{ bottom: 'max(1.5rem, calc(0.5rem + env(safe-area-inset-bottom)))' }}
        aria-label={t('support.title') || 'Need Help?'}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        whileHover={{ scale: 1.1, boxShadow: '0 10px 25px rgba(139, 92, 246, 0.6)' }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
        <span className="sr-only">{t('support.title') || 'Need Help?'}</span>
      </motion.button>

      {/* Support Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] h-[100vh] sm:h-auto overflow-y-auto bg-white dark:bg-[#1a1d29] border-slate-200 dark:border-[#2a2d3a] p-0 rounded-none sm:rounded-lg w-full sm:w-auto top-0 sm:top-[50%] left-0 sm:left-[50%] translate-y-0 sm:translate-y-[-50%] translate-x-0 sm:translate-x-[-50%]"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="p-4 sm:p-6 pb-4 border-b border-slate-200 dark:border-[#2a2d3a] sticky top-0 bg-white dark:bg-[#1a1d29] z-10">
            <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              {t('support.title') || 'Need Help?'}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Support Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {supportCards.map((card, index) => {
                const Icon = card.icon
                const colorClasses = {
                  indigo: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
                  purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
                  blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
                  red: 'bg-red-500/20 border-red-500/30 text-red-400'
                }

                return (
                  <Card
                    key={index}
                    className="border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm hover:bg-white dark:hover:bg-white/10 hover:border-[#8B5CF6]/30 hover:shadow-lg hover:shadow-[#8B5CF6]/20 transition-all duration-300"
                  >
                    <CardHeader className="pb-4">
                      <div className={`w-10 h-10 rounded-xl ${colorClasses[card.color as keyof typeof colorClasses]} border flex items-center justify-center mb-3 transition-transform duration-300`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        {card.title}
                      </CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {card.button && card.link ? (
                        <Link href={card.link} onClick={() => setIsOpen(false)}>
                          <Button
                            variant="outline"
                            className="w-full border-[#8B5CF6]/30 text-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white transition-all duration-300"
                          >
                            {card.button}
                            <ArrowRight className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                          </Button>
                        </Link>
                      ) : card.phone && card.email ? (
                        <div className="space-y-3">
                          <a
                            href={`tel:+9647774472106`}
                            className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-[#8B5CF6] transition-colors duration-300"
                          >
                            <Phone className="h-4 w-4" />
                            <span className="text-sm font-medium">{card.phone}</span>
                          </a>
                          <a
                            href={`mailto:${card.email}`}
                            className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-[#8B5CF6] transition-colors duration-300"
                          >
                            <Mail className="h-4 w-4" />
                            <span className="text-sm font-medium break-all">{card.email}</span>
                          </a>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* FAQ Expandable Section */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#2a2d3a]">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {t('support.faqSection.title') || 'Frequently Asked Questions'}
              </h3>
              <div className="space-y-3">
                {faqItems.map((qKey, index) => {
                  const question = t(`support.faqSection.${qKey}.question`) || `Question ${index + 1}`
                  const answer = t(`support.faqSection.${qKey}.answer`) || 'Answer not available'
                  const isFaqOpen = openFaq === index

                  return (
                    <div
                      key={qKey}
                      className="border border-slate-300 dark:border-white/10 rounded-lg overflow-hidden bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
                    >
                      <button
                        onClick={() => toggleFaq(index)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                      >
                        <span className="font-semibold text-slate-900 dark:text-white pr-4 text-sm sm:text-base">
                          {question}
                        </span>
                        <motion.div
                          animate={{ rotate: isFaqOpen ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                          className="shrink-0"
                        >
                          {isFaqOpen ? (
                            <X className="h-5 w-5 text-[#8B5CF6]" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-[#8B5CF6]" />
                          )}
                        </motion.div>
                      </button>
                      <motion.div
                        initial={false}
                        animate={{ height: isFaqOpen ? 'auto' : 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 text-slate-700 dark:text-gray-300 leading-relaxed border-t border-slate-300 dark:border-white/10 text-sm sm:text-base">
                          {answer}
                        </div>
                      </motion.div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})

// Trust Bar Section - Glass effect strip with stats
const TrustBarSection = memo(function TrustBarSection({ t }: { t: (k: string) => string }) {
  return (
    <section className="relative z-10 w-full py-6 sm:py-8" aria-labelledby="trust-bar">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl border border-slate-200 dark:border-white/20 md:border-slate-200 dark:md:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-xl p-5 sm:p-6"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-8 md:gap-12">
            {/* Stat 1: Cars Analyzed */}
            <div className="flex items-center gap-3" role="listitem">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Database className="h-6 w-6 text-indigo-400" aria-hidden="true" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">55,000+</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t('analyzedCount')}</div>
              </div>
            </div>

            {/* Stat 2: Model Accuracy */}
            <div className="flex items-center gap-3" role="listitem">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Award className="h-6 w-6 text-purple-400" aria-hidden="true" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">99%</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t('trustBarAccuracy')}</div>
              </div>
            </div>

            {/* Stat 3: Daily Market Updates */}
            <div className="flex items-center gap-3" role="listitem">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('dailyUpdates')}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t('marketUpdates')}</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
})

// Bento Grid Section - Feature Discovery Zone
const BentoGridSection = memo(function BentoGridSection({ t, locale }: { t: (k: string) => string; locale: string }) {
  const BUDGET_CHIPS = [
    { labelKey: 'budgetUnder10k' as const, range: '0-10000' },
    { labelKey: 'budget10k20k' as const, range: '10000-20000' },
    { labelKey: 'budget20k30k' as const, range: '20000-30000' },
    { labelKey: 'budget30kPlus' as const, range: '30000-200000' },
  ]

  return (
    <section className="relative z-10 w-full py-20" aria-labelledby="bento-grid">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Market Pulse */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/[0.07] hover:border-purple-500/50 transition-all duration-300 glassCard cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-indigo-400" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">{t('marketPulseTitle')}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {t('marketPulseText')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Budget Finder - Now integrated into Marketplace */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/[0.07] hover:border-purple-500/50 transition-all duration-300 glassCard cursor-pointer"
          >
            <Link href={`/${locale}/buy-sell`} className="block">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-6 w-6 text-purple-400" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('budgetFinderTitle')}</h3>
                  <p className="text-sm text-slate-300">{t('budgetFinderSubtitle')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {BUDGET_CHIPS.map((chip) => (
                  <span
                    key={chip.range}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    {t(chip.labelKey)}
                  </span>
                ))}
              </div>
            </Link>
          </motion.div>

          {/* Card 3: Compare */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="rounded-2xl border border-white/20 md:border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/[0.07] hover:border-purple-500/50 transition-all duration-300 glassCard cursor-pointer"
          >
            <Link href={`/${locale}/compare`} className="block">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-6 w-6 text-blue-400" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">{t('compareTitle')}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {t('compareSubtitle')}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 flex-shrink-0 rtl:rotate-180" aria-hidden="true" />
              </div>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
})

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [learnMoreOpen, setLearnMoreOpen] = useState(false)

  // Ensure component only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Hooks must be called unconditionally - handle errors in render
  const t = useTranslations('home')
  const locale = useLocale() || 'en'
  const tCommon = useTranslations('common')

  // Memoize translations to prevent re-renders
  const translations = useMemo(() => ({ t, locale }), [t, locale])

  // Don't render until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-label="Loading">
        <div className="text-[#94a3b8]">Loading...</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {/* Transparent so video background (BackgroundVideo) shows through; no static images */}
      <div className="relative min-h-screen min-h-[100dvh] bg-transparent">
        {/* Background video: fixed, behind content, Home only — unmounts on nav to /predict, etc. */}
        <BackgroundVideo />
        {/* Two subtle fixed radial glows (indigo/violet at ~10% opacity, blur-3xl) - Home only; unmounts on nav */}
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col">
          {/* 1. Hero Section */}
          <HeroSection
            t={t}
            locale={locale}
            tCommon={tCommon}
            onLearnMoreClick={() => {
              try { setLearnMoreOpen(true) } catch (e) {
                if (process.env.NODE_ENV === 'development') {
                  console.error(e)
                }
              }
            }}
          />

          {/* 2. Bento Grid - Feature Discovery Zone (Market Pulse, Budget Finder, Compare Cars) */}
          <BentoGridSection t={t} locale={locale} />

          {/* 4. Trust Bar */}
          <TrustBarSection t={t} />

          {/* Learn More Modal — Footer is in layout */}
          <ErrorBoundary>
            <LearnMoreModal open={learnMoreOpen} onOpenChange={setLearnMoreOpen} />
          </ErrorBoundary>

          {/* Floating Support Button */}
          <ErrorBoundary>
            <FloatingSupportButton t={t} locale={locale} />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  )
}
