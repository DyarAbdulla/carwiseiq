"use client"

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Lightbulb, Download, Shield, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

export function SmartTips() {
  const t = useTranslations('smartTips')
  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <CardTitle className="flex items-center gap-2 text-white mb-6 text-xl">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Lightbulb className="h-5 w-5 text-yellow-400" />
          </motion.div>
          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            {t('title')}
          </span>
        </CardTitle>
      </motion.div>

      <CardContent className="space-y-3 p-0">
        {/* General Buying Tip */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-black/40 hover:border-white/30 transition-all duration-300 group">
              <span className="flex items-center gap-3 text-sm font-medium text-white">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Shield className="h-5 w-5 text-blue-400" />
                </motion.div>
                {t('buyingTip.title')}
              </span>
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
              </motion.div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg mt-2 space-y-3"
              >
                <p className="font-bold text-sm text-white leading-relaxed">
                  {t('buyingTip.content')}
                </p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-300 flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" />
                    {t('buyingTip.why')}
                  </p>
                  <p className="text-xs text-white/80">{t('buyingTip.reason')}</p>
                  <ul className="list-none space-y-2 text-xs text-white/70">
                    {['point1', 'point2', 'point3', 'point4'].map((key, index) => (
                      <motion.li
                        key={key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{t(`buyingTip.${key}`)}</span>
                      </motion.li>
                    ))}
                  </ul>
                  <p className="text-xs mt-3 text-yellow-300 font-medium">
                    {t('buyingTip.cost')}
                  </p>
                </div>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>

        {/* Market Insights */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-black/40 hover:border-white/30 transition-all duration-300 group">
              <span className="flex items-center gap-3 text-sm font-medium text-white">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: -5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </motion.div>
                {t('marketInsights.title')}
              </span>
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
              </motion.div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg mt-2 space-y-2"
              >
                <p className="text-xs text-white/80">
                  {t('marketInsights.content')}
                </p>
                <p className="text-xs text-white/70 mt-2">
                  {t('marketInsights.tip')}
                </p>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>

        {/* Export & Share Results */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-black/40 hover:border-white/30 transition-all duration-300 group">
              <span className="flex items-center gap-3 text-sm font-medium text-white">
                <motion.div
                  whileHover={{ scale: 1.1, y: -2 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Download className="h-5 w-5 text-purple-400" />
                </motion.div>
                {t('export.title')}
              </span>
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
              </motion.div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg mt-2"
              >
                <p className="text-xs text-white/80">
                  {t('export.content')}
                </p>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      </CardContent>
    </div>
  )
}



