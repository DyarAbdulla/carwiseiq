"use client"
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  UserCircle,
  Lock,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Smartphone,
  History,
  Monitor,
  Mail,
  Phone,
  MapPin,
  Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { LoadingButton } from '@/components/common/LoadingButton'
import { PasswordStrength } from '@/components/common/PasswordStrength'
import { ProfileAvatarUpload } from '@/components/profile/ProfileAvatarUpload'
import { LtrEmbed } from '@/components/ui/LtrEmbed'
import { apiClient, type VoucherMeResponse } from '@/lib/api'

export default function ProfilePage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuthContext()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    email_verified: false,
    avatar_url: null as string | null
  })

  const avatarInitials = useMemo(() => {
    const n = profile.full_name?.trim() ?? ''
    if (n) {
      const parts = n.split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        const a = parts[0][0] ?? ''
        const b = parts[parts.length - 1][0] ?? ''
        return (a + b).toUpperCase()
      }
      return n.slice(0, 2).toUpperCase()
    }
    const local = profile.email?.split('@')[0] ?? ''
    return (local.slice(0, 2) || 'U').toUpperCase()
  }, [profile.full_name, profile.email])

  type Section = 'profile' | 'security' | 'privacy'
  const [activeSection, setActiveSection] = useState<Section>('profile')

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({ full_name: '', phone: '', location: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [prefsHydrated, setPrefsHydrated] = useState(false)

  const [voucherCode, setVoucherCode] = useState('')
  const [voucherApplying, setVoucherApplying] = useState(false)
  const [voucherInfo, setVoucherInfo] = useState<VoucherMeResponse | null>(null)

  const loadVoucherInfo = useCallback(async () => {
    try {
      setVoucherInfo(await apiClient.getMyVouchers())
    } catch {
      setVoucherInfo(null)
    }
  }, [])

  // Security & Privacy preferences (persisted to public.users.profile_settings)
  const [securityPrefs, setSecurityPrefs] = useState({
    twoFactorEnabled: false,
    twoFactorMethod: 'email' as 'sms' | 'email',
    trustedDevices: [] as { id: string; device: string; browser: string; location: string; lastActive: string }[],
    activeSessions: [] as { id: string; device: string; browser: string; location: string; lastActive: string }[],
    loginHistory: [] as { date: string; time: string; location: string; device: string; ip: string; suspicious?: boolean }[]
  })
  const [privacyPrefs, setPrivacyPrefs] = useState({
    profilePublic: true,
    showPhoneInListings: true,
    showEmailPublicly: false,
    showLocationDetails: true,
    marketingEmails: false,
    smsNotifications: false,
    allowMessagesFromBuyersSellers: true,
    pushNotifications: true,
    analyticsCookies: false,
    marketingCookies: false,
    personalizationCookies: true,
    essentialCookies: true,
    listingsVisibility: 'public' as 'public' | 'registered' | 'private',
    whoCanContact: 'everyone' as 'everyone' | 'verified',
    showActivityStatus: true
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const returnUrl = `/${locale}/profile`
      router.replace(`/${locale}/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      return
    }
    loadProfile()
  }, [user, authLoading, router, locale])

  useEffect(() => {
    if (!user || authLoading) return
    void loadVoucherInfo()
  }, [user, authLoading, loadVoucherInfo])

  // Single background: hide body bg on profile so only the animated gradient shows
  useEffect(() => {
    document.body.classList.add('profile-single-bg')
    return () => document.body.classList.remove('profile-single-bg')
  }, [])

  const loadProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setPrefsHydrated(false)
    try {
      const mockSessions = [
        { id: '1', device: 'Windows', browser: 'Chrome', location: 'Local', lastActive: new Date().toISOString() }
      ]
      const mockHistory = [
        { date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), location: 'Local', device: 'Chrome on Windows', ip: '127.0.0.1', suspicious: false }
      ]

      const { data: row, error: rowError } = await supabase
        .from('users')
        .select('full_name, phone_number, avatar_url, location, profile_settings')
        .eq('id', user.id)
        .maybeSingle()

      if (rowError) {
        console.error('[Profile] users row:', rowError)
      }

      const meta = user.user_metadata || {}
      const full = row?.full_name ?? (meta.full_name as string) ?? (meta.name as string) ?? ''
      const phone = row?.phone_number ?? (meta.phone_number as string) ?? ''
      const loc = row?.location ?? (meta.location as string) ?? ''
      const avatarUrl = row?.avatar_url ?? (meta.avatar_url as string) ?? null

      setProfile({
        full_name: full,
        email: user.email || '',
        phone,
        location: loc,
        email_verified: !!user.email_confirmed_at,
        avatar_url: avatarUrl
      })
      setProfileData({ full_name: full, phone, location: loc })

      const ps = row?.profile_settings as { security?: Partial<typeof securityPrefs>; privacy?: Partial<typeof privacyPrefs> } | null
      setSecurityPrefs((p) => {
        let next = { ...p }
        if (ps?.security && typeof ps.security === 'object') {
          next = { ...next, ...ps.security }
        }
        if (!next.activeSessions?.length) next = { ...next, activeSessions: mockSessions }
        if (!next.loginHistory?.length) next = { ...next, loginHistory: mockHistory }
        return next
      })
      setPrivacyPrefs((p) => (ps?.privacy && typeof ps.privacy === 'object' ? { ...p, ...ps.privacy } : p))
    } catch (error: unknown) {
      toast({ title: tCommon('error'), description: t('failedLoadProfile'), variant: 'destructive' })
    } finally {
      setLoading(false)
      setPrefsHydrated(true)
    }
  }, [user, toast, t, tCommon])

  useEffect(() => {
    if (!user || !prefsHydrated) return
    const t = setTimeout(() => {
      const payload = { security: securityPrefs, privacy: privacyPrefs }
      void supabase
        .from('users')
        .update({ profile_settings: payload as unknown as Json })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('[Profile] persist profile_settings:', error)
        })
    }, 450)
    return () => clearTimeout(t)
  }, [securityPrefs, privacyPrefs, user, prefsHydrated])

  const savePrefs = useCallback((updates: { security?: Partial<typeof securityPrefs>; privacy?: Partial<typeof privacyPrefs> }) => {
    setSecurityPrefs((p) => (updates.security ? { ...p, ...updates.security } : p))
    setPrivacyPrefs((p) => (updates.privacy ? { ...p, ...updates.privacy } : p))
  }, [])

  const handleSaveProfile = async () => {
    if (!user) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name || undefined,
          phone_number: profileData.phone || undefined,
          location: profileData.location || undefined
        }
      })
      if (error) throw error
      const { error: rowErr } = await supabase
        .from('users')
        .update({
          full_name: profileData.full_name || null,
          phone_number: profileData.phone || null,
          location: profileData.location || null,
        })
        .eq('id', user.id)
      if (rowErr) throw rowErr
      toast({ title: t('profileUpdated'), description: t('profileUpdatedDesc') })
      setEditingProfile(false)
      await loadProfile()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('failedUpdateProfile')
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleApplyVoucher = async () => {
    const c = voucherCode.trim()
    if (!c) {
      toast({ title: tCommon('error'), description: t('voucherEnterCode'), variant: 'destructive' })
      return
    }
    setVoucherApplying(true)
    try {
      const res = await apiClient.applyVoucherCode(c)
      const b = (res.benefits || {}) as { daily_comparisons?: number }
      const n = typeof b.daily_comparisons === 'number' ? b.daily_comparisons : 10
      toast({
        title: t('voucherAppliedTitle'),
        description: t('voucherAppliedDesc', { compare: n }),
      })
      setVoucherCode('')
      await loadVoucherInfo()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('voucherApplyFailed')
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    } finally {
      setVoucherApplying(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast({ title: tCommon('error'), description: t('passwordsNoMatch'), variant: 'destructive' })
      return
    }

    setSavingProfile(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new })
      if (error) throw error
      toast({ title: t('passwordChanged'), description: t('passwordChangedDesc') })
      setChangingPassword(false)
      setPasswordData({ current: '', new: '', confirm: '' })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('failedChangePassword')
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleExportData = async () => {
    if (!user) return
    try {
      const meta = user.user_metadata || {}
      const data = {
        email: user.email,
        full_name: meta.full_name || meta.name,
        phone_number: meta.phone_number,
        location: meta.location,
        avatar_url: profile.avatar_url,
        preferences: { security: securityPrefs, privacy: privacyPrefs },
        exported_at: new Date().toISOString()
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-data-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: t('dataExported'), description: t('dataExportedDesc') })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('failedExportData')
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    }
  }

  const handleClearBrowsingHistory = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('carwise_recent_predictions')
        sessionStorage.clear()
        toast({ title: t('historyCleared'), description: t('browsingHistoryCleared') })
      } catch (_) {
        toast({ title: tCommon('error'), description: t('failedClear'), variant: 'destructive' })
      }
    }
  }

  const handleClearSearchHistory = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('carwise_search_history')
        toast({ title: t('historyCleared'), description: t('searchHistoryCleared') })
      } catch (_) {
        toast({ title: tCommon('error'), description: t('failedClear'), variant: 'destructive' })
      }
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirmChecked) {
      toast({ title: tCommon('error'), description: t('confirmPermanent'), variant: 'destructive' })
      return
    }

    setDeleting(true)
    try {
      const { apiClient } = await import('@/lib/api')
      await apiClient.deleteAccount()
      toast({ title: t('accountDeleted'), description: t('accountDeletedDesc') })
      setDeleteDialogOpen(false)
      setDeletePassword('')
      setDeleteConfirmChecked(false)
      router.replace(`/${locale}/login`)
      return
    } catch (_) {
      // REST API may not be used (Supabase-only auth)
    }
    try {
      const { error } = await supabase.auth.signOut()
      if (!error) {
        toast({
          title: t('signedOut'),
          description: t('signedOutDesc') + ' ' + (user?.email ?? ''),
          variant: 'destructive'
        })
      }
    } catch (_) {}
    setDeleting(false)
    setDeleteDialogOpen(false)
    setDeletePassword('')
    setDeleteConfirmChecked(false)
  }

  const handleSignOutSession = (sessionId: string) => {
    setSecurityPrefs((p) => ({ ...p, activeSessions: p.activeSessions.filter((s) => s.id !== sessionId) }))
    toast({ title: t('sessionEnded'), description: t('sessionEndedDesc') })
  }

  const handleSignOutAllOther = () => {
    setSecurityPrefs((p) => ({ ...p, activeSessions: p.activeSessions.slice(0, 1) }))
    toast({ title: t('signedOutAll'), description: t('signedOutAllDesc') })
  }

  const glassPanel =
    'backdrop-blur-xl bg-white/90 dark:bg-white/[0.055] border border-slate-200/90 dark:border-white/[0.08] rounded-2xl shadow-xl shadow-slate-900/[0.06] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)] ring-1 ring-slate-200/50 dark:ring-violet-500/[0.08]'

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-slate-50 dark:bg-[#0f1117]">
        <div className="text-slate-600 dark:text-[#94a3b8]">{tCommon('loading')}</div>
      </div>
    )
  }
  if (!user) {
    return null
  }
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-slate-50 dark:bg-[#0f1117]">
        <div className="text-slate-600 dark:text-[#94a3b8]">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden !bg-transparent !shadow-none !border-none text-slate-900 dark:text-gray-100">
      {/* Single full-viewport background: animated gradient + dots (fixed so body bg is covered) */}
      <div
        className="fixed inset-0 -z-20 bg-profile-gradient bg-[length:400%_400%] animate-gradient-shift profile-page-bg-animate"
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-10 bg-profile-dots bg-[length:28px_28px] pointer-events-none"
        aria-hidden
      />
      {/* 3) Content layer - forced transparent so title floats on page bg */}
      <div className="relative z-0 max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 !bg-transparent !shadow-none !border-none">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">{t('title')}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] !bg-transparent">
          <div className="relative !bg-transparent">
            <div
              className={cn(
                glassPanel,
                'h-fit p-6 md:p-7 lg:sticky lg:top-24'
              )}
            >
              <div className="flex flex-col items-center text-center">
                {user && (
                  <ProfileAvatarUpload
                    userId={user.id}
                    currentAvatarUrl={profile.avatar_url}
                    initials={avatarInitials}
                    onAvatarChange={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                  />
                )}
                <h2 className="mt-5 text-lg font-bold tracking-tight text-slate-900 dark:text-white md:text-xl">
                  {profile.full_name || tAuth('user')}
                </h2>
                <p className="mt-1 max-w-[240px] truncate text-xs text-slate-600 dark:text-slate-400 md:text-sm">
                  <LtrEmbed className="block truncate">{profile.email}</LtrEmbed>
                </p>
                {profile.email_verified && (
                  <Badge className="mt-3 border border-emerald-500/35 bg-emerald-500/15 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {t('verified')}
                  </Badge>
                )}
              </div>

              <div
                className="my-6 h-px w-full bg-gradient-to-r from-transparent via-violet-400/25 to-transparent dark:via-white/10"
                aria-hidden
              />

              <nav
                className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-1.5"
                aria-label={t('title')}
              >
                <button
                  type="button"
                  title={t('profileInfo')}
                  onClick={() => setActiveSection('profile')}
                  className={cn(
                    'flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:justify-start lg:px-4',
                    'touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
                    activeSection === 'profile'
                      ? 'border border-violet-500/40 bg-violet-500/15 text-violet-950 shadow-[0_0_28px_-8px_rgba(139,92,246,0.55)] dark:border-violet-400/35 dark:bg-violet-500/10 dark:text-white'
                      : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-slate-100/90 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  )}
                >
                  <UserCircle
                    className={cn(
                      'h-5 w-5 shrink-0',
                      activeSection === 'profile' ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-500'
                    )}
                  />
                  <span className="hidden min-w-0 truncate sm:inline">{t('profileInfo')}</span>
                </button>
                <button
                  type="button"
                  title={t('security')}
                  onClick={() => setActiveSection('security')}
                  className={cn(
                    'flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:justify-start lg:px-4',
                    'touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
                    activeSection === 'security'
                      ? 'border border-violet-500/40 bg-violet-500/15 text-violet-950 shadow-[0_0_28px_-8px_rgba(139,92,246,0.55)] dark:border-violet-400/35 dark:bg-violet-500/10 dark:text-white'
                      : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-slate-100/90 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  )}
                >
                  <Lock
                    className={cn(
                      'h-5 w-5 shrink-0',
                      activeSection === 'security' ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-500'
                    )}
                  />
                  <span className="hidden min-w-0 truncate sm:inline">{t('security')}</span>
                </button>
                <button
                  type="button"
                  title={t('privacy')}
                  onClick={() => setActiveSection('privacy')}
                  className={cn(
                    'flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:justify-start lg:px-4',
                    'touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
                    activeSection === 'privacy'
                      ? 'border border-violet-500/40 bg-violet-500/15 text-violet-950 shadow-[0_0_28px_-8px_rgba(139,92,246,0.55)] dark:border-violet-400/35 dark:bg-violet-500/10 dark:text-white'
                      : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-slate-100/90 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  )}
                >
                  <Shield
                    className={cn(
                      'h-5 w-5 shrink-0',
                      activeSection === 'privacy' ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-500'
                    )}
                  />
                  <span className="hidden min-w-0 truncate sm:inline">{t('privacy')}</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Content Area - Glass Panel */}
          <div className="space-y-6">

            {activeSection === 'profile' && (
              <>
            {/* Email Verification Banner */}
            {!profile.email_verified && (
              <div
                className={cn(
                  glassPanel,
                  'border-amber-400/35 bg-amber-500/[0.07] p-5 dark:border-amber-400/25 dark:bg-amber-500/10'
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">{t('pleaseVerifyEmail')}</p>
                    <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/75">{t('verifyEmailDesc')}</p>
                  </div>
                  <Button
                    onClick={() => router.push(`/${locale}/verify-email?email=${encodeURIComponent(profile.email)}`)}
                    variant="outline"
                    className="h-11 shrink-0 border-amber-500/45 text-amber-800 hover:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/10"
                  >
                    {t('verifyEmail')}
                  </Button>
                </div>
              </div>
            )}

            <div className={cn(glassPanel, 'overflow-hidden p-6 md:p-8')}>
              <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 dark:border-white/[0.08] sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
                    {t('profileInfoTitle')}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {t('profileInfoDesc')}
                  </p>
                </div>
                {!editingProfile && (
                  <Button
                    type="button"
                    onClick={() => setEditingProfile(true)}
                    className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 font-semibold text-white shadow-lg shadow-violet-900/25 transition hover:from-violet-500 hover:to-fuchsia-500 hover:brightness-105 focus-visible:ring-violet-400 dark:shadow-violet-950/40"
                  >
                    {t('editProfile')}
                  </Button>
                )}
              </div>

              <div className="pt-6">
                {!editingProfile ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-colors hover:border-violet-300/50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:border-violet-500/30">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300/90">
                          <UserCircle className="h-3.5 w-3.5" aria-hidden />
                          {t('fullName')}
                        </div>
                        <p className="mt-2 break-words text-base font-medium text-slate-900 dark:text-white">
                          {profile.full_name || t('notSet')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-colors hover:border-violet-300/50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:border-violet-500/30">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300/90">
                          <Mail className="h-3.5 w-3.5" aria-hidden />
                          {t('email')}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="min-w-0 break-all text-base font-medium text-slate-900 dark:text-white">
                            <LtrEmbed className="break-all">{profile.email}</LtrEmbed>
                          </p>
                          {profile.email_verified ? (
                            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                              {t('verified')}
                            </span>
                          ) : (
                            <span className="rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                              {t('unverified')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-colors hover:border-violet-300/50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:border-violet-500/30">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300/90">
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          {t('phone')}
                        </div>
                        <p className="mt-2 break-words text-base font-medium text-slate-900 dark:text-white">
                          {profile.phone ? (
                            <LtrEmbed className="tabular-nums">{profile.phone}</LtrEmbed>
                          ) : (
                            t('notSet')
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-colors hover:border-violet-300/50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:border-violet-500/30">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300/90">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {t('location')}
                        </div>
                        <p className="mt-2 break-words text-base font-medium text-slate-900 dark:text-white">
                          {profile.location || t('notSet')}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="full_name" className="text-slate-800 dark:text-slate-200">
                        {t('fullName')}
                      </Label>
                      <Input
                        id="full_name"
                        value={profileData.full_name}
                        onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                        placeholder={t('enterFullName')}
                        className="mt-1.5 border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-500 focus-visible:ring-violet-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-slate-800 dark:text-slate-200">
                        {t('phone')}
                      </Label>
                      <Input
                        id="phone"
                        dir="ltr"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        placeholder={t('enterPhone')}
                        className="ltr-embed mt-1.5 border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-500 focus-visible:ring-violet-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="location" className="text-slate-800 dark:text-slate-200">
                        {t('location')}
                      </Label>
                      <Input
                        id="location"
                        value={profileData.location}
                        onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                        placeholder={t('enterLocation')}
                        className="mt-1.5 border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-500 focus-visible:ring-violet-500"
                      />
                    </div>
                    <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
                      <LoadingButton
                        onClick={handleSaveProfile}
                        loading={savingProfile}
                        className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white shadow-md shadow-violet-900/20 hover:from-violet-500 hover:to-fuchsia-500 dark:shadow-violet-950/30"
                      >
                        {t('saveChanges')}
                      </LoadingButton>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-slate-300 bg-white/80 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                        onClick={() => {
                          setEditingProfile(false)
                          setProfileData({
                            full_name: profile.full_name || '',
                            phone: profile.phone || '',
                            location: profile.location || '',
                          })
                        }}
                      >
                        {tCommon('cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 rounded-xl border border-slate-200/80 bg-slate-50/40 p-5 dark:border-white/[0.07] dark:bg-white/[0.03]">
                <div className="mb-4 flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200">
                    <Ticket className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('voucherSectionTitle')}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('voucherSectionDesc')}</p>
                  </div>
                </div>
                {voucherInfo && voucherInfo.redemptions.length > 0 ? (
                  <p className="mb-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    {t('voucherActiveSummary', { compare: voucherInfo.merged_benefits.daily_comparisons })}
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="profile_voucher_code" className="text-slate-800 dark:text-slate-200">
                      {t('voucherPlaceholder')}
                    </Label>
                    <Input
                      id="profile_voucher_code"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      placeholder={t('voucherPlaceholder')}
                      autoComplete="off"
                      className="mt-1.5 border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleApplyVoucher()
                      }}
                    />
                  </div>
                  <LoadingButton
                    type="button"
                    onClick={() => void handleApplyVoucher()}
                    loading={voucherApplying}
                    className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md hover:from-emerald-500 hover:to-teal-500 sm:min-w-[120px]"
                  >
                    {t('voucherApply')}
                  </LoadingButton>
                </div>
              </div>

              <div
                className="my-8 h-px w-full bg-gradient-to-r from-transparent via-violet-400/30 to-transparent dark:via-white/10"
                aria-hidden
              />

              <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/40 pl-4 dark:border-white/[0.07] dark:bg-white/[0.03] md:pl-6 md:pr-2 md:pt-1 md:pb-2">
                <div
                  className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-0.5 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500 md:top-4"
                  aria-hidden
                />
                <div className="py-4 pl-3 md:py-5 md:pl-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                        <Lock className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('changePassword')}</h3>
                        <p className="mt-0.5 max-w-lg text-sm text-slate-600 dark:text-slate-400">
                          {t('changePasswordDesc')}
                        </p>
                      </div>
                    </div>
                    {!changingPassword && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setChangingPassword(true)}
                        className="h-10 shrink-0 rounded-xl border-violet-500/35 bg-violet-500/5 font-medium text-violet-800 hover:bg-violet-500/10 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/15"
                      >
                        {t('changePassword')}
                      </Button>
                    )}
                  </div>

                  {changingPassword && (
                    <div className="mt-6 space-y-4 border-t border-slate-200/80 pt-6 dark:border-white/[0.08]">
                      <div>
                        <Label htmlFor="current_password" className="text-slate-800 dark:text-slate-200">
                          {t('currentPassword')}
                        </Label>
                        <div className="relative mt-1.5">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                          <Input
                            id="current_password"
                            type={showPasswords.current ? 'text' : 'password'}
                            value={passwordData.current}
                            onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                            className="border-slate-200 bg-white pl-9 dark:border-white/10 dark:bg-white/[0.05] dark:text-white focus-visible:ring-violet-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                          >
                            {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="new_password" className="text-slate-800 dark:text-slate-200">
                          {t('newPassword')}
                        </Label>
                        <div className="relative mt-1.5">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                          <Input
                            id="new_password"
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordData.new}
                            onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                            className="border-slate-200 bg-white pl-9 dark:border-white/10 dark:bg-white/[0.05] dark:text-white focus-visible:ring-violet-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                          >
                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {passwordData.new && <PasswordStrength password={passwordData.new} className="mt-2" />}
                      </div>
                      <div>
                        <Label htmlFor="confirm_password" className="text-slate-800 dark:text-slate-200">
                          {t('confirmNewPassword')}
                        </Label>
                        <div className="relative mt-1.5">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                          <Input
                            id="confirm_password"
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={passwordData.confirm}
                            onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                            className="border-slate-200 bg-white pl-9 dark:border-white/10 dark:bg-white/[0.05] dark:text-white focus-visible:ring-violet-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                          >
                            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                        <LoadingButton
                          onClick={handleChangePassword}
                          loading={savingProfile}
                          className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white shadow-md shadow-violet-900/20 hover:from-violet-500 hover:to-fuchsia-500"
                        >
                          {t('updatePassword')}
                        </LoadingButton>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-xl border-slate-300 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                          onClick={() => {
                            setChangingPassword(false)
                            setPasswordData({ current: '', new: '', confirm: '' })
                          }}
                        >
                          {tCommon('cancel')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="my-8 h-px w-full bg-gradient-to-r from-transparent via-violet-400/30 to-transparent dark:via-white/10"
                aria-hidden
              />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 to-white p-5 dark:border-white/[0.08] dark:from-white/[0.05] dark:to-white/[0.02] sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                      <Download className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white">{t('dataExport')}</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('dataExportDesc')}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleExportData}
                    className="h-11 w-full shrink-0 rounded-xl border border-violet-500/40 bg-violet-500/10 font-semibold text-violet-800 shadow-sm hover:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/20 sm:w-auto sm:min-w-[160px]"
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t('downloadMyData')}
                  </Button>
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 to-white p-5 dark:border-white/[0.08] dark:from-white/[0.05] dark:to-white/[0.02] sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200">
                      <Smartphone className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white">{t('notificationSettingsCardTitle')}</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {t('notificationSettingsCardDesc')}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full shrink-0 rounded-xl border-fuchsia-500/35 bg-fuchsia-500/5 font-semibold text-fuchsia-900 hover:bg-fuchsia-500/10 dark:border-fuchsia-400/30 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/15 sm:w-auto sm:min-w-[160px]"
                    onClick={() => router.push(`/${locale}/settings/notifications`)}
                  >
                    <Smartphone className="mr-2 h-4 w-4" />
                    {t('openNotificationSettings')}
                  </Button>
                </div>
              </div>
            </div>
              </>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                {/* Two-Factor Authentication */}
                <div className={cn(glassPanel, 'p-6')}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#8B5CF6]/20">
                        <Shield className="h-5 w-5 text-[#8B5CF6]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('twoFactor')}</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{t('addExtraSecurity')}</p>
                      </div>
                    </div>
                    <Switch
                      checked={securityPrefs.twoFactorEnabled}
                      onCheckedChange={(checked) => {
                        setSecurityPrefs((p) => ({ ...p, twoFactorEnabled: checked }))
                        savePrefs({ security: { twoFactorEnabled: checked } })
                      }}
                      className="data-[state=checked]:bg-[#8B5CF6]"
                    />
                  </div>
                  {securityPrefs.twoFactorEnabled && (
                    <div className="flex gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={securityPrefs.twoFactorMethod === 'email'}
                          onChange={() => savePrefs({ security: { twoFactorMethod: 'email' } })}
                          className="rounded-full border-slate-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{t('emailVerification')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={securityPrefs.twoFactorMethod === 'sms'}
                          onChange={() => savePrefs({ security: { twoFactorMethod: 'sms' } })}
                          className="rounded-full border-slate-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{t('smsVerification')}</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Active Sessions */}
                <div className={cn(glassPanel, 'p-6')}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-[#8B5CF6]/20">
                      <Monitor className="h-5 w-5 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('activeSessions')}</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{t('devicesSignedIn')}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {securityPrefs.activeSessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-white/5">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{s.device} · {s.browser}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{s.location} · {t('lastActive')}: {new Date(s.lastActive).toLocaleString()}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleSignOutSession(s.id)}>{t('signOut')}</Button>
                      </div>
                    ))}
                  </div>
                  {securityPrefs.activeSessions.length > 1 && (
                    <Button variant="destructive" size="sm" className="mt-4" onClick={handleSignOutAllOther}>
                      {t('signOutAllOther')}
                    </Button>
                  )}
                </div>

                {/* Login History */}
                <div className={cn(glassPanel, 'p-6')}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-[#8B5CF6]/20">
                      <History className="h-5 w-5 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('loginHistory')}</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{t('recentLoginAttempts')}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                          <th className="text-left py-2 text-slate-600 dark:text-slate-400">{t('date')}</th>
                          <th className="text-left py-2 text-slate-600 dark:text-slate-400">{t('time')}</th>
                          <th className="text-left py-2 text-slate-600 dark:text-slate-400">{t('location')}</th>
                          <th className="text-left py-2 text-slate-600 dark:text-slate-400">{t('device')}</th>
                          <th className="text-left py-2 text-slate-600 dark:text-slate-400">IP</th>
                          <th className="text-left py-2 text-slate-600 dark:text-slate-400">{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityPrefs.loginHistory.slice(0, 15).map((h, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-white/5">
                            <td className="py-2 text-slate-900 dark:text-white">{h.date}</td>
                            <td className="py-2 text-slate-700 dark:text-slate-300">{h.time}</td>
                            <td className="py-2 text-slate-700 dark:text-slate-300">{h.location}</td>
                            <td className="py-2 text-slate-700 dark:text-slate-300">{h.device}</td>
                            <td className="py-2 text-slate-600 dark:text-slate-400">{h.ip}</td>
                            <td className="py-2">{h.suspicious ? <Badge variant="destructive">{t('suspicious')}</Badge> : <Badge className="bg-green-500/20 text-green-400">OK</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Security Questions (optional) */}
                <div className={cn(glassPanel, 'p-6')}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-[#8B5CF6]/20">
                      <Shield className="h-5 w-5 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('securityQuestions')}</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{t('securityQuestionsDesc')}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{t('securityQuestionsNotSet')}</p>
                  <Button variant="outline" size="sm" className="border-[#8B5CF6]/50 text-[#8B5CF6] hover:bg-[#8B5CF6]/10">
                    {t('setupSecurityQuestions')}
                  </Button>
                </div>

                {/* Trusted Devices */}
                <div className={cn(glassPanel, 'p-6')}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-[#8B5CF6]/20">
                      <Smartphone className="h-5 w-5 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('trustedDevices')}</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{t('rememberedDevices')}</p>
                    </div>
                  </div>
                  {securityPrefs.trustedDevices.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('noTrustedDevices')}</p>
                  ) : (
                    <div className="space-y-2">
                      {securityPrefs.trustedDevices.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-white/5">
                          <span className="text-sm text-slate-700 dark:text-slate-300">{d.device} · {d.browser}</span>
                          <Button variant="ghost" size="sm" onClick={() => savePrefs({ security: { trustedDevices: securityPrefs.trustedDevices.filter((x) => x.id !== d.id) } })}>{t('remove')}</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="space-y-6">
                {/* Account Visibility */}
                <div className={cn(glassPanel, 'p-6')}>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('accountVisibility')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-slate-900 dark:text-white">{t('makeProfilePublic')}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('makeProfilePublicDesc')}</p>
                      </div>
                      <Switch checked={privacyPrefs.profilePublic} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, profilePublic: v })); savePrefs({ privacy: { profilePublic: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-slate-900 dark:text-white">{t('showPhoneInListings')}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('showPhoneInListingsDesc')}</p>
                      </div>
                      <Switch checked={privacyPrefs.showPhoneInListings} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, showPhoneInListings: v })); savePrefs({ privacy: { showPhoneInListings: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-slate-900 dark:text-white">{t('showEmailPublicly')}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('showEmailPubliclyDesc')}</p>
                      </div>
                      <Switch checked={privacyPrefs.showEmailPublicly} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, showEmailPublicly: v })); savePrefs({ privacy: { showEmailPublicly: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-slate-900 dark:text-white">{t('showLocationDetails')}</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('showLocationDetailsDesc')}</p>
                      </div>
                      <Switch checked={privacyPrefs.showLocationDetails} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, showLocationDetails: v })); savePrefs({ privacy: { showLocationDetails: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                  </div>
                </div>

                {/* Communication Preferences */}
                <div className={cn(glassPanel, 'p-6')}>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('communicationPrefs')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('marketingEmails')}</Label>
                      <Switch checked={privacyPrefs.marketingEmails} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, marketingEmails: v })); savePrefs({ privacy: { marketingEmails: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('smsNotifications')}</Label>
                      <Switch checked={privacyPrefs.smsNotifications} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, smsNotifications: v })); savePrefs({ privacy: { smsNotifications: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('allowMessages')}</Label>
                      <Switch checked={privacyPrefs.allowMessagesFromBuyersSellers} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, allowMessagesFromBuyersSellers: v })); savePrefs({ privacy: { allowMessagesFromBuyersSellers: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('pushNotifications')}</Label>
                      <Switch checked={privacyPrefs.pushNotifications} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, pushNotifications: v })); savePrefs({ privacy: { pushNotifications: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                  </div>
                </div>

                {/* Data Management */}
                <div className={cn(glassPanel, 'p-6')}>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('dataManagement')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{t('downloadAllData')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('gdprExport')}</p>
                      </div>
                      <Button onClick={handleExportData} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        {t('downloadMyData')}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{t('clearBrowsingHistory')}</p>
                      <Button onClick={handleClearBrowsingHistory} variant="outline" size="sm">{tCommon('clear')}</Button>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{t('clearSearchHistory')}</p>
                      <Button onClick={handleClearSearchHistory} variant="outline" size="sm">{tCommon('clear')}</Button>
                    </div>
                  </div>
                </div>

                {/* Cookie Preferences */}
                <div className={cn(glassPanel, 'p-6')}>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('cookiePreferences')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('essentialCookies')}</Label>
                      <Switch checked={true} disabled className="data-[state=checked]:bg-[#8B5CF6] opacity-70" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('analyticsCookies')}</Label>
                      <Switch checked={privacyPrefs.analyticsCookies} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, analyticsCookies: v })); savePrefs({ privacy: { analyticsCookies: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('marketingCookies')}</Label>
                      <Switch checked={privacyPrefs.marketingCookies} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, marketingCookies: v })); savePrefs({ privacy: { marketingCookies: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('personalizationCookies')}</Label>
                      <Switch checked={privacyPrefs.personalizationCookies} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, personalizationCookies: v })); savePrefs({ privacy: { personalizationCookies: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                  </div>
                </div>

                {/* Privacy Settings */}
                <div className={cn(glassPanel, 'p-6')}>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('privacySettings')}</h2>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-900 dark:text-white">{t('whoCanSeeListings')}</Label>
                      <div className="flex gap-4 mt-2 flex-wrap">
                        {([{ v: 'public', l: t('public') }, { v: 'registered', l: t('registeredUsersOnly') }, { v: 'private', l: t('private') }] as const).map(({ v, l }) => (
                          <label key={v} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="listings" checked={privacyPrefs.listingsVisibility === v} onChange={() => { setPrivacyPrefs((p) => ({ ...p, listingsVisibility: v })); savePrefs({ privacy: { listingsVisibility: v } }) }} className="text-[#8B5CF6] focus:ring-[#8B5CF6]" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{l}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-900 dark:text-white">{t('whoCanContact')}</Label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="contact" checked={privacyPrefs.whoCanContact === 'everyone'} onChange={() => { setPrivacyPrefs((p) => ({ ...p, whoCanContact: 'everyone' })); savePrefs({ privacy: { whoCanContact: 'everyone' } }) }} className="text-[#8B5CF6] focus:ring-[#8B5CF6]" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{t('everyone')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="contact" checked={privacyPrefs.whoCanContact === 'verified'} onChange={() => { setPrivacyPrefs((p) => ({ ...p, whoCanContact: 'verified' })); savePrefs({ privacy: { whoCanContact: 'verified' } }) }} className="text-[#8B5CF6] focus:ring-[#8B5CF6]" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{t('verifiedUsersOnly')}</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900 dark:text-white">{t('showActivityStatus')}</Label>
                      <Switch checked={privacyPrefs.showActivityStatus} onCheckedChange={(v) => { setPrivacyPrefs((p) => ({ ...p, showActivityStatus: v })); savePrefs({ privacy: { showActivityStatus: v } }) }} className="data-[state=checked]:bg-[#8B5CF6]" />
                    </div>
                  </div>
                </div>

                {/* Delete Account - Red warning card at bottom */}
                <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-red-400 mb-2">{t('deleteAccount')}</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                    {t('deleteAccountDesc')}
                  </p>
                  <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="bg-red-600 hover:bg-red-700">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('deleteMyAccount')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Dialog - password + checkbox confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeletePassword(''); setDeleteConfirmChecked(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">{t('deleteAccount')}</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-[#94a3b8]">
              {t('deleteAccountDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="delete-password" className="text-slate-900 dark:text-white">
                {t('confirmPassword')}
              </Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t('enterPassword')}
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {t('understandPermanent')}
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeletePassword('')
                setDeleteConfirmChecked(false)
              }}
            >
              {tCommon('cancel')}
            </Button>
            <LoadingButton
              onClick={handleDeleteAccount}
              loading={deleting}
              variant="destructive"
              disabled={!deleteConfirmChecked}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('deleteMyAccount')}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
