"use client"
import { useState } from 'react'
import { useTranslations, useLocale, useMessages } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, FileText, Plus, X } from 'lucide-react'
import { LEGAL_CONTACT } from '@/lib/legalContact'

function safeT(t: ReturnType<typeof useTranslations<'terms'>>, key: string): string | undefined {
  try {
    const v = t(key as any)
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

function getItems(
  t: ReturnType<typeof useTranslations<'terms'>>,
  oldKey: string,
  rawItems?: unknown
): string[] {
  if (Array.isArray(rawItems) && rawItems.length > 0 && rawItems.every((x) => typeof x === 'string')) {
    return rawItems as string[]
  }
  if (typeof rawItems === 'string' && rawItems.trim()) {
    return rawItems.split('|').map((s) => s.trim()).filter(Boolean)
  }
  const oldVal = safeT(t, oldKey)
  if (oldVal) return oldVal.split('|').map((s) => s.trim()).filter(Boolean)
   return []
}

type FaqQa = { question: string; answer: string }

/** Build FAQ entries from sections.faq.questions: objects {question, answer} or strings paired with terms.faq.qN.answer */
function normalizeTermsSectionFaq(
  sections: Record<string, unknown> | undefined,
  t: ReturnType<typeof useTranslations<'terms'>>
): FaqQa[] {
  const faqBlock = sections?.faq as { questions?: unknown } | undefined
  const raw = faqBlock?.questions
  if (!Array.isArray(raw) || raw.length === 0) return []

  const first = raw[0]
  if (
    first &&
    typeof first === 'object' &&
    typeof (first as { question?: unknown }).question === 'string' &&
    typeof (first as { answer?: unknown }).answer === 'string'
  ) {
    return (raw as { question: string; answer: string }[]).filter(
      (x) => typeof x.question === 'string' && typeof x.answer === 'string'
    )
  }

  if (raw.every((x) => typeof x === 'string')) {
    return (raw as string[]).map((question, i) => {
      const qKey = `q${i + 1}`
      const answer = safeT(t, `faq.${qKey}.answer`) ?? ''
      return { question, answer }
    })
  }

  return []
}

export default function TermsPage() {
  const t = useTranslations('terms')
  const locale = useLocale()
  const messages = useMessages() as { terms?: { sections?: Record<string, unknown> } } | null
  const sections = messages?.terms?.sections as Record<string, { items?: unknown; requirements?: { items?: unknown }; prohibited?: { items?: unknown }; weDoNot?: { items?: unknown }; userResponsibility?: { items?: unknown }; vehicleRelated?: { items?: unknown }; transactionRelated?: { items?: unknown }; platformRelated?: { items?: unknown }; questions?: unknown }> | undefined
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const lastUpdated = new Date().toLocaleDateString(locale === 'ar' ? 'ar-IQ' : locale === 'ku' ? 'ku' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index))
  }

  const companyName = safeT(t, 'company') ?? safeT(t, 'companyName') ?? 'CarWiseIQ'
  const companyLocation = safeT(t, 'subtitle') ?? safeT(t, 'companyLocation') ?? ''

  const faqFromSections = normalizeTermsSectionFaq(sections, t)
  const useSectionFaq = faqFromSections.length > 0
  const faqItems = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14']

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
                <p className="font-semibold mb-1">{companyName}</p>
                <p className="text-slate-600 dark:text-slate-400">{companyLocation}</p>
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

          {/* Section 2: Service Description - supports content/items/note (new) or description/services/facilitator (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">2. {t('sections.serviceDescription.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.serviceDescription.content') ?? t('sections.serviceDescription.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.serviceDescription.services', sections?.serviceDescription?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{(safeT(t, 'sections.serviceDescription.note') ?? safeT(t, 'sections.serviceDescription.facilitator'))}</p>
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
              {getItems(t, 'sections.eligibility.items', sections?.eligibility?.items).map((item: string, idx: number) => (
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
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.accountRegistration.content') ?? t('sections.accountRegistration.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.accountRegistration.items', sections?.accountRegistration?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{t('sections.accountRegistration.responsibility')}</p>
          </motion.section>

          {/* Section 5: Car Listings - supports requirements/prohibited/removalNote (new) or description/requirements/prohibitedTitle/prohibited/rights (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">5. {t('sections.carListings.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.carListings.requirements.title') ?? t('sections.carListings.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.carListings.requirements', sections?.carListings?.requirements?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{safeT(t, 'sections.carListings.prohibited.title') ?? t('sections.carListings.prohibitedTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.carListings.prohibited', sections?.carListings?.prohibited?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{(safeT(t, 'sections.carListings.removalNote') ?? safeT(t, 'sections.carListings.rights'))}</p>
          </motion.section>

          {/* Section 6: AI Valuation - supports content/items/note (new) or description/disclaimers/purpose (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">6. {t('sections.aiValuation.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.aiValuation.content') ?? t('sections.aiValuation.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.aiValuation.disclaimers', sections?.aiValuation?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{(safeT(t, 'sections.aiValuation.note') ?? safeT(t, 'sections.aiValuation.purpose'))}</p>
          </motion.section>

          {/* Section 7: Transactions - supports weDoNot/userResponsibility (new) or description/notResponsible/userResponsibility (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">7. {t('sections.transactions.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.transactions.description')}</p>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-semibold">{safeT(t, 'sections.transactions.weDoNot.title') ?? t('sections.transactions.notResponsibleTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.transactions.notResponsible', sections?.transactions?.weDoNot?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{safeT(t, 'sections.transactions.userResponsibility.title') ?? t('sections.transactions.userResponsibilityTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.transactions.userResponsibility', sections?.transactions?.userResponsibility?.items).map((item: string, idx: number) => (
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
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.userConduct.content') ?? t('sections.userConduct.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.userConduct.prohibited', sections?.userConduct?.items).map((item: string, idx: number) => (
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
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.contentOwnership.content') ?? t('sections.contentOwnership.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.contentOwnership.license', sections?.contentOwnership?.items).map((item: string, idx: number) => (
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
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.intellectualProperty.content') ?? t('sections.intellectualProperty.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.intellectualProperty.prohibited', sections?.intellectualProperty?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 11: Liability - supports vehicleRelated/transactionRelated/platformRelated/disclaimer (new) or vehicle/transaction/platform/warranty (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">11. {t('sections.liability.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-semibold">{t('sections.liability.important')}</p>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.liability.description')}</p>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4 font-semibold">{safeT(t, 'sections.liability.vehicleRelated.title') ?? t('sections.liability.vehicleTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.liability.vehicle', sections?.liability?.vehicleRelated?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{safeT(t, 'sections.liability.transactionRelated.title') ?? t('sections.liability.transactionTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.liability.transaction', sections?.liability?.transactionRelated?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{safeT(t, 'sections.liability.platformRelated.title') ?? t('sections.liability.platformTitle')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.liability.platform', sections?.liability?.platformRelated?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4 font-semibold">{(safeT(t, 'sections.liability.disclaimer') ?? safeT(t, 'sections.liability.warranty'))}</p>
          </motion.section>

          {/* Section 12: Limitation of Liability - key may be limitationOfLiability (new) or limitationLiability (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">12. {(safeT(t, 'sections.limitationOfLiability.title') ?? safeT(t, 'sections.limitationLiability.title'))}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{(safeT(t, 'sections.limitationOfLiability.description') ?? safeT(t, 'sections.limitationLiability.description'))}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.limitationLiability.items', sections?.limitationOfLiability?.items ?? sections?.limitationLiability?.items).map((item: string, idx: number) => (
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
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.indemnification.content') ?? t('sections.indemnification.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.indemnification.items', sections?.indemnification?.items).map((item: string, idx: number) => (
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
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.disputeResolution.content') ?? t('sections.disputeResolution.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.disputeResolution.items', sections?.disputeResolution?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </motion.section>

          {/* Section 15: Platform Changes - supports content/items/note (new) or description/rights/acceptance (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">15. {t('sections.platformChanges.title')}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-4">{safeT(t, 'sections.platformChanges.content') ?? t('sections.platformChanges.description')}</p>
            <ul className="list-disc list-inside text-slate-700 dark:text-gray-300 space-y-2 ml-4">
              {getItems(t, 'sections.platformChanges.rights', sections?.platformChanges?.items).map((item: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mt-4">{(safeT(t, 'sections.platformChanges.note') ?? safeT(t, 'sections.platformChanges.acceptance'))}</p>
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

          {/* FAQ Section - supports sections.faq.questions (array) or faq.q1..q14 (with answers) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.8 }}
            className="space-y-4 border-t border-slate-300 dark:border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">19. {(safeT(t, 'sections.faq.title') ?? safeT(t, 'faq.title'))}</h2>
            <div className="space-y-3">
              {(useSectionFaq ? faqFromSections : faqItems.map((qKey) => ({ qKey }))).map((entry, index) => {
                const question =
                  'qKey' in entry ? t(`faq.${entry.qKey}.question`) : entry.question
                const answer =
                  'qKey' in entry ? t(`faq.${entry.qKey}.answer`) : entry.answer
                const key = 'qKey' in entry ? entry.qKey : `faq-${index}`
                const isOpen = openFaq === index
                return (
                  <motion.div
                    key={key}
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
                        {isOpen ? <X className="h-5 w-5 text-[#8B5CF6]" /> : <Plus className="h-5 w-5 text-[#8B5CF6]" />}
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
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

          {/* Contact Section - supports sections.contact (new) or contactUs + contactPhone/contactEmail (old) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.9 }}
            className="space-y-6 border-t border-white/10 pt-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">20. {(safeT(t, 'sections.contact.title') ?? safeT(t, 'sections.contactUs.title'))}</h2>
            <p className="text-slate-700 dark:text-gray-300 leading-relaxed mb-6">{(safeT(t, 'sections.contact.content') ?? safeT(t, 'sections.contactUs.description'))}</p>

            <div
              dir="ltr"
              className="bg-gradient-to-r from-[#8B5CF6]/10 to-purple-500/10 border border-[#8B5CF6]/20 rounded-2xl p-6 md:p-8 text-left"
            >
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
                    <Phone className="h-6 w-6 text-[#8B5CF6]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-1" dir="auto">
                      {(safeT(t, 'sections.contact.phone') ?? safeT(t, 'sections.contactUs.phoneLabel')) ?? 'Phone'}
                    </p>
                    <a
                      href={LEGAL_CONTACT.phoneTelHref}
                      dir="ltr"
                      className="block text-xl md:text-2xl font-bold tabular-nums tracking-normal text-slate-900 dark:text-white hover:text-[#8B5CF6] transition-colors text-left"
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
                      {(safeT(t, 'sections.contact.email') ?? safeT(t, 'sections.contactUs.emailLabel')) ?? 'Email'}
                    </p>
                    <a
                      href={LEGAL_CONTACT.emailMailto}
                      dir="ltr"
                      className="block text-left text-xl md:text-2xl font-bold text-slate-900 dark:text-white hover:text-[#8B5CF6] transition-colors break-all"
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
