"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Bell, Mail, Smartphone, Save } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuthContext } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { publicApiUrl } from '@/lib/publicApiBase'
import { subscribeWithApi } from '@/lib/push/push-client'
import type { PushPrefs } from '@/lib/push/types'

export default function NotificationSettingsPage() {
  const router = useRouter()
  const locale = useLocale()
  const tPush = useTranslations('pushSettings')
  const { user, loading: authLoading } = useAuthContext()
  const isAuthenticated = !!user
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    email_new_matches: true,
    email_price_drops: true,
    push_notifications: false,
    frequency: 'instant'
  })

  const NOTIFICATION_SETTINGS_KEY = 'carwise_notification_settings'

  const [pushPrefsForm, setPushPrefsForm] = useState({
    newListing: true,
    priceDrop: true,
    marketTrend: true,
    watchMakes: '',
    watchModels: '',
    priceMin: '',
    priceMax: '',
  })
  const [pushPrefsLoading, setPushPrefsLoading] = useState(false)
  const [pushSubscribeBusy, setPushSubscribeBusy] = useState(false)
  const [pushSaving, setPushSaving] = useState(false)

  const loadWebPushPrefs = async (accessToken: string) => {
    setPushPrefsLoading(true)
    try {
      const r = await fetch(publicApiUrl('/api/notifications/preferences'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!r.ok) return
      const j = await r.json()
      const p = j.prefs as PushPrefs
      setPushPrefsForm({
        newListing: p.newListing !== false,
        priceDrop: p.priceDrop !== false,
        marketTrend: p.marketTrend !== false,
        watchMakes: (p.watchMakes || []).join(', '),
        watchModels: (p.watchModels || []).join(', '),
        priceMin: p.priceMin != null ? String(p.priceMin) : '',
        priceMax: p.priceMax != null ? String(p.priceMax) : '',
      })
    } catch {
      /* ignore */
    } finally {
      setPushPrefsLoading(false)
    }
  }

  const handleSaveWebPushPrefs = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast({
        title: tPush('noSubscription'),
        variant: 'destructive',
      })
      return
    }
    setPushSaving(true)
    try {
      const body: PushPrefs = {
        newListing: pushPrefsForm.newListing,
        priceDrop: pushPrefsForm.priceDrop,
        marketTrend: pushPrefsForm.marketTrend,
        watchMakes: pushPrefsForm.watchMakes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        watchModels: pushPrefsForm.watchModels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        priceMin: pushPrefsForm.priceMin.trim() !== '' ? Number(pushPrefsForm.priceMin) : null,
        priceMax: pushPrefsForm.priceMax.trim() !== '' ? Number(pushPrefsForm.priceMax) : null,
        locale,
      }
      const r = await fetch(publicApiUrl('/api/notifications/preferences'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      if (r.status === 404) {
        toast({ title: tPush('noSubscription'), variant: 'destructive' })
        return
      }
      if (!r.ok) throw new Error('save failed')
      toast({ title: tPush('saved'), description: tPush('savedDesc') })
    } catch {
      toast({ title: tPush('subscribeFail'), variant: 'destructive' })
    } finally {
      setPushSaving(false)
    }
  }

  const handleSubscribeDevice = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast({ title: tPush('noSubscription'), variant: 'destructive' })
      return
    }
    setPushSubscribeBusy(true)
    try {
      const ok = await subscribeWithApi(session.access_token, locale, {
        newListing: pushPrefsForm.newListing,
        priceDrop: pushPrefsForm.priceDrop,
        marketTrend: pushPrefsForm.marketTrend,
        watchMakes: pushPrefsForm.watchMakes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        watchModels: pushPrefsForm.watchModels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        priceMin: pushPrefsForm.priceMin.trim() !== '' ? Number(pushPrefsForm.priceMin) : null,
        priceMax: pushPrefsForm.priceMax.trim() !== '' ? Number(pushPrefsForm.priceMax) : null,
      })
      if (ok) {
        toast({ title: tPush('subscribeSuccess') })
        await loadWebPushPrefs(session.access_token)
      } else {
        toast({ title: tPush('subscribeFail'), variant: 'destructive' })
      }
    } finally {
      setPushSubscribeBusy(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (isAuthenticated) {
      loadSettings()
      return
    }
    // Delay redirect so AuthContext can settle (avoids redirecting when already logged in)
    const t = setTimeout(() => {
      if (!user) {
        const returnUrl = `/${locale}/settings/notifications`
        router.replace(`/${locale}/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [isAuthenticated, authLoading, user, router, locale])

  const loadSettings = async () => {
    if (!isAuthenticated) return

    // Check for Supabase session before making API call
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      // No session token available, use localStorage fallback
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(NOTIFICATION_SETTINGS_KEY) : null
        if (raw) {
          const saved = JSON.parse(raw)
          setSettings({
            email_new_matches: saved.email_new_matches ?? true,
            email_price_drops: saved.email_price_drops ?? true,
            push_notifications: saved.push_notifications ?? false,
            frequency: saved.frequency || 'instant'
          })
        }
      } catch (_) {}
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await apiClient.getNotificationSettings()
      if (data) {
        setSettings({
          email_new_matches: data.email_new_matches ?? true,
          email_price_drops: data.email_price_drops ?? true,
          push_notifications: data.push_notifications ?? false,
          frequency: data.frequency || 'instant'
        })
      }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        // Backend requires email/password auth; use localStorage or defaults
        // This is expected for users without full email/password authentication
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem(NOTIFICATION_SETTINGS_KEY) : null
          if (raw) {
            const saved = JSON.parse(raw)
            setSettings({
              email_new_matches: saved.email_new_matches ?? true,
              email_price_drops: saved.email_price_drops ?? true,
              push_notifications: saved.push_notifications ?? false,
              frequency: saved.frequency || 'instant'
            })
          }
          // Silently use defaults if no saved settings - this is expected behavior
        } catch (_) {
          // Silently use defaults if localStorage parse fails
        }
        // Don't show error toast for 401 - it's expected for some auth methods
      } else if (status !== 404) {
        // Only show error for non-401/404 errors (404 might mean settings don't exist yet)
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load settings',
          variant: 'destructive'
        })
      }
    } finally {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (s?.access_token) {
        await loadWebPushPrefs(s.access_token)
      }
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!isAuthenticated) return

    // Check for Supabase session before making API call
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      // No session token available, save to localStorage only
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings))
        }
        toast({
          title: 'Saved on this device',
          description: 'Your preferences are stored locally. Sign in with email and password to sync across devices.'
        })
      } catch (_) {
        toast({
          title: 'Error',
          description: 'Failed to save settings',
          variant: 'destructive'
        })
      }
      setSaving(false)
      return
    }

    setSaving(true)
    try {
      await apiClient.updateNotificationSettings(settings)
      // Also save to localStorage as backup
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings))
        }
      } catch (_) {}
      toast({
        title: 'Settings saved',
        description: 'Your notification preferences have been updated'
      })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        // Backend requires email/password auth; persist locally
        // This is expected for users without full email/password authentication
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings))
          }
        } catch (_) {}
        toast({
          title: 'Saved on this device',
          description: 'Your preferences are stored locally. Sign in with email and password to sync across devices.'
        })
      } else {
        // Try to save locally even on other errors as fallback
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings))
          }
          toast({
            title: 'Saved locally',
            description: 'Settings saved to this device. Some features may require server sync.'
          })
        } catch (_) {
          toast({
            title: 'Error',
            description: error?.message || 'Failed to save settings',
            variant: 'destructive'
          })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto pt-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-white">Notification Settings</h1>
          </div>
          <p className="text-gray-400">Manage how and when you receive notifications</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading settings...</div>
        ) : (
          <div className="space-y-6">
            {/* Email Notifications */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-400" />
                  <div>
                    <CardTitle className="text-white">Email Notifications</CardTitle>
                    <CardDescription className="text-gray-400">
                      Receive email alerts for saved searches and price drops
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-white">New Matches</Label>
                    <p className="text-sm text-gray-400">
                      Get notified when new cars match your saved searches
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_new_matches}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, email_new_matches: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-white">Price Drops</Label>
                    <p className="text-sm text-gray-400">
                      Get notified when prices drop on your favorited listings
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_price_drops}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, email_price_drops: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Email Frequency</Label>
                  <Select
                    value={settings.frequency}
                    onValueChange={(value) =>
                      setSettings({ ...settings, frequency: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant - Get notified immediately</SelectItem>
                      <SelectItem value="daily">Daily Digest - Once per day</SelectItem>
                      <SelectItem value="weekly">Weekly Digest - Once per week</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {settings.frequency === 'instant' && 'You\'ll receive emails as soon as matches are found'}
                    {settings.frequency === 'daily' && 'You\'ll receive a summary email once per day'}
                    {settings.frequency === 'weekly' && 'You\'ll receive a summary email once per week'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Web Push — marketplace alerts */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                  <div>
                    <CardTitle className="text-white">{tPush('webPushTitle')}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {tPush('webPushDesc')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {pushPrefsLoading ? (
                  <p className="text-sm text-gray-400">{tPush('loadingPush')}</p>
                ) : null}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-400">{tPush('noSubscription')}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pushSubscribeBusy}
                    onClick={handleSubscribeDevice}
                    className="bg-[#6C5CE7] text-white hover:bg-[#5b4cdb]"
                  >
                    {pushSubscribeBusy ? '…' : tPush('enableBrowser')}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pe-4">
                    <Label className="text-white">{tPush('newListing')}</Label>
                    <p className="text-sm text-gray-400">{tPush('newListingDesc')}</p>
                  </div>
                  <Switch
                    checked={pushPrefsForm.newListing}
                    onCheckedChange={(checked) =>
                      setPushPrefsForm((p) => ({ ...p, newListing: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pe-4">
                    <Label className="text-white">{tPush('priceDrop')}</Label>
                    <p className="text-sm text-gray-400">{tPush('priceDropDesc')}</p>
                  </div>
                  <Switch
                    checked={pushPrefsForm.priceDrop}
                    onCheckedChange={(checked) =>
                      setPushPrefsForm((p) => ({ ...p, priceDrop: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pe-4">
                    <Label className="text-white">{tPush('marketTrend')}</Label>
                    <p className="text-sm text-gray-400">{tPush('marketTrendDesc')}</p>
                  </div>
                  <Switch
                    checked={pushPrefsForm.marketTrend}
                    onCheckedChange={(checked) =>
                      setPushPrefsForm((p) => ({ ...p, marketTrend: checked }))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white">{tPush('watchMakes')}</Label>
                    <Input
                      className="bg-gray-700 border-gray-600 text-white"
                      value={pushPrefsForm.watchMakes}
                      onChange={(e) =>
                        setPushPrefsForm((p) => ({ ...p, watchMakes: e.target.value }))
                      }
                      placeholder="Toyota, Kia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{tPush('watchModels')}</Label>
                    <Input
                      className="bg-gray-700 border-gray-600 text-white"
                      value={pushPrefsForm.watchModels}
                      onChange={(e) =>
                        setPushPrefsForm((p) => ({ ...p, watchModels: e.target.value }))
                      }
                      placeholder="Camry, Sportage"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white">{tPush('priceMin')}</Label>
                    <Input
                      type="number"
                      className="bg-gray-700 border-gray-600 text-white"
                      value={pushPrefsForm.priceMin}
                      onChange={(e) =>
                        setPushPrefsForm((p) => ({ ...p, priceMin: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{tPush('priceMax')}</Label>
                    <Input
                      type="number"
                      className="bg-gray-700 border-gray-600 text-white"
                      value={pushPrefsForm.priceMax}
                      onChange={(e) =>
                        setPushPrefsForm((p) => ({ ...p, priceMax: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">{tPush('allMakesHint')}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-600 text-gray-200"
                  onClick={handleSaveWebPushPrefs}
                  disabled={pushSaving}
                >
                  {pushSaving ? '…' : tPush('savePushPrefs')}
                </Button>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
