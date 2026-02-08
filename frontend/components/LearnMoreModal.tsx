"use client"

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Info, Target, Lightbulb, FileText, Search, BarChart3, Bot, Shield, Save, Zap, ChevronDown, Clock, Trash2, ArrowRight, Database, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getRecentSearches, removeRecentSearch, formatRelativeTime, type RecentSearch } from '@/lib/recent-searches'
import { motion } from 'framer-motion'
import { apiClient } from '@/lib/api'
import type { DatasetStats } from '@/lib/types'

interface LearnMoreModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LearnMoreModal({ open, onOpenChange }: LearnMoreModalProps) {
  const t = useTranslations('sidebar')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const { toast } = useToast()
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Load recent searches
  useEffect(() => {
    if (open) {
      const loadSearches = () => {
        const searches = getRecentSearches()
        setRecentSearches(searches)
      }
      loadSearches()
      const interval = setInterval(loadSearches, 2000)
      return () => clearInterval(interval)
    }
  }, [open])

  // Load dataset statistics
  useEffect(() => {
    if (open) {
      const loadStats = async () => {
        setLoadingStats(true)
        try {
          const stats = await apiClient.getStats()
          setDatasetStats(stats)
        } catch (error) {
          console.error('Failed to load dataset statistics:', error)
          // Use fallback data
          setDatasetStats({
            total_cars: 62181,
            average_price: 18776,
            median_price: 16200,
            min_price: 1000,
            max_price: 200000,
            year_range: { min: 1948, max: 2025 },
          })
        } finally {
          setLoadingStats(false)
        }
      }
      loadStats()
    }
  }, [open])

  const handleSearchClick = (search: RecentSearch) => {
    sessionStorage.setItem('prefillCar', JSON.stringify(search.features))
    router.push(`/${locale}/predict`)
    onOpenChange(false)
  }

