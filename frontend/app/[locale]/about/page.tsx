"use client"

import { useTranslations, useLocale } from 'next-intl'
import { motion } from 'framer-motion'
import {
  User,
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
  MessageCircle
} from 'lucide-react'
import Link from 'next/link'

export default function AboutPage() {
  const t = useTranslations('about')
  const locale = useLocale()
  const isRtl = locale === 'ar' || locale === 'ku'

  const techItems = [
    { icon: Code2, labelKey: 'techFrontend', valueKey: 'techFrontendValue' },
    { icon: Server, labelKey: 'techBackend', valueKey: 'techBackendValue' },
    { icon: Brain, labelKey: 'techAI', valueKey: 'techAIValue' },
    { icon: Database, labelKey: 'techDatabase', valueKey: 'techDatabaseValue' },
    { icon: Cloud, labelKey: 'techHosting', valueKey: 'techHostingValue' },
    { icon: Languages, labelKey: 'techLanguages', valueKey: 'techLanguagesValue' }
  ]

  const stats = [
    { value: '55,000+', labelKey: 'carsAnalyzed' },
    { value: '99%', labelKey: 'accuracy' },
    { value: 'Daily', labelKey: 'updates' },
    { value: '3', labelKey: 'languages' },
    { value: '4+', labelKey: 'development' }
  ]

  const connectLinks = [
    {
      icon: MessageCircle,
      label: 'Facebook',
      href: 'https://www.facebook.com/share/1GLkjvnj6T/?mibextid=wwXIfr',
      external: true
    },
    { icon: Mail, label: 'Email', href: 'mailto:carwise15@gmail.com', external: false },
    { icon: Phone, label: 'Phone', href: 'tel:+9647774472106', external: false },
    { icon: Globe, label: 'Website', href: 'https://carwiseiq.com', external: true }
  ]

  return (
    <div className="min-h-[calc(100vh-200px)] py-8 px-4 sm:px-6 lg:px-8 bg-transparent" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto bg-transparent">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden border border-slate-300 dark:border-white/10 bg-gradient-to-br from-[#8B5CF6]/20 via-slate-900/95 to-slate-900 p-8 sm:p-12 mb-8"
        >
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center"
            style={{ backgroundImage: "url('/carwiseiq-logo.jpg')" }}
            aria-hidden
          />
          <div className="relative z-10 text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-3">
              {t('title')}
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300">
              {t('subtitle')}
            </p>
          </div>
        </motion.section>

        {/* Founder */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-6 sm:p-8 mb-8"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('founderTitle')}</h2>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
              <User className="w-10 h-10 text-[#8B5CF6]" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{t('founderName')}</p>
              <p className="text-[#8B5CF6] font-medium">{t('founderRole')}</p>
              <p className="text-slate-600 dark:text-slate-300 text-sm">{t('founderStatus')}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{t('founderLocation')}</p>
            </div>
          </div>
        </motion.section>

        {/* Story */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-6 sm:p-8 mb-8"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('storyTitle')}</h2>
          <p className="text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {t('storyText')}
          </p>
        </motion.section>

        {/* Tech Stack */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-6 sm:p-8 mb-8"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('techTitle')}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {techItems.map(({ icon: Icon, labelKey, valueKey }, i) => (
              <li
                key={labelKey}
                className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
              >
                <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{t(labelKey)}</p>
                  <p className="text-slate-600 dark:text-slate-300 text-sm">{t(valueKey)}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Platform Stats */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-6 sm:p-8 mb-8"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#8B5CF6]" />
            {t('statsTitle')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats.map(({ value, labelKey }) => (
              <div
                key={labelKey}
                className="text-center p-4 rounded-lg bg-gradient-to-b from-[#8B5CF6]/10 to-transparent border border-[#8B5CF6]/20"
              >
                <p className="text-2xl font-bold text-[#8B5CF6]">{value}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t(labelKey)}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Future Vision */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm p-6 sm:p-8 mb-8"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-[#8B5CF6]" />
            {t('visionTitle')}
          </h2>
          <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('visionText')}</p>
        </motion.section>

        {/* Connect */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-gradient-to-br from-[#8B5CF6]/10 to-transparent p-6 sm:p-8"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('connectTitle')}</h2>
          <div className="flex flex-wrap gap-4">
            {connectLinks.map(({ icon: Icon, label, href, external }) => (
              <Link
                key={label}
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-[#8B5CF6]/30 bg-white/50 dark:bg-white/5 hover:bg-[#8B5CF6]/20 hover:border-[#8B5CF6]/50 transition-all duration-300 text-slate-700 dark:text-slate-200"
              >
                <Icon className="w-5 h-5 text-[#8B5CF6]" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
