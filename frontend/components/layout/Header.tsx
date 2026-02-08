"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Car, Menu, X, User, LogOut, Sun, Moon, LayoutDashboard, List, ChevronDown, UserCircle, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { LanguageSelector } from '@/components/LanguageSelector'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useAuthContext } from '@/context/AuthContext'
import { SellCarCTA } from '@/components/SellCarCTA'
import { AuthModal } from '@/components/auth/AuthModal'
import { Badge } from '@/components/ui/badge'
import { tKey } from '@/lib/i18n-dev'
import { useTheme } from '@/context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'

const navItems = [
  { href: '/', labelKey: 'nav.home', icon: Car },
  { href: '/predict', labelKey: 'nav.predict' },
  { href: '/services', labelKey: 'nav.services', icon: Sparkles },
  { href: '/buy-sell', labelKey: 'nav.buySell' },
  { href: '/favorites', labelKey: 'nav.favorites' },
  { href: '/batch', labelKey: 'nav.batch' },
  { href: '/compare', labelKey: 'nav.compare' },
  { href: '/history', labelKey: 'nav.history' },
]

export function Header() {
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalDefaultTab, setAuthModalDefaultTab] = useState<'signin' | 'register'>('signin')
  const [menuPortalReady, setMenuPortalReady] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  const t = useTranslations()
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const pathname = usePathname() || ''
  const locale = useLocale() || 'en'
  const isRTL = locale === 'ar' || locale === 'ku'
  const router = useRouter()
  const toastHook = useToast()
  const toast = toastHook || { toast: () => { } }
  const { theme, setTheme } = useTheme()

  const { user, signOut, isAdmin } = useAuthContext()
  const isAuthenticated = !!user

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => { if (mobileMenuOpen) setMenuPortalReady(true) }, [mobileMenuOpen])

  // When mobile menu opens: lock body scroll and compensate scrollbar to avoid viewport width shift
  useEffect(() => {
    if (!mobileMenuOpen) return
    const sb = typeof window !== 'undefined' ? window.innerWidth - document.documentElement.clientWidth : 0
    const prevOverflow = document.body.style.overflow
    const prevPadding = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${sb}px`
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPadding
    }
  }, [mobileMenuOpen])

  // Auto-hide navbar on scroll down, show on scroll up (mobile/tablet only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastScrollY && y > 80) setHeaderVisible(false)
      else setHeaderVisible(true)
      setLastScrollY(y)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [lastScrollY])

  const basePathname = pathname ? pathname.replace(new RegExp(`^/${locale}`), '') || '/' : '/'

  // isActive: exact match for home; for others match exact or nested (e.g. /buy-sell/123)
  const isActiveNav = (href: string) =>
    href === '/' ? (basePathname === '/' || basePathname === '') : (basePathname === href || basePathname.startsWith(href + '/'))

  const handleNavClick = (_href: string) => { }

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full glass-header supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/80">
        <div className="flex h-16 min-h-[44px] items-center justify-between px-4 md:px-6">
          <div className="h-6 w-6 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
        </div>
      </header>
    )
  }

  const openAuth = (tab: 'signin' | 'register') => {
    setAuthModalDefaultTab(tab)
    setAuthModalOpen(true)
    setMobileMenuOpen(false)
  }

  const handleLogoutClick = async () => {
    try {
      await signOut()
      toast?.toast?.({ title: tCommon?.('success') || 'Success', description: tAuth?.('logoutSuccess') || 'Logged out successfully' })
      router.push(`/${locale}`)
      router.refresh()
    } catch {
      toast?.toast?.({ title: tCommon?.('error') || 'Error', description: tAuth?.('logoutError') || 'Failed to logout', variant: 'destructive' })
    }
  }


  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-slate-200 dark:border-white/10 backdrop-blur-xl bg-white/80 dark:bg-slate-950/85 transition-transform duration-300 ease-out lg:transition-none",
        "lg:translate-y-0",
        !headerVisible && "max-lg:-translate-y-full"
      )}
    >
      <div className="flex h-16 min-h-[44px] items-center justify-between gap-4 px-4 sm:px-6 max-w-[1800px] mx-auto">
        {/* Logo (left on mobile); center empty on mobile */}
        <Link href={`/${locale || 'en'}`} className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/5">
            <Image
              src="/carwiseiq-logo.jpg"
              alt="CarWiseIQ Logo"
              width={36}
              height={36}
              className="object-cover"
              priority
            />
          </div>
          <span className="font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent hidden sm:inline truncate">
            {tCommon('appNameShort')}
          </span>
        </Link>

        {/* Desktop nav (hidden on mobile) */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center min-w-0 max-w-2xl mx-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              onClick={() => handleNavClick(item.href)}
              className={cn(
                "min-h-[44px] flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 shrink-0 group",
                isActiveNav(item.href)
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/10"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5"
              )}
            >
              {'icon' in item && item.icon && (
                <item.icon className={cn(
                  "w-4 h-4 shrink-0",
                  isActiveNav(item.href)
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-indigo-400 dark:text-indigo-500",
                  // Special animation for Services (Sparkles icon)
                  item.href === '/services' && "group-hover:animate-spin-slow"
                )} />
              )}
              {tKey(t, item.labelKey)}
            </Link>
          ))}
        </nav>

        {/* Desktop: Theme, Language, Sell Car, Account (dropdown). */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2.5">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              aria-label={theme === 'dark' ? tCommon('themeLight') : tCommon('themeDark')}
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <div className="shrink-0">
              <LanguageSelector variant="dropdown" />
            </div>
            <SellCarCTA
              className="inline-flex items-center gap-2.5 h-11 min-h-[44px] shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-5 font-semibold shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-600/30"
              showIcon
            >
              {t('nav.sell')}
            </SellCarCTA>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-11 min-h-[44px] w-11 shrink-0 rounded-lg p-0 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-200',
                    isAuthenticated && isAdmin && 'border-amber-500/30'
                  )}
                >
                  <UserCircle className="h-[18px] w-[18px] shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-72 rounded-xl border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl">
                {!isAuthenticated ? (
                  <>
                    <DropdownMenuItem onClick={() => openAuth('signin')} className="cursor-pointer text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white py-3 px-4">
                      {tAuth('signIn')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAuth('register')} className="cursor-pointer text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white py-3 px-4">
                      {tAuth('register')}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10">
                      <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium mb-1.5 uppercase tracking-wider">{tAuth('user')}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{user?.email || tAuth('user')}</p>
                      {isAdmin && <Badge variant="warning" className="mt-2 shrink-0 text-[10px]">ADMIN</Badge>}
                    </div>
                    <div className="py-2">
                      {isAdmin && (
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/${locale}/admin/dashboard`}
                            className="flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white active:bg-slate-100 dark:active:bg-white/10 active:text-slate-900 dark:active:text-white cursor-pointer py-2.5 px-4 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <LayoutDashboard className="h-4 w-4 shrink-0" />
                            {t('nav.adminDashboard')}
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/${locale}/my-listings`}
                          className="flex items-center gap-3 text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white active:bg-white/10 active:text-white cursor-pointer py-2.5 px-4 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <List className="h-4 w-4 shrink-0" />
                          {t('nav.myListings')}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/${locale}/profile`}
                          className="flex items-center gap-3 text-slate-200 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white active:bg-white/10 active:text-white cursor-pointer py-2.5 px-4 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <User className="h-4 w-4 shrink-0" />
                          {tAuth('myAccount')}
                        </Link>
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10 my-1" />
                    <DropdownMenuItem onClick={handleLogoutClick} className="cursor-pointer text-red-400 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 py-2.5 px-4">
                      <LogOut className="h-4 w-4 mr-2 shrink-0" />
                      {tAuth('logout')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile: hamburger only (≥44px) */}
          <div style={{ fontSize: '16px' }} className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-11 min-h-[44px] min-w-[44px] w-11 rounded-input touch-manipulation tap-highlight-transparent"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onTouchStart={(e) => { e.currentTarget.style.fontSize = '16px' }}
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? tCommon('closeMenu') : tCommon('openMenu')}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: right-side drawer (portaled to body + fixed + 100dvh + safe-area; no transform on ancestors) */}
      {menuPortalReady && typeof document !== 'undefined' && createPortal(
        <AnimatePresence onExitComplete={() => setMenuPortalReady(false)}>
          {mobileMenuOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm lg:hidden touch-manipulation tap-highlight-transparent"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden
              />
              <div className={cn("fixed inset-0 z-[101] flex pointer-events-none lg:hidden", isRTL ? 'justify-start' : 'justify-end')}>
                <motion.div
                  initial={{ x: isRTL ? '-100%' : '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: isRTL ? '-100%' : '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className={cn("h-[100dvh] min-h-[100vh] w-[100vw] max-w-[360px] backdrop-blur-xl bg-white/95 dark:bg-slate-950/95 bg-gradient-to-b from-white/98 via-white/95 to-white/98 dark:from-slate-950/98 dark:via-slate-950/95 dark:to-slate-950/98 text-slate-900 dark:text-white shadow-2xl pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] overflow-y-auto overscroll-contain pointer-events-auto touch-manipulation tap-highlight-transparent", isRTL ? 'border-r border-slate-200 dark:border-white/20' : 'border-l border-slate-200 dark:border-white/20')}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* Sticky header: title + close */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 backdrop-blur-xl bg-white/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-white/10">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{t('nav.menu') || 'Menu'}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 min-h-[44px] min-w-[44px] w-11 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 touch-manipulation"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label={tCommon('closeMenu')}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="px-3 py-4 space-y-1">
                    {/* User Profile Summary at Top */}
                    {isAuthenticated && user && (
                      <div className="px-4 py-4 mb-4 backdrop-blur-md bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                            {user.email?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">{user.email || tAuth('user')}</p>
                            {isAdmin && <Badge variant="warning" className="mt-1 shrink-0 text-[10px]">ADMIN</Badge>}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Top: Language + Theme */}
                    <div className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">{tCommon('language')}</span>
                      <LanguageSelector variant="inline" />
                    </div>
                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] w-full text-sm font-medium transition-colors",
                        "hover:bg-slate-100 dark:hover:bg-white/10 active:bg-slate-100 dark:active:bg-white/10 text-slate-700 dark:text-slate-200"
                      )}
                      aria-label={theme === 'dark' ? tCommon('themeLight') : tCommon('themeDark')}
                    >
                      {theme === 'dark' ? <Sun className="h-5 w-5 shrink-0 text-slate-400" /> : <Moon className="h-5 w-5 shrink-0 text-slate-400" />}
                      <span>{theme === 'dark' ? tCommon('themeLight') : tCommon('themeDark')}</span>
                    </button>

                    {/* Auth: Sign In + Register (guest) OR Admin, My Listings, My Account, Settings (logged in) */}
                    {!isAuthenticated ? (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openAuth('signin')}
                          className="flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] w-full text-start text-sm font-medium bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white"
                        >
                          <User className="h-5 w-5 shrink-0" />
                          <span>{tAuth('signIn')}</span>
                        </button>
                        <button
                          onClick={() => openAuth('register')}
                          className="flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] w-full text-start text-sm font-medium border border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          <User className="h-5 w-5 shrink-0" />
                          <span>{tAuth('register')}</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {isAdmin && (
                          <Link
                            href={`/${locale}/admin/dashboard`}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium transition-colors",
                              "hover:bg-white/10 active:bg-white/10",
                              basePathname.startsWith('/admin') ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-200"
                            )}
                          >
                            <LayoutDashboard className="h-5 w-5 shrink-0 text-slate-400" />
                            <span>{t('nav.adminDashboard')}</span>
                            <Badge variant="warning" className="shrink-0 ms-auto">ADMIN</Badge>
                          </Link>
                        )}
                        <Link
                          href={`/${locale}/my-listings`}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium transition-colors",
                            "hover:bg-white/10 active:bg-white/10",
                            basePathname.startsWith('/my-listings') ? "bg-indigo-100 dark:bg-white/15 text-indigo-900 dark:text-white" : "text-slate-700 dark:text-slate-200"
                          )}
                        >
                          <List className="h-5 w-5 shrink-0 text-slate-400" />
                          <span>{t('nav.myListings')}</span>
                        </Link>
                        <Link
                          href={`/${locale}/profile`}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium transition-colors",
                            "hover:bg-white/10 active:bg-white/10",
                            basePathname.startsWith('/profile') ? "bg-indigo-100 dark:bg-white/15 text-indigo-900 dark:text-white" : "text-slate-700 dark:text-slate-200"
                          )}
                        >
                          <User className="h-5 w-5 shrink-0 text-slate-400" />
                          <span>{tAuth('myAccount')}</span>
                        </Link>
                      </>
                    )}

                    {/* Main nav */}
                    <nav className="space-y-1">
                      {navItems.map((item) => (
                        <Link
                          key={item.href}
                          href={`/${locale}${item.href}`}
                          onClick={() => { handleNavClick(item.href); setMobileMenuOpen(false) }}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium transition-colors",
                            "hover:bg-white/10 active:bg-white/10",
                            isActiveNav(item.href) ? "bg-indigo-100 dark:bg-white/15 text-indigo-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {'icon' in item && item.icon && <item.icon className={cn("h-5 w-5 shrink-0", isActiveNav(item.href) ? "text-indigo-600 dark:text-white" : "text-slate-500 dark:text-slate-400")} />}
                          <span>{tKey(t, item.labelKey)}</span>
                        </Link>
                      ))}
                    </nav>

                    {/* Bottom: divider + Logout when authenticated */}
                    {isAuthenticated && (
                      <>
                        <div className="border-t border-slate-200 dark:border-white/10 my-3" role="separator" />
                        <button
                          onClick={() => { handleLogoutClick(); setMobileMenuOpen(false) }}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3 min-h-[48px] w-full text-start text-sm font-medium transition-colors",
                            "hover:bg-white/10 active:bg-white/10 text-slate-200"
                          )}
                        >
                          <LogOut className="h-5 w-5 shrink-0 text-slate-400" />
                          <span>{tAuth('logout')}</span>
                        </button>
                      </>
                    )}

                    {/* Prominent Sell Car Button at Bottom */}
                    <div className="sticky bottom-0 pt-4 pb-4 mt-4 border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
                      <SellCarCTA
                        as="span"
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center justify-center gap-3 rounded-xl px-4 py-4 min-h-[56px] w-full text-base font-semibold transition-all shadow-lg",
                          "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30"
                        )}
                        showIcon
                      >
                        <span>{t('nav.sellCar')}</span>
                      </SellCarCTA>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authModalDefaultTab} />
    </header>
  )
}