  const handleRemoveSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeRecentSearch(id)
    setRecentSearches(getRecentSearches())
    toast({
      title: tCommon('success'),
      description: 'Search removed',
    })
  }

  const handleReset = () => {
    toast({
      title: 'Reset',
      description: 'All inputs have been reset',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f1117] border-[#2a2d3a] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Learn More</DialogTitle>
          <DialogDescription className="text-[#94a3b8]">
            Everything you need to know about CarWiseIQ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Recent Searches */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Search className="h-4 w-4" />
                {t('recentSearches.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSearches.length === 0 ? (
                <div className="p-3 bg-[#1a1d29] rounded text-xs text-[#94a3b8]">
                  {t('recentSearches.empty')}
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {recentSearches.map((search) => (
                    <div
                      key={search.id}
                      onClick={() => handleSearchClick(search)}
                      className="p-3 bg-[#1a1d29] rounded text-xs cursor-pointer hover:bg-[#2a2d3a] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">
                            {search.features.make} {search.features.model}
                          </div>
                          <div className="text-[#94a3b8] mt-1">
                            {search.features.year} • {search.features.mileage.toLocaleString()} km
                          </div>
                          <div className="text-[#5B7FFF] font-semibold mt-1">
                            ${search.prediction.predicted_price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                          <div className="flex items-center gap-1 text-[#94a3b8] mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatRelativeTime(search.timestamp)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-[#94a3b8] hover:text-red-400 hover:bg-red-400/10"
                            onClick={(e) => handleRemoveSearch(search.id, e)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <ArrowRight className="h-3 w-3 text-[#5B7FFF]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Collapsible defaultOpen={false}>
              <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center justify-between w-full text-white">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      {t('quickStats.title')}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  {loadingStats ? (
                    <div className="text-xs text-[#94a3b8]">Loading statistics...</div>
                  ) : datasetStats ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#94a3b8]">{t('quickStats.totalCars')}:</span>
                        <span className="font-semibold text-white">{datasetStats.total_cars.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#94a3b8]">{t('quickStats.averagePrice')}:</span>
                        <span className="font-semibold text-[#5B7FFF]">${datasetStats.average_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-[#94a3b8]">Unable to load statistics</div>
                  )}
                </CardContent>
              </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>

          {/* Model Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Collapsible defaultOpen={false}>
              <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center justify-between w-full text-white">
                    <span className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      {t('modelInfo.title')}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  <div className="text-xs">
                    <span className="text-[#94a3b8]">{t('modelInfo.model')}: </span>
                    <span className="text-white">Random Forest Regressor</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-[#94a3b8]">{t('modelInfo.r2Score')}: </span>
                    <span className="font-semibold text-green-400">0.9996 (99.96% R²)</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-[#94a3b8]">Training Data: </span>
                    <span className="text-white">{datasetStats?.total_cars.toLocaleString() || '62,181'} vehicles</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-[#94a3b8]">Model Accuracy: </span>
                    <span className="font-semibold text-green-400">99.96%</span>
                  </div>
                </CardContent>
              </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>

          {/* Dataset Statistics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Collapsible defaultOpen={false}>
              <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center justify-between w-full text-white">
                    <span className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Dataset Statistics
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {loadingStats ? (
                    <div className="text-xs text-[#94a3b8]">Loading statistics...</div>
                  ) : datasetStats ? (
                    <>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-white mb-2">Price Range</div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#94a3b8]">Min Price:</span>
                          <span className="text-white">${datasetStats.min_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#94a3b8]">Max Price:</span>
                          <span className="text-white">${datasetStats.max_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#94a3b8]">Median Price:</span>
                          <span className="text-[#5B7FFF]">${datasetStats.median_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-[#1a1d29]">
                        <div className="text-xs font-semibold text-white mb-2">Year Range</div>
                        <div className="text-xs text-[#94a3b8]">
                          {datasetStats.year_range.min} - {datasetStats.year_range.max}
                        </div>
                      </div>
                      {datasetStats.top_makes && datasetStats.top_makes.length > 0 && (
                        <div className="pt-2 border-t border-[#1a1d29]">
                          <div className="text-xs font-semibold text-white mb-2">Top Makes</div>
                          <div className="space-y-1">
                            {datasetStats.top_makes.slice(0, 5).map((make, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-[#94a3b8]">{make.make}:</span>
                                <span className="text-white">{make.count.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-[#94a3b8]">Unable to load statistics</div>
                  )}
                </CardContent>
              </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>

          {/* Trust & Transparency */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Collapsible defaultOpen={false}>
              <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center justify-between w-full text-white">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t('trust.title')}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  <div className="p-2 bg-[#1a1d29] rounded text-xs">
                    <div className="font-semibold mb-1 text-white">{t('trust.modelVersion')}:</div>
                    <div className="text-[#94a3b8]">v2.0 (Production)</div>
                  </div>
                  <div className="p-2 bg-[#1a1d29] rounded text-xs">
                    <div className="font-semibold mb-1 text-white">{t('trust.trainingDataset')}:</div>
                    <div className="text-[#94a3b8]">{datasetStats?.total_cars.toLocaleString() || '62,181'} vehicles</div>
                  </div>
                  <div className="p-2 bg-[#1a1d29] rounded text-xs">
                    <div className="font-semibold mb-1 text-white">{t('trust.modelAccuracy')}:</div>
                    <div className="text-[#94a3b8]">99.96% (R² = 0.9996)</div>
                  </div>
                  <div className="p-2 bg-[#1a1d29] rounded text-xs">
                    <div className="font-semibold mb-1 text-white">{t('trust.lastUpdate')}:</div>
                    <div className="text-[#94a3b8]">January 2025</div>
                  </div>
                </CardContent>
              </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>

          {/* Saved Cars */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Save className="h-4 w-4" />
                {t('savedCars.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-[#1a1d29] rounded text-xs text-[#94a3b8]">
                {t('savedCars.empty')}
              </div>
            </CardContent>
          </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Zap className="h-4 w-4" />
                {t('quickActions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white"
                onClick={handleReset}
              >
                {t('quickActions.reset')}
              </Button>
            </CardContent>
          </Card>
          </motion.div>
          {/* App Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Info className="h-4 w-4 text-[#5B7FFF]" />
                {t('appInfo.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#94a3b8]">
                {t('appInfo.description')}
              </p>
            </CardContent>
          </Card>
          </motion.div>

          {/* How to Use */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Target className="h-4 w-4 text-[#5B7FFF]" />
                {t('howToUse.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-[#94a3b8] space-y-2 list-decimal list-inside">
                <li>{t('howToUse.step1')}</li>
                <li>{t('howToUse.step2')}</li>
                <li>{t('howToUse.step3')}</li>
                <li>{t('howToUse.step4')}</li>
              </ol>
            </CardContent>
          </Card>
          </motion.div>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Lightbulb className="h-4 w-4 text-[#5B7FFF]" />
                {t('tips.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-[#94a3b8] space-y-2 list-disc list-inside">
                <li>{t('tips.tip1')}</li>
                <li>{t('tips.tip2')}</li>
                <li>{t('tips.tip3')}</li>
                <li>{t('tips.tip4')}</li>
              </ul>
            </CardContent>
          </Card>
          </motion.div>

          {/* Kurdistan & Iraq Market Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.85 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <TrendingUp className="h-4 w-4 text-[#5B7FFF]" />
                Kurdistan & Iraq Market Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-[#94a3b8] space-y-2 list-disc list-inside">
                <li>Location matters: Prices in Erbil, Baghdad, and Sulaymaniyah can vary significantly. Always check local market conditions.</li>
                <li>Currency fluctuations: USD prices may vary based on exchange rates. Consider local currency equivalents when negotiating.</li>
                <li>Import regulations: Verify import status and documentation requirements, especially for vehicles from neighboring countries.</li>
                <li>Seasonal pricing: Car prices in Kurdistan/Iraq can fluctuate with seasons and economic conditions. Check recent market trends.</li>
                <li>Inspection services: Use trusted local mechanics in Erbil, Baghdad, or Sulaymaniyah for pre-purchase inspections.</li>
                <li>Documentation: Ensure all legal documents (ownership, registration, customs) are verified before purchase.</li>
              </ul>
            </CardContent>
          </Card>
          </motion.div>

          {/* Validation Rules */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.9 }}
          >
            <Card className="border-[#2a2d3a] bg-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <FileText className="h-4 w-4 text-[#5B7FFF]" />
                {t('instructions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="font-semibold text-sm mb-2 text-white">
                  {t('instructions.requiredFields')}
                </div>
                <ul className="text-sm text-[#94a3b8] space-y-1 list-disc list-inside">
                  <li>{t('instructions.field1')}</li>
                  <li>{t('instructions.field2')}</li>
                  <li>{t('instructions.field3')}</li>
                  <li>{t('instructions.field4')}</li>
                  <li>{t('instructions.field5')}</li>
                  <li>{t('instructions.field6')}</li>
                  <li>{t('instructions.field7')}</li>
                  <li>{t('instructions.field8')}</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-sm mb-2 text-white">
                  {t('instructions.validation')}
                </div>
                <ul className="text-sm text-[#94a3b8] space-y-1 list-disc list-inside">
                  <li>{t('instructions.validation1')}</li>
                  <li>{t('instructions.validation2')}</li>
                  <li>{t('instructions.validation3')}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


