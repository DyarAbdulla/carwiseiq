"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuthContext } from '@/context/AuthContext'

export function VoucherApplyModal({
  open,
  onOpenChange,
  onApplied,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const { user } = useAuthContext()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApply = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      toast({
        title: tCommon('error'),
        description: t('voucherEnterCode'),
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.applyVoucherCode(trimmed)
      const b = (res.benefits || {}) as { daily_comparisons?: number }
      const n = typeof b.daily_comparisons === 'number' ? b.daily_comparisons : 10
      toast({
        title: t('voucherAppliedTitle'),
        description: t('voucherAppliedDesc', { compare: n }),
      })
      setCode('')
      onOpenChange(false)
      onApplied?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('voucherApplyFailed')
      toast({
        title: tCommon('error'),
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-slate-200 dark:border-white/10 dark:bg-[#141722]">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">{t('voucherModalTitle')}</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            {t('voucherModalDesc')}
          </DialogDescription>
        </DialogHeader>
        {!user ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('voucherSignInPrompt')}</p>
            <Button asChild className="w-full">
              <Link href={`/${locale}/login`}>{t('voucherSignIn')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('voucherPlaceholder')}
              autoComplete="off"
              className="border-slate-200 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleApply()
              }}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="button" onClick={() => void handleApply()} disabled={loading}>
                {loading ? tCommon('loading') : t('voucherApply')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
