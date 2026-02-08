"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield, Eye, MapPin, Brain } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuthContext } from '@/context/AuthContext'
import { LoadingButton } from '@/components/common/LoadingButton'

export default function PrivacySettingsPage() {
  const router = useRouter()
  const locale = useLocale()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuthContext()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    privacy_show_phone: true,
    privacy_show_email: false,
    privacy_location_precision: 'city' as 'exact' | 'city',
    privacy_allow_ai_training: false
  })

  useEffect(() => {
    if (authLoading) return
    if (user) {
      loadSettings()
      return
    }
    // Delay redirect so AuthContext can settle (avoids redirecting when already logged in)
    const t = setTimeout(() => {
      router.replace(`/${locale}/login?returnUrl=${encodeURIComponent(`/${locale}/settings/privacy`)}`)
    }, 200)
    return () => clearTimeout(t)
  }, [user, authLoading, router, locale])

  const loadSettings = async () => {
    try {
      // For now, use defaults. In a real app, you'd fetch from API
      // const data = await apiClient.getPrivacySettings()
      // setSettings(data)
      setLoading(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load privacy settings',
        variant: 'destructive'
      })
      setLoading(false)
    }
  }

  const PRIVACY_SETTINGS_KEY = 'carwise_privacy_settings'

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.updatePrivacySettings(settings)
      toast({
        title: 'Settings saved',
        description: 'Your privacy settings have been updated'
      })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(settings))
          }
        } catch (_) {}
        toast({
          title: 'Saved on this device',
          description: 'Your preferences are stored locally. Sign in with email and password to sync across devices.'
        })
      } else {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to save settings',
          variant: 'destructive'
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
        <div className="text-[#94a3b8]">Loading...</div>
      </div>
    )
  }
  if (!user) {
    return null
  }
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
        <div className="text-[#94a3b8]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-200px)] p-6 bg-[#0f1117]">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Settings</h1>
          <p className="text-[#94a3b8]">Control how your information is shared and displayed</p>
        </div>

        {/* Contact Information Privacy */}
        <Card className="border-[#2a2d3a] bg-[#1a1d29] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Control who can see your contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-phone" className="text-white">Show Phone Number</Label>
                <p className="text-sm text-[#94a3b8]">
                  Allow others to see your phone number on your listings
                </p>
              </div>
              <Switch
                id="show-phone"
                checked={settings.privacy_show_phone}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, privacy_show_phone: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-email" className="text-white">Show Email Address</Label>
                <p className="text-sm text-[#94a3b8]">
                  Allow others to see your email address on your profile
                </p>
              </div>
              <Switch
                id="show-email"
                checked={settings.privacy_show_email}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, privacy_show_email: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Location Privacy */}
        <Card className="border-[#2a2d3a] bg-[#1a1d29] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Privacy
            </CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Control the precision of your location information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="location-precision" className="text-white">Location Precision</Label>
              <Select
                value={settings.privacy_location_precision}
                onValueChange={(value: string) =>
                  setSettings({ ...settings, privacy_location_precision: value as 'exact' | 'city' })
                }
              >
                <SelectTrigger id="location-precision" className="border-[#2a2d3a] bg-[#0f1117] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                  <SelectItem value="city" className="text-white hover:bg-[#2a2d3a]">
                    City Only
                  </SelectItem>
                  <SelectItem value="exact" className="text-white hover:bg-[#2a2d3a]">
                    Exact Address
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-[#94a3b8] mt-2">
                {settings.privacy_location_precision === 'city'
                  ? 'Only your city will be shown to other users'
                  : 'Your full address will be shown to other users'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Usage */}
        <Card className="border-[#2a2d3a] bg-[#1a1d29] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Data Usage
            </CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Control how your data is used for AI training and improvements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ai-training" className="text-white">Allow AI Training</Label>
                <p className="text-sm text-[#94a3b8]">
                  Allow your anonymized data to be used for improving our AI models
                </p>
              </div>
              <Switch
                id="ai-training"
                checked={settings.privacy_allow_ai_training}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, privacy_allow_ai_training: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <LoadingButton
            onClick={handleSave}
            loading={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Save Privacy Settings
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
