'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Bell, X, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface PriceAlert {
  id: string
  make: string
  model: string
  maxPrice: number
  location?: string
  createdAt: number
  active: boolean
  matches?: number
}

const ALERTS_KEY = 'car-price-alerts'
const MAX_ALERTS = 10

export function PriceAlertManager() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newAlert, setNewAlert] = useState({
    make: '',
    model: '',
    maxPrice: '',
    location: '',
  })
  const toastHook = useToast()
  const toast = toastHook || { toast: () => {} }

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = () => {
    try {
      const stored = localStorage.getItem(ALERTS_KEY)
      if (stored) {
        setAlerts(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load alerts:', error)
    }
  }

  const saveAlerts = (newAlerts: PriceAlert[]) => {
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(newAlerts))
      setAlerts(newAlerts)
    } catch (error) {
      console.error('Failed to save alerts:', error)
    }
  }

  const createAlert = () => {
    if (alerts.length >= MAX_ALERTS) {
      if (toast?.toast) {
        toast.toast({
          title: 'Limit Reached',
          description: `Maximum ${MAX_ALERTS} alerts allowed`,
          variant: 'destructive',
        })
      }
      return
    }

    if (!newAlert.make || !newAlert.model || !newAlert.maxPrice) {
      if (toast?.toast) {
        toast.toast({
          title: 'Missing Fields',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        })
      }
      return
    }

    const alert: PriceAlert = {
      id: Date.now().toString(),
      make: newAlert.make,
      model: newAlert.model,
      maxPrice: parseFloat(newAlert.maxPrice),
      location: newAlert.location || undefined,
      createdAt: Date.now(),
      active: true,
      matches: 0,
    }

    const newAlerts = [...alerts, alert]
    saveAlerts(newAlerts)

    setNewAlert({ make: '', model: '', maxPrice: '', location: '' })
    setShowForm(false)

    if (toast?.toast) {
      toast.toast({
        title: 'Alert Created',
        description: `You'll be notified when ${newAlert.make} ${newAlert.model} is found under $${parseFloat(newAlert.maxPrice).toLocaleString()}`,
      })
    }
  }

  const deleteAlert = (id: string) => {
    const newAlerts = alerts.filter((a) => a.id !== id)
    saveAlerts(newAlerts)

    if (toast?.toast) {
      toast.toast({
        title: 'Alert Deleted',
        description: 'Price alert has been removed',
      })
    }
  }

  const toggleAlert = (id: string) => {
    const newAlerts = alerts.map((a) =>
      a.id === id ? { ...a, active: !a.active } : a
    )
    saveAlerts(newAlerts)
  }

  // In a real app, this would check predictions against alerts
  const checkAlerts = (predictions: any[]) => {
    const updatedAlerts = alerts.map((alert) => {
      if (!alert.active) return alert

      const matches = predictions.filter(
        (pred) =>
          pred.car.make.toLowerCase() === alert.make.toLowerCase() &&
          pred.car.model.toLowerCase() === alert.model.toLowerCase() &&
          pred.predicted_price <= alert.maxPrice &&
          (!alert.location ||
            pred.car.location.toLowerCase().includes(alert.location.toLowerCase()))
      ).length

      return { ...alert, matches }
    })

    saveAlerts(updatedAlerts)
  }

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29] mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#5B7FFF]" />
              Price Alerts
            </CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Get notified when cars matching your criteria are found
            </CardDescription>
          </div>
          <Collapsible open={showForm} onOpenChange={setShowForm}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-[#2a2d3a] hover:bg-[#2a2d3a]"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Alert
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-4 space-y-4 border-t border-[#2a2d3a] mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#94a3b8] mb-2 block">Make</label>
                    <Input
                      value={newAlert.make}
                      onChange={(e) => setNewAlert({ ...newAlert, make: e.target.value })}
                      placeholder="Toyota"
                      className="border-[#2a2d3a] bg-[#0f1117]"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#94a3b8] mb-2 block">Model</label>
                    <Input
                      value={newAlert.model}
                      onChange={(e) => setNewAlert({ ...newAlert, model: e.target.value })}
                      placeholder="Camry"
                      className="border-[#2a2d3a] bg-[#0f1117]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#94a3b8] mb-2 block">Max Price ($)</label>
                  <Input
                    type="number"
                    value={newAlert.maxPrice}
                    onChange={(e) => setNewAlert({ ...newAlert, maxPrice: e.target.value })}
                    placeholder="25000"
                    className="border-[#2a2d3a] bg-[#0f1117]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#94a3b8] mb-2 block">
                    Location (Optional)
                  </label>
                  <Input
                    value={newAlert.location}
                    onChange={(e) => setNewAlert({ ...newAlert, location: e.target.value })}
                    placeholder="California"
                    className="border-[#2a2d3a] bg-[#0f1117]"
                  />
                </div>
                <Button
                  onClick={createAlert}
                  className="w-full bg-[#5B7FFF] hover:bg-[#5B7FFF]/90"
                >
                  Create Alert
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardHeader>
      {alerts.length > 0 && (
        <CardContent>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#0f1117] border border-[#2a2d3a]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">
                      {alert.make} {alert.model}
                    </p>
                    <Badge
                      className={alert.active ? 'bg-green-500/20 text-green-500' : 'bg-[#2a2d3a] text-[#94a3b8]'}
                    >
                      {alert.active ? 'Active' : 'Inactive'}
                    </Badge>
                    {alert.matches !== undefined && alert.matches > 0 && (
                      <Badge className="bg-[#5B7FFF]/20 text-[#5B7FFF]">
                        {alert.matches} match{alert.matches > 1 ? 'es' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[#94a3b8] mt-1">
                    Under ${alert.maxPrice.toLocaleString()}
                    {alert.location && ` • ${alert.location}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAlert(alert.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Bell className={`h-4 w-4 ${alert.active ? 'text-green-500' : 'text-[#94a3b8]'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAlert(alert.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
