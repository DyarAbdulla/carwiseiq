"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await apiClient.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRetrain = async () => {
    setRetraining(true)
    try {
      const result = await apiClient.triggerModelRetrain()
      toast({
        title: 'Success',
        description: result.message || 'Model retraining triggered',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to trigger retraining',
        variant: 'destructive',
      })
    } finally {
      setRetraining(false)
    }
  }

  if (loading) {
    return <div className="text-white">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">System Settings</h1>
        <p className="text-gray-400 mt-2">Configure system settings and preferences</p>
      </div>

      {/* Model Settings */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <SettingsIcon className="h-5 w-5 mr-2" />
            Model Settings
          </CardTitle>
          <CardDescription className="text-gray-400">
            Configure model parameters and retraining schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-300">Current Model Version</Label>
            <Input
              value={settings?.model?.version || 'v2'}
              disabled
              className="bg-gray-700 border-gray-600 text-gray-400 mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-300">Accuracy Threshold (%)</Label>
            <Input
              type="number"
              value={settings?.model?.accuracy_threshold || 85}
              disabled
              className="bg-gray-700 border-gray-600 text-gray-400 mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-300">Retraining Schedule</Label>
            <select
              value={settings?.model?.retraining_schedule || 'weekly'}
              disabled
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-400 mt-1"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <Button
              onClick={handleRetrain}
              disabled={retraining}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {retraining ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retraining...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retrain Model Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Settings */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Feedback Settings</CardTitle>
          <CardDescription className="text-gray-400">
            Configure feedback collection and processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Enable Feedback Collection</Label>
              <p className="text-sm text-gray-400">
                Allow users to submit feedback on predictions
              </p>
            </div>
            <Switch
              checked={settings?.feedback?.collection_enabled ?? true}
              disabled
            />
          </div>
          <div>
            <Label className="text-gray-300">Minimum Feedback for Retraining</Label>
            <Input
              type="number"
              value={settings?.feedback?.min_feedback_for_retraining || 100}
              disabled
              className="bg-gray-700 border-gray-600 text-gray-400 mt-1"
            />
            <p className="text-sm text-gray-400 mt-1">
              Number of feedback submissions required before triggering retraining
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Admin Management */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Admin Management</CardTitle>
          <CardDescription className="text-gray-400">
            Manage admin accounts and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">
            Admin management features coming soon. For now, admins can be managed directly in the database.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
