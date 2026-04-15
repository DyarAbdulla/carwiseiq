"use client"

import { Button } from '@/components/ui/button'
import { Pencil, CheckCircle2, XCircle } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { defaultLocale } from '@/i18n'
import { useRouter } from 'next/navigation'

interface ManageListingActionsProps {
  listingId: string | number
  isSold: boolean
  onMarkSold: () => void
  onMarkAvailable: () => void
  togglingSold: boolean
  className?: string
}

/**
 * Reusable component for managing listing actions
 * Renders differently on mobile vs desktop to prevent duplication
 */
export function ManageListingActions({
  listingId,
  isSold,
  onMarkSold,
  onMarkAvailable,
  togglingSold,
  className = '',
}: ManageListingActionsProps) {
  const locale = useLocale() || defaultLocale
  const t = useTranslations('listing')
  const router = useRouter()

  const goToEdit = () => {
    const id = encodeURIComponent(String(listingId ?? "").trim())
    if (!id) return
    router.push(`/${locale}/my-listings?edit=${id}`)
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-white mb-4">{t('manageListing') || 'Manage Listing'}</h3>
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full border-white/10 text-gray-300 hover:bg-white/5 backdrop-blur-sm min-h-[44px]"
          onClick={goToEdit}
        >
          <Pencil className="h-4 w-4 mr-2" />
          {t('editListing')}
        </Button>
        {!isSold ? (
          <Button
            variant="destructive"
            onClick={onMarkSold}
            disabled={togglingSold}
            className="w-full backdrop-blur-sm min-h-[44px]"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {t('markAsSold')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={onMarkAvailable}
            disabled={togglingSold}
            className="w-full border-white/10 text-emerald-400 hover:bg-emerald-500/10 backdrop-blur-sm min-h-[44px]"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {t('markAsAvailable')}
          </Button>
        )}
      </div>
    </div>
  )
}
