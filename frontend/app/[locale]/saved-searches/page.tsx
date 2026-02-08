"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Search, Edit2, Trash2, Play, Bell, BellOff } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SavedSearch {
  id: number
  name: string
  filters: any
  email_alerts: boolean
  frequency: string
  created_at: string
  last_notified_at: string | null
}

export default function SavedSearchesPage() {
  const router = useRouter()
  const locale = useLocale()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmailAlerts, setEditEmailAlerts] = useState(true)
  const [editFrequency, setEditFrequency] = useState('instant')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push(`/${locale}/login`)
      return
    }
    loadSearches()
  }, [isAuthenticated, authLoading])

  const loadSearches = async () => {
    if (!isAuthenticated) return

    setLoading(true)
    try {
      const data = await apiClient.getSavedSearches()
      setSearches(data.searches || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load saved searches',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (searchId: number) => {
    if (!confirm('Are you sure you want to delete this saved search?')) return

    try {
      await apiClient.deleteSavedSearch(searchId)
      setSearches(searches.filter(s => s.id !== searchId))
      toast({ title: 'Search deleted' })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete search',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = (search: SavedSearch) => {
    setEditingSearch(search)
    setEditName(search.name)
    setEditEmailAlerts(search.email_alerts)
    setEditFrequency(search.frequency)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingSearch) return

    try {
      await apiClient.updateSavedSearch(editingSearch.id, {
        name: editName,
        email_alerts: editEmailAlerts,
        frequency: editFrequency
      })
      await loadSearches()
      setEditDialogOpen(false)
      setEditingSearch(null)
      toast({ title: 'Search updated' })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update search',
        variant: 'destructive'
      })
    }
  }

  const handleRunSearch = (search: SavedSearch) => {
    // Build query params from filters
    const params = new URLSearchParams()
    if (search.filters.min_price) params.set('min_price', search.filters.min_price.toString())
    if (search.filters.max_price) params.set('max_price', search.filters.max_price.toString())
    if (search.filters.make) params.set('makes', search.filters.make)
    if (search.filters.model) params.set('models', search.filters.model)
    if (search.filters.min_year) params.set('min_year', search.filters.min_year.toString())
    if (search.filters.max_year) params.set('max_year', search.filters.max_year.toString())
    if (search.filters.max_mileage) params.set('max_mileage', search.filters.max_mileage.toString())
    if (search.filters.location) params.set('location_city', search.filters.location)

    router.push(`/${locale}/budget?${params.toString()}`)
  }

  const formatFilters = (filters: any) => {
    const parts = []
    if (filters.min_price || filters.max_price) {
      const min = filters.min_price ? `$${filters.min_price.toLocaleString()}` : ''
      const max = filters.max_price ? `$${filters.max_price.toLocaleString()}` : ''
      parts.push(`Price: ${min}${min && max ? ' - ' : ''}${max}`)
    }
    if (filters.make) parts.push(`Make: ${filters.make}`)
    if (filters.model) parts.push(`Model: ${filters.model}`)
    if (filters.min_year || filters.max_year) {
      parts.push(`Year: ${filters.min_year || 'Any'} - ${filters.max_year || 'Any'}`)
    }
    if (filters.max_mileage) parts.push(`Max Mileage: ${filters.max_mileage.toLocaleString()} km`)
    if (filters.location) parts.push(`Location: ${filters.location}`)
    return parts.length > 0 ? parts.join(' • ') : 'No filters'
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
      <div className="max-w-7xl mx-auto pt-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Search className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-white">Saved Searches</h1>
          </div>
          <p className="text-gray-400">Manage your saved car searches and alerts</p>
        </div>

        {/* Searches List */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading saved searches...</div>
        ) : searches.length === 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-12 text-center">
              <Search className="h-16 w-16 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">No saved searches</h3>
              <p className="text-gray-400 mb-6">
                Save searches from the Budget Finder to get email alerts when new cars match your criteria
              </p>
              <Button
                onClick={() => router.push(`/${locale}/budget`)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Go to Budget Finder
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {searches.map((search) => (
              <Card key={search.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white mb-2">{search.name}</CardTitle>
                      <p className="text-gray-400 text-sm">{formatFilters(search.filters)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {search.email_alerts ? (
                        <Bell className="h-5 w-5 text-green-400" />
                      ) : (
                        <BellOff className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Email Alerts:</span>
                      <span className={`${search.email_alerts ? 'text-green-400' : 'text-gray-500'}`}>
                        {search.email_alerts ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Frequency:</span>
                      <span className="text-gray-300 capitalize">{search.frequency}</span>
                    </div>
                    {search.last_notified_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Last notified:</span>
                        <span className="text-gray-300">
                          {new Date(search.last_notified_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleRunSearch(search)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Search
                      </Button>
                      <Button
                        onClick={() => handleEdit(search)}
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-300"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(search.id)}
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Saved Search</DialogTitle>
              <DialogDescription className="text-gray-400">
                Update your search name and notification settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-white">Search Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="e.g., Red SUVs under $20k"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-white">Email Alerts</Label>
                <Switch
                  checked={editEmailAlerts}
                  onCheckedChange={setEditEmailAlerts}
                />
              </div>
              <div>
                <Label className="text-white">Frequency</Label>
                <Select value={editFrequency} onValueChange={setEditFrequency}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="border-gray-600 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
