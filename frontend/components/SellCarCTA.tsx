'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useAuthContext } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Car, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface SellCarCTAProps {
  /** Render as button (default) or span for use inside custom clickable divs */
  as?: 'button' | 'span'
  className?: string
  /** Button variant when as="button" */
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children?: React.ReactNode
  /** Show Plus icon before children when true */
  showIcon?: boolean
  /** Called before navigate (e.g. close mobile menu) */
  onClick?: () => void
}

/**
 * Sell Car CTA: if not logged in, shows auth prompt modal with Sign In / Create Account.
 * If logged in, navigates to /sell/step1 via Next.js Link.
 */
export function SellCarCTA({
  as = 'button',
  className,
  variant = 'default',
  size,
  children,
  showIcon = true,
  onClick,
}: SellCarCTAProps) {
  const router = useRouter()
  const locale = useLocale() || 'en'
  const t = useTranslations('auth')
  const { user } = useAuthContext()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)

  const sellCarPath = `/${locale}/sell/step1`
  const loginPath = `/${locale}/login?returnUrl=${encodeURIComponent(sellCarPath)}`
  const registerPath = `/${locale}/register?reason=sell&returnUrl=${encodeURIComponent(sellCarPath)}`

  const handleClick = () => {
    onClick?.()
    if (!user) {
      setAuthPromptOpen(true)
      return
    }
    router.push(sellCarPath)
  }

  const content = (
    <>
      {showIcon && (
        <span className="relative inline-flex items-center justify-center">
          <Car className="h-[18px] w-[18px] shrink-0" />
          <Plus className="h-2.5 w-2.5 shrink-0 absolute -top-0.5 -right-0.5 bg-white rounded-full p-0.5 text-indigo-600" strokeWidth={3} />
        </span>
      )}
      {children}
    </>
  )

  // When logged in: use Link for client-side navigation to /sell/step1
  const linkOrAction = user ? (
    <Link
      href={sellCarPath}
      className={cn(as === 'span' ? 'inline-flex items-center gap-2 cursor-pointer' : '', className)}
      onClick={() => onClick?.()}
    >
      {content}
    </Link>
  ) : as === 'span' ? (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={cn('inline-flex items-center gap-2 cursor-pointer', className)}
    >
      {content}
    </span>
  ) : (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleClick}>
      {content}
    </Button>
  )

  const goToLogin = () => {
    setAuthPromptOpen(false)
    router.push(loginPath)
  }

  const goToRegister = () => {
    setAuthPromptOpen(false)
    router.push(registerPath)
  }

  const authPromptModal = (
    <Dialog open={authPromptOpen} onOpenChange={setAuthPromptOpen}>
      <DialogContent className="sm:max-w-md border-[#2a2d3a] bg-slate-900/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            {t('sellCarAuthRequiredTitle')}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t('sellCarAuthRequired')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            onClick={goToLogin}
          >
            {t('signIn')}
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={goToRegister}
          >
            {t('createAccount')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      {linkOrAction}
      {authPromptModal}
    </>
  )
}
