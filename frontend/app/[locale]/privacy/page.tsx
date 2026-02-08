"use client"
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, ChevronDown, Shield } from 'lucide-react'

export default function PrivacyPage() {
  const t = useTranslations('privacy')
  const locale = useLocale()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const lastUpdated = new Date().toLocaleDateString(locale === 'ar' ? 'ar-IQ' : locale === 'ku' ? 'ku' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const renderSection = (key: string, hasItems = false) => {
    const section = t(`sections.${key}`)
    if (!section || typeof section === 'string') return null

    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{section.title}</h2>
        {section.description && (
          <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{section.description}</p>
        )}
        {section.content && (
          <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{section.content}</p>
        )}
        {hasItems && section.items && (
          <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
            {section.items.split('|').map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        )}
        {section.footer && (
          <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{section.footer}</p>
        )}
        {section.typesLabel && (
          <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-medium">{section.typesLabel}</p>
        )}
      </section>
    )
  }

  const faqItems = [
    'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'
  ]

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
                <p className="font-semibold mb-1">{t('companyName')}</p>
                <p className="text-slate-600 dark:text-slate-400">{t('companyLocation')}</p>
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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">1. {t('sections.introduction.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.introduction.content')}</p>
          </motion.section>

          {/* Information We Collect */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">2. {t('sections.informationWeCollect.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.informationWeCollect.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.informationWeCollect.items').split('|').map((item: string, idx: number) => (
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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">3. {t('sections.howWeCollect.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.howWeCollect.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.howWeCollect.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* How We Use */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">4. {t('sections.howWeUseInfo.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.howWeUseInfo.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.howWeUseInfo.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Third-Party Services */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">5. {t('sections.thirdPartyServices.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.thirdPartyServices.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.thirdPartyServices.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Information Sharing */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">6. {t('sections.informationSharing.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.informationSharing.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.informationSharing.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Data Security */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">7. {t('sections.dataSecurity.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.dataSecurity.content')}</p>
          </motion.section>

          {/* Your Rights */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">8. {t('sections.yourRights.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.yourRights.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.yourRights.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            {t('sections.yourRights.footer') && (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.yourRights.footer')}</p>
            )}
          </motion.section>

          {/* Data Retention */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">9. {t('sections.dataRetention.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.dataRetention.content')}</p>
          </motion.section>

          {/* Cookies */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">10. {t('sections.cookies.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.cookies.description')}</p>
            {t('sections.cookies.typesLabel') && (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-medium">{t('sections.cookies.typesLabel')}</p>
            )}
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.cookies.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            {t('sections.cookies.footer') && (
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.cookies.footer')}</p>
            )}
          </motion.section>

          {/* Children's Privacy */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">11. {t('sections.childrensPrivacy.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.childrensPrivacy.content')}</p>
          </motion.section>

          {/* Changes to Policy */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">12. {t('sections.changesToPolicy.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.changesToPolicy.content')}</p>
          </motion.section>

          {/* International Transfers */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">13. {t('sections.internationalTransfers.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.internationalTransfers.content')}</p>
          </motion.section>

          {/* Iraqi Law */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.3 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">14. {t('sections.iraqiLaw.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.iraqiLaw.content')}</p>
          </motion.section>

          {/* FAQ Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="space-y-4 border-t border-slate-300 dark:border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">15. {t('faq.title')}</h2>
            <div className="space-y-3">
              {faqItems.map((qKey, index) => {
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
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white pr-4">{question}</span>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                        className="shrink-0"
                      >
                        <ChevronDown className="h-5 w-5 text-indigo-400" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
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

          {/* Contact Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className="space-y-6 border-t border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">16. {t('sections.contactUs.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-6">{t('sections.contactUs.description')}</p>

            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Phone className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">{t('sections.contactUs.phoneLabel')}</p>
                    <a
                      href="tel:+9647774472106"
                      className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white hover:text-indigo-400 transition-colors"
                    >
                      {t('contactPhone')}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Mail className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">{t('sections.contactUs.emailLabel')}</p>
                    <a
                      href="mailto:carwise15@gmail.com"
                      className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white hover:text-purple-400 transition-colors break-all"
                    >
                      {t('contactEmail')}
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
