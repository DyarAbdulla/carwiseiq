"use client"
import { useState } from 'react'
import { useTranslations, useLocale, useMessages } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, ChevronDown, Shield } from 'lucide-react'
import { LEGAL_CONTACT } from '@/lib/legalContact'

function safeT(t: ReturnType<typeof useTranslations<'privacy'>>, key: string): string | undefined {
  try {
    const v = t(key as any)
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

function getSectionItems(
  t: ReturnType<typeof useTranslations<'privacy'>>,
  newKey: string,
  oldKey: string,
  rawItems?: unknown
): string[] {
  if (Array.isArray(rawItems) && rawItems.length > 0 && rawItems.every((x) => typeof x === 'string')) {
    return rawItems as string[]
  }
  const collected: string[] = []
  for (let i = 0; i < 32; i++) {
    const v = safeT(t, `${newKey}.${i}`)
    if (v === undefined) break
    collected.push(v)
  }
  if (collected.length > 0) return collected
  const oldVal = safeT(t, oldKey)
  if (oldVal) return oldVal.split('|').map((s) => s.trim()).filter(Boolean)
  return []
}

function getSectionTitle(t: ReturnType<typeof useTranslations<'privacy'>>, newKey: string, oldKey: string): string {
  return safeT(t, newKey) ?? safeT(t, oldKey) ?? ''
}

function getSectionContent(t: ReturnType<typeof useTranslations<'privacy'>>, newKey: string, oldKey: string): string {
  return safeT(t, `${newKey}.content`) ?? safeT(t, `${newKey}.description`) ?? safeT(t, `${oldKey}.description`) ?? safeT(t, `${oldKey}.content`) ?? ''
}

function getSectionHeading(
  t: ReturnType<typeof useTranslations<'privacy'>>,
  numKey: string,
  titleKey: string,
  fallbackTitleKey: string
): string {
  const num = safeT(t, numKey)
  const title = getSectionTitle(t, titleKey, fallbackTitleKey)
  return num ? `${num} ${title}` : title
}

export default function PrivacyPage() {
  const t = useTranslations('privacy')
  const locale = useLocale()
  const messages = useMessages() as { privacy?: { sections?: Record<string, { items?: unknown; questions?: unknown }> } } | null
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const sections = messages?.privacy?.sections

  const lastUpdated = new Date().toLocaleDateString(locale === 'ar' ? 'ar-IQ' : locale === 'ku' ? 'ku' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index))
  }

  const companyName = safeT(t, 'company') ?? safeT(t, 'companyName') ?? 'CarWiseIQ'
  const companyLocation = safeT(t, 'country') ?? safeT(t, 'companyLocation') ?? ''

  type FaqItem = { question: string; answer: string }
  const faqWithAnswers: FaqItem[] = Array.isArray(sections?.faq?.questions)
    ? (sections.faq.questions as FaqItem[]).filter((x) => x && typeof x.question === 'string' && typeof x.answer === 'string')
    : []
  const faqQuestions: string[] = Array.isArray(sections?.faq?.questions) && faqWithAnswers.length === 0
    ? (sections.faq.questions as string[]).filter((x) => typeof x === 'string')
    : []
  const useFaqObjects = faqWithAnswers.length > 0
  const useNewFaq = useFaqObjects || faqQuestions.length > 0
  const faqItems = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10']

  return (
    <div className="min-h-[calc(100vh-200px)] py-8 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-4xl mx-auto bg-transparent">
        {/* Header Section */}
        <div className="mb-8 pb-6 border-b border-slate-300 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3 text-slate-900 dark:text-white">
                <Shield className="h-8 w-8 text-indigo-400" />
                {t('title')}
              </h1>
              <p className="text-slate-500 dark:text-gray-400 text-sm">
                {t('lastUpdated', { date: lastUpdated })}
              </p>
              <div className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                <p className="font-semibold mb-1">{companyName}</p>
                <p className="text-slate-600 dark:text-slate-400">{companyLocation}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Content Section */}
        <div className="prose prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.introduction.number', 'sections.introduction.title', 'sections.introduction.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.introduction.content')}</p>
          </motion.section>

          {/* Information We Collect / dataCollection */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.dataCollection.number', 'sections.dataCollection.title', 'sections.informationWeCollect.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{getSectionContent(t, 'sections.dataCollection', 'sections.informationWeCollect')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getSectionItems(t, 'sections.dataCollection.items', 'sections.informationWeCollect.items', sections?.dataCollection?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* How We Collect */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.howWeCollect.number', 'sections.howWeCollect.title', 'sections.howWeCollect.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{getSectionContent(t, 'sections.howWeCollect', 'sections.howWeCollect')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getSectionItems(t, 'sections.howWeCollect.items', 'sections.howWeCollect.items', sections?.howWeCollect?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* How We Use / howWeUse */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.howWeUse.number', 'sections.howWeUse.title', 'sections.howWeUseInfo.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{getSectionContent(t, 'sections.howWeUse', 'sections.howWeUseInfo')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getSectionItems(t, 'sections.howWeUse.items', 'sections.howWeUseInfo.items', sections?.howWeUse?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Third-Party Services / thirdParty */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.thirdParty.number', 'sections.thirdParty.title', 'sections.thirdPartyServices.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{getSectionContent(t, 'sections.thirdParty', 'sections.thirdPartyServices')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getSectionItems(t, 'sections.thirdParty.items', 'sections.thirdPartyServices.items', sections?.thirdParty?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Information Sharing / sharing */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.sharing.number', 'sections.sharing.title', 'sections.informationSharing.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{getSectionContent(t, 'sections.sharing', 'sections.informationSharing')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getSectionItems(t, 'sections.sharing.items', 'sections.informationSharing.items', sections?.sharing?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Data Security / security */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.security.number', 'sections.security.title', 'sections.dataSecurity.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{getSectionContent(t, 'sections.security', 'sections.dataSecurity')}</p>
            {getSectionItems(t, 'sections.security.items', 'sections.dataSecurity.items', sections?.security?.items).length > 0 && (
              <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4 mt-4">
                {getSectionItems(t, 'sections.security.items', 'sections.dataSecurity.items', sections?.security?.items).map((item: string, idx: number) => (
                  <li key={idx} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            )}
            {(safeT(t, 'sections.security.note') ?? safeT(t, 'sections.dataSecurity.note')) && (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{(safeT(t, 'sections.security.note') ?? safeT(t, 'sections.dataSecurity.note'))}</p>
            )}
          </motion.section>

          {/* Your Rights / rights */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.rights.number', 'sections.rights.title', 'sections.yourRights.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{getSectionContent(t, 'sections.rights', 'sections.yourRights')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getSectionItems(t, 'sections.rights.items', 'sections.yourRights.items', sections?.rights?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            {(safeT(t, 'sections.rights.contact') ?? safeT(t, 'sections.yourRights.footer')) && (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{safeT(t, 'sections.rights.contact') ?? safeT(t, 'sections.yourRights.footer')}</p>
            )}
          </motion.section>

          {/* Data Retention / retention */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.retention.number', 'sections.retention.title', 'sections.dataRetention.title')}</h2>
            {getSectionItems(t, 'sections.retention.items', 'sections.dataRetention.items', sections?.retention?.items).length > 0 ? (
              <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
                {getSectionItems(t, 'sections.retention.items', 'sections.dataRetention.items', sections?.retention?.items).map((item: string, idx: number) => (
                  <li key={idx} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{getSectionContent(t, 'sections.retention', 'sections.dataRetention') || safeT(t, 'sections.dataRetention.content')}</p>
            )}
          </motion.section>

          {/* Cookies */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.cookies.number', 'sections.cookies.title', 'sections.cookies.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{getSectionContent(t, 'sections.cookies', 'sections.cookies') || safeT(t, 'sections.cookies.description')}</p>
            {safeT(t, 'sections.cookies.typesLabel') && (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-medium">{safeT(t, 'sections.cookies.typesLabel')}</p>
            )}
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getSectionItems(t, 'sections.cookies.items', 'sections.cookies.items', sections?.cookies?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            {(safeT(t, 'sections.cookies.note') ?? safeT(t, 'sections.cookies.footer')) && (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{safeT(t, 'sections.cookies.note') ?? safeT(t, 'sections.cookies.footer')}</p>
            )}
          </motion.section>

          {/* Children's Privacy / children */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.children.number', 'sections.children.title', 'sections.childrensPrivacy.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{getSectionContent(t, 'sections.children', 'sections.childrensPrivacy')}</p>
          </motion.section>

          {/* Changes to Policy / changes */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.changes.number', 'sections.changes.title', 'sections.changesToPolicy.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{getSectionContent(t, 'sections.changes', 'sections.changesToPolicy')}</p>
          </motion.section>

          {/* International Transfers / transfers */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.transfers.number', 'sections.transfers.title', 'sections.internationalTransfers.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{getSectionContent(t, 'sections.transfers', 'sections.internationalTransfers')}</p>
          </motion.section>

          {/* Iraqi Law / compliance */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.3 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.compliance.number', 'sections.compliance.title', 'sections.iraqiLaw.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{getSectionContent(t, 'sections.compliance', 'sections.iraqiLaw')}</p>
          </motion.section>

          {/* FAQ Section - supports sections.faq.questions (array) or faq.q1..q10 (with answers) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="space-y-4 border-t border-slate-300 dark:border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{getSectionHeading(t, 'sections.faq.number', 'sections.faq.title', 'faq.title')}</h2>
            <div className="space-y-3">
              {useFaqObjects
                ? faqWithAnswers.map((item, index) => {
                    const isOpen = openFaq === index
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="border border-slate-300 dark:border-white/10 rounded-lg overflow-hidden bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFaq(index)}
                          className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <span className="font-semibold text-slate-900 dark:text-white pe-2">{item.question}</span>
                          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
                            <ChevronDown className="h-5 w-5 text-indigo-400" />
                          </motion.div>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 pt-0 text-slate-700 dark:text-gray-300 leading-relaxed border-t border-slate-300 dark:border-white/10">
                                {item.answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })
                : useNewFaq
                  ? faqQuestions.map((question, index) => {
                    const qKey = `q${index + 1}`
                    const answer = safeT(t, `faq.${qKey}.answer`) ?? ''
                    const isOpen = openFaq === index
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="border border-slate-300 dark:border-white/10 rounded-lg overflow-hidden bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFaq(index)}
                          className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <span className="font-semibold text-slate-900 dark:text-white pe-2">{question}</span>
                          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
                            <ChevronDown className="h-5 w-5 text-indigo-400" />
                          </motion.div>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 pt-0 text-slate-700 dark:text-gray-300 leading-relaxed border-t border-slate-300 dark:border-white/10">
                                {answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })
                  : faqItems.map((qKey, index) => {
                    const question = t(`faq.${qKey}.question`)
                    const answer = t(`faq.${qKey}.answer`)
                    const isOpen = openFaq === index
                    return (
                      <motion.div
                        key={qKey}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="border border-slate-300 dark:border-white/10 rounded-lg overflow-hidden bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFaq(index)}
                          className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <span className="font-semibold text-slate-900 dark:text-white pe-2">{question}</span>
                          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
                            <ChevronDown className="h-5 w-5 text-indigo-400" />
                          </motion.div>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 pt-0 text-slate-700 dark:text-gray-300 leading-relaxed border-t border-slate-300 dark:border-white/10">
                                {answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
            </div>
          </motion.section>

          {/* Contact Section - supports sections.contact (new) or contactUs + contactPhone/contactEmail (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className="space-y-6 border-t border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{getSectionHeading(t, 'sections.contact.number', 'sections.contact.title', 'sections.contactUs.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-6">{safeT(t, 'sections.contact.content') ?? safeT(t, 'sections.contactUs.description') ?? ''}</p>

            <div
              dir="ltr"
              className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 md:p-8 text-left"
            >
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Phone className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-1" dir="auto">
                      {safeT(t, 'sections.contact.phone') ?? safeT(t, 'sections.contactUs.phoneLabel') ?? 'Phone'}
                    </p>
                    <a
                      href={LEGAL_CONTACT.phoneTelHref}
                      dir="ltr"
                      className="block text-left text-xl md:text-2xl font-bold tabular-nums tracking-normal text-slate-900 dark:text-white hover:text-indigo-400 transition-colors"
                    >
                      {LEGAL_CONTACT.phoneDisplay}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Mail className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-1" dir="auto">
                      {safeT(t, 'sections.contact.email') ?? safeT(t, 'sections.contactUs.emailLabel') ?? 'Email'}
                    </p>
                    <a
                      href={LEGAL_CONTACT.emailMailto}
                      dir="ltr"
                      className="block text-left text-xl md:text-2xl font-bold text-slate-900 dark:text-white hover:text-purple-400 transition-colors break-all"
                    >
                      {LEGAL_CONTACT.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}
