"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { User, Lock, Download, Trash2, Eye, EyeOff, Shield, Smartphone, History, Monitor } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { LoadingButton } from '@/components/common/LoadingButton'
import { PasswordStrength } from '@/components/common/PasswordStrength'
import { ProfileAvatarUpload } from '@/components/profile/ProfileAvatarUpload'

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

  // Security & Privacy preferences (persist to localStorage; backend can sync later)
  const PREF_KEY = 'carwise_profile_prefs'
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

  // Single background: hide body bg on profile so only the animated gradient shows
  useEffect(() => {
    document.body.classList.add('profile-single-bg')
    return () => document.body.classList.remove('profile-single-bg')
  }, [])

  const loadProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const meta = user.user_metadata || {}
      const full = (meta.full_name as string) || (meta.name as string) || ''
      const phone = (meta.phone_number as string) || ''
      const loc = (meta.location as string) || ''
      let avatarUrl = (meta.avatar_url as string) || null
      if (!avatarUrl && typeof window !== 'undefined') {
        avatarUrl = localStorage.getItem(`profile_avatar_${user.id}`)
      }
      setProfile({
        full_name: full,
        email: user.email || '',
        phone,
        location: loc,
        email_verified: !!user.email_confirmed_at,
        avatar_url: avatarUrl
      })
      setProfileData({ full_name: full, phone, location: loc })
    } catch (error: unknown) {
      toast({ title: tCommon('error'), description: t('failedLoadProfile'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [user, toast, t, tCommon])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.security) setSecurityPrefs((p) => ({ ...p, ...data.security }))
        if (data.privacy) setPrivacyPrefs((p) => ({ ...p, ...data.privacy }))
      }
      const mockSessions = [
        { id: '1', device: 'Windows', browser: 'Chrome', location: 'Local', lastActive: new Date().toISOString() }
      ]
      const mockHistory = [
        { date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), location: 'Local', device: 'Chrome on Windows', ip: '127.0.0.1', suspicious: false }
      ]
      setSecurityPrefs((p) => ({
        ...p,
        activeSessions: p.activeSessions.length ? p.activeSessions : mockSessions,
        loginHistory: p.loginHistory.length ? p.loginHistory : mockHistory
      }))
    } catch (_) {}
  }, [])

  const savePrefs = useCallback((updates: { security?: Partial<typeof securityPrefs>; privacy?: Partial<typeof privacyPrefs> }) => {
    setSecurityPrefs((p) => (updates.security ? { ...p, ...updates.security } : p))
    setPrivacyPrefs((p) => (updates.privacy ? { ...p, ...updates.privacy } : p))
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(PREF_KEY)
        const data = raw ? JSON.parse(raw) : {}
        if (updates.security) data.security = { ...data.security, ...updates.security }
        if (updates.privacy) data.privacy = { ...data.privacy, ...updates.privacy }
        localStorage.setItem(PREF_KEY, JSON.stringify(data))
      } catch (_) {}
    }
  }, [])

  const handleSaveProfile = async () => {
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

        {/* Grid: no background; only child cards have glass */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 !bg-transparent">
          {/* Sidebar column - no wrapper background */}
          <div className="relative !bg-transparent">
            {/* Sidebar - Frosted glass card (only visible "box") */}
            <div className="backdrop-blur-xl bg-white/80 dark:bg-white/[0.07] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 h-fit lg:sticky lg:top-24 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/50 dark:ring-white/5">
            {/* Avatar with Glow */}
            <div className="flex flex-col items-center mb-6">
              {user && (
                <ProfileAvatarUpload
                  userId={user.id}
                  currentAvatarUrl={profile.avatar_url}
                  fallbackLetter={profile.full_name?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase() || 'U'}
                  onAvatarChange={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                />
              )}
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-4">{profile.full_name || tAuth('user')}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{profile.email}</p>
              {profile.email_verified && (
                <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
                  Verified
                </Badge>
              )}
            </div>

            {/* Navigation - touch-friendly on mobile */}
            <nav className="space-y-2">
              <button
                onClick={() => setActiveSection('profile')}
                className={`w-full text-left px-4 py-3 min-h-[44px] rounded-lg transition-colors touch-manipulation ${activeSection === 'profile' ? 'bg-indigo-100 dark:bg-white/10 text-indigo-900 dark:text-white font-medium' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
              >
                {t('profileInfo')}
              </button>
              <button
                onClick={() => setActiveSection('security')}
                className={`w-full text-left px-4 py-3 min-h-[44px] rounded-lg transition-colors touch-manipulation ${activeSection === 'security' ? 'bg-indigo-100 dark:bg-white/10 text-indigo-900 dark:text-white font-medium' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
              >
                {t('security')}
              </button>
              <button
                onClick={() => setActiveSection('privacy')}
                className={`w-full text-left px-4 py-3 min-h-[44px] rounded-lg transition-colors touch-manipulation ${activeSection === 'privacy' ? 'bg-indigo-100 dark:bg-white/10 text-indigo-900 dark:text-white font-medium' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
              >
                {t('privacy')}
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
              <div className="backdrop-blur-xl bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-yellow-400 font-medium">{t('pleaseVerifyEmail')}</p>
                    <p className="text-yellow-300/80 text-sm mt-1">
                      {t('verifyEmailDesc')}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(`/${locale}/verify-email?email=${encodeURIComponent(profile.email)}`)}
                    variant="outline"
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 h-12"
                  >
                    {t('verifyEmail')}
                  </Button>
                </div>
              </div>
            )}

            {/* Profile Information */}
            <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('profileInfoTitle')}</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('profileInfoDesc')}
                </p>
              </div>
              <div className="space-y-4">
                {!editingProfile ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-600 dark:text-[#94a3b8]">{t('fullName')}</Label>
                        <p className="text-slate-900 dark:text-white mt-1">{profile.full_name || t('notSet')}</p>
                      </div>
                      <div>
                        <Label className="text-slate-600 dark:text-[#94a3b8]">{t('email')}</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-slate-900 dark:text-white">{profile.email}</p>
                          {profile.email_verified ? (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">{t('verified')}</span>
                          ) : (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">{t('unverified')}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-slate-600 dark:text-[#94a3b8]">{t('phone')}</Label>
                        <p className="text-slate-900 dark:text-white mt-1">{profile.phone || t('notSet')}</p>
                      </div>
                      <div>
                        <Label className="text-slate-600 dark:text-[#94a3b8]">{t('location')}</Label>
                        <p className="text-slate-900 dark:text-white mt-1">{profile.location || t('notSet')}</p>
                      </div>
                    </div>
                    <Button onClick={() => setEditingProfile(true)} className="mt-4">
                      {t('editProfile')}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="full_name" className="text-slate-900 dark:text-white">{t('fullName')}</Label>
                        <Input
                          id="full_name"
                          value={profileData.full_name}
                          onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                          placeholder={t('enterFullName')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-slate-900 dark:text-white">{t('phone')}</Label>
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder={t('enterPhone')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="location" className="text-slate-900 dark:text-white">{t('location')}</Label>
                        <Input
                          id="location"
                          value={profileData.location}
                          onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                          placeholder={t('enterLocation')}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <LoadingButton
                        onClick={handleSaveProfile}
                        loading={savingProfile}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {t('saveChanges')}
                      </LoadingButton>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingProfile(false)
                          setProfileData({ full_name: profile.full_name || '', phone: profile.phone || '', location: profile.location || '' })
                        }}
                      >
                        {tCommon('cancel')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Change Password */}
            <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('changePassword')}</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('changePasswordDesc')}
                </p>
              </div>
              <div>
                {!changingPassword ? (
                  <Button onClick={() => setChangingPassword(true)} variant="outline">
                    {t('changePassword')}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="current_password" className="text-slate-900 dark:text-white">{t('currentPassword')}</Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-[#94a3b8]" />
                        <Input
                          id="current_password"
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordData.current}
                          onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute right-3 top-3 text-[#94a3b8]"
                        >
                          {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="new_password" className="text-slate-900 dark:text-white">{t('newPassword')}</Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-[#94a3b8]" />
                        <Input
                          id="new_password"
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordData.new}
                          onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-3 top-3 text-[#94a3b8]"
                        >
                          {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordData.new && <PasswordStrength password={passwordData.new} className="mt-2" />}
                    </div>
                    <div>
                      <Label htmlFor="confirm_password" className="text-slate-900 dark:text-white">{t('confirmNewPassword')}</Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500 dark:text-[#94a3b8]" />
                        <Input
                          id="confirm_password"
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordData.confirm}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-3 top-3 text-[#94a3b8]"
                        >
                          {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <LoadingButton
                        onClick={handleChangePassword}
                        loading={savingProfile}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {t('updatePassword')}
                      </LoadingButton>
                      <Button
                        variant="outline"
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

            {/* Data Export - quick link */}
            <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('dataExport')}</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {t('dataExportDesc')}
                </p>
              </div>
              <Button onClick={handleExportData} variant="outline" className="w-full md:w-auto">
                <Download className="h-4 w-4 mr-2" />
                {t('downloadMyData')}
              </Button>
            </div>
              </>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                {/* Two-Factor Authentication */}
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
                <div className="backdrop-blur-xl bg-white/90 dark:bg-white/[0.08] border border-slate-200/80 dark:border-white/10 dark:border-[#8B5CF6]/20 rounded-2xl p-6 shadow-lg shadow-black/5 dark:shadow-none ring-1 ring-slate-200/30 dark:ring-white/5">
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
