"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Cookie, X, Settings } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function CookieConsent() {
  const { user } = useAuth()
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: false,
    marketing: false
  })

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) {
      setShowBanner(true)
    } else {
      try {
        const saved = JSON.parse(consent)
        setPreferences(saved)
      } catch (e) {
        setShowBanner(true)
      }
    }
  }, [])

  const handleAcceptAll = async () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true
    }
    await saveConsent(allAccepted)
  }

  const handleRejectAll = async () => {
    const onlyEssential = {
      essential: true,
      analytics: false,
      marketing: false
    }
    await saveConsent(onlyEssential)
  }

  const handleSavePreferences = async () => {
    await saveConsent(preferences)
    setShowSettings(false)
  }

  const saveConsent = async (consent: typeof preferences) => {
    localStorage.setItem('cookie_consent', JSON.stringify(consent))
    setPreferences(consent)
    setShowBanner(false)

    // Save to backend if user is authenticated
    if (user) {
      try {
        await apiClient.saveCookieConsent(consent)
      } catch (error) {
        console.error('Failed to save cookie consent to backend:', error)
      }
    }
  }

  if (!showBanner) return null

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[#1a1d29] border-t border-[#2a2d3a] shadow-lg">
        <Card className="max-w-6xl mx-auto border-[#2a2d3a] bg-[#1a1d29]">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Cookie className="h-6 w-6 text-blue-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">Cookie Consent</h3>
                  <p className="text-sm text-[#94a3b8]">
                    We use cookies to enhance your browsing experience, analyze site traffic, and personalize content.
                    By clicking "Accept All", you consent to our use of cookies.{' '}
                    <button
                      onClick={() => setShowSettings(true)}
                      className="text-blue-500 hover:underline"
                    >
                      Learn more
                    </button>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Button
                  onClick={handleRejectAll}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300"
                >
                  Reject All
                </Button>
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Customize
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Accept All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cookie Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-[#1a1d29] border-[#2a2d3a] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              Manage your cookie preferences. Essential cookies are required for the site to function.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">Essential Cookies</Label>
                <p className="text-sm text-[#94a3b8]">
                  Required for the website to function properly. These cannot be disabled.
                </p>
              </div>
              <Switch checked={true} disabled />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">Analytics Cookies</Label>
                <p className="text-sm text-[#94a3b8]">
                  Help us understand how visitors interact with our website by collecting and reporting information anonymously.
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, analytics: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">Marketing Cookies</Label>
                <p className="text-sm text-[#94a3b8]">
                  Used to track visitors across websites to display relevant advertisements.
                </p>
              </div>
              <Switch
                checked={preferences.marketing}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, marketing: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSettings(false)}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePreferences}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
