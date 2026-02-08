"use client"

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, ChevronDown, FileText, Plus, X } from 'lucide-react'

export default function TermsPage() {
  const t = useTranslations('terms')
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

  const faqItems = [
    'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14'
  ]

  return (
    <div className="min-h-[calc(100vh-200px)] py-8 px-4 sm:px-6 lg:px-8 bg-transparent">
      <div className="max-w-4xl mx-auto bg-transparent">
        {/* Header Section */}
        <div className="mb-8 pb-6 border-b border-slate-300 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3 text-slate-900 dark:text-white">
                <FileText className="h-8 w-8 text-[#8B5CF6]" />
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
          {/* Section 1: Acceptance of Terms */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">1. {t('sections.acceptance.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.acceptance.content')}</p>
          </motion.section>

          {/* Section 2: Service Description */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">2. {t('sections.serviceDescription.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.serviceDescription.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.serviceDescription.services').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.serviceDescription.facilitator')}</p>
          </motion.section>

          {/* Section 3: Eligibility */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">3. {t('sections.eligibility.title')}</h2>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.eligibility.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 4: Account Registration */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">4. {t('sections.accountRegistration.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.accountRegistration.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.accountRegistration.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.accountRegistration.responsibility')}</p>
          </motion.section>

          {/* Section 5: Car Listings */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">5. {t('sections.carListings.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.carListings.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.carListings.requirements').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{t('sections.carListings.prohibitedTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.carListings.prohibited').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.carListings.rights')}</p>
          </motion.section>

          {/* Section 6: AI Valuation Service */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">6. {t('sections.aiValuation.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.aiValuation.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.aiValuation.disclaimers').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.aiValuation.purpose')}</p>
          </motion.section>

          {/* Section 7: Transactions and Payments */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">7. {t('sections.transactions.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.transactions.description')}</p>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-semibold">{t('sections.transactions.notResponsibleTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.transactions.notResponsible').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{t('sections.transactions.userResponsibilityTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.transactions.userResponsibility').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 8: User Conduct */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">8. {t('sections.userConduct.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.userConduct.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.userConduct.prohibited').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.userConduct.consequence')}</p>
          </motion.section>

          {/* Section 9: Content Ownership */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">9. {t('sections.contentOwnership.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.contentOwnership.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.contentOwnership.license').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.contentOwnership.responsibility')}</p>
          </motion.section>

          {/* Section 10: Intellectual Property */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">10. {t('sections.intellectualProperty.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.intellectualProperty.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.intellectualProperty.prohibited').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 11: Liability and Disclaimers */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">11. {t('sections.liability.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-semibold">{t('sections.liability.important')}</p>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.liability.description')}</p>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-semibold">{t('sections.liability.vehicleTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.liability.vehicle').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{t('sections.liability.transactionTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.liability.transaction').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{t('sections.liability.platformTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.liability.platform').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{t('sections.liability.warranty')}</p>
          </motion.section>

          {/* Section 12: Limitation of Liability */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">12. {t('sections.limitationLiability.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.limitationLiability.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.limitationLiability.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 13: Indemnification */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">13. {t('sections.indemnification.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.indemnification.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.indemnification.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 14: Dispute Resolution */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.3 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">14. {t('sections.disputeResolution.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.disputeResolution.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.disputeResolution.items').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 15: Platform Changes */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">15. {t('sections.platformChanges.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{t('sections.platformChanges.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {t('sections.platformChanges.rights').split('|').map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.platformChanges.acceptance')}</p>
          </motion.section>

          {/* Section 16: Privacy */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">16. {t('sections.privacy.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.privacy.content')}</p>
          </motion.section>

          {/* Section 17: Severability */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">17. {t('sections.severability.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.severability.content')}</p>
          </motion.section>

          {/* Section 18: Entire Agreement */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.7 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">18. {t('sections.entireAgreement.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{t('sections.entireAgreement.content')}</p>
          </motion.section>

          {/* FAQ Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.8 }}
            className="space-y-4 border-t border-slate-300 dark:border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">19. {t('faq.title')}</h2>
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
                        {isOpen ? (
                          <X className="h-5 w-5 text-[#8B5CF6]" />
                        ) : (
                          <Plus className="h-5 w-5 text-[#8B5CF6]" />
                        )}
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
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
            transition={{ duration: 0.6, delay: 1.9 }}
            className="space-y-6 border-t border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">20. {t('sections.contactUs.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-6">{t('sections.contactUs.description')}</p>

            <div className="bg-gradient-to-r from-[#8B5CF6]/10 to-purple-500/10 border border-[#8B5CF6]/20 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
                    <Phone className="h-6 w-6 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">{t('sections.contactUs.phoneLabel')}</p>
                    <a
                      href="tel:+9647774472106"
                      className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white hover:text-[#8B5CF6] transition-colors"
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
                      className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white hover:text-[#8B5CF6] transition-colors break-all"
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
