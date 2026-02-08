"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, Edit, Trash2, Eye, EyeOff, Filter, MapPin, ArrowLeft } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'kurdistan', label: 'Kurdistan Region' },
  { value: 'central', label: 'Central Iraq' },
  { value: 'southern', label: 'Southern Iraq' },
  { value: 'western', label: 'Western Iraq' },
  { value: 'northern', label: 'Northern Iraq' },
]

export default function LocationManagementPage() {
  const router = useRouter()
  const locale = useLocale()
  const { toast } = useToast()

  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [locationToDelete, setLocationToDelete] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<any>(null)
  const [formData, setFormData] = useState({
    id: '',
    name_en: '',
    name_ar: '',
    name_ku: '',
    region: 'none',
    is_active: true,
    coordinates: { lat: '', lng: '' },
  })

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    setLoading(true)
    try {
      const data = await apiClient.adminGetLocations()
      setLocations(data.locations || [])
    } catch (error: any) {
      console.error('Error loading locations:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load locations',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!locationToDelete) return

    try {
      await apiClient.adminDeleteLocation(locationToDelete.id)
      toast({
        title: 'Success',
        description: 'Location deleted successfully',
      })
      loadLocations()
      setDeleteDialogOpen(false)
      setLocationToDelete(null)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete location. It may be in use by services.',
        variant: 'destructive',
      })
    }
  }

  const handleToggleStatus = async (locationId: string, currentStatus: boolean) => {
    try {
      await apiClient.adminUpdateLocation(locationId, {
        is_active: !currentStatus,
      })
      toast({
        title: 'Success',
        description: `Location ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      })
      loadLocations()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update location status',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (location: any) => {
    setEditingLocation(location)
    setFormData({
      id: location.id,
      name_en: location.name_en || '',
      name_ar: location.name_ar || '',
      name_ku: location.name_ku || '',
      region: location.region || 'none',
      is_active: location.is_active !== undefined ? location.is_active : true,
      coordinates: location.coordinates
        ? typeof location.coordinates === 'string'
          ? JSON.parse(location.coordinates)
          : location.coordinates
        : { lat: '', lng: '' },
    })
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      if (!formData.name_en) {
        toast({
          title: 'Validation Error',
          description: 'English name is required',
          variant: 'destructive',
        })
        return
      }

      const locationData: any = {
        name_en: formData.name_en,
        name_ar: formData.name_ar || undefined,
        name_ku: formData.name_ku || undefined,
        region: formData.region === 'none' ? undefined : formData.region || undefined,
        is_active: formData.is_active,
      }

      if (formData.coordinates.lat && formData.coordinates.lng) {
        locationData.coordinates = {
          lat: parseFloat(formData.coordinates.lat),
          lng: parseFloat(formData.coordinates.lng),
        }
      }

      if (editingLocation) {
        await apiClient.adminUpdateLocation(editingLocation.id, locationData)
        toast({
          title: 'Success',
          description: 'Location updated successfully',
        })
      } else {
        locationData.id = formData.id || formData.name_en.toLowerCase().replace(/\s+/g, '-')
        await apiClient.adminCreateLocation(locationData)
        toast({
          title: 'Success',
          description: 'Location created successfully',
        })
      }

      setEditDialogOpen(false)
      setEditingLocation(null)
      resetForm()
      loadLocations()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save location',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setFormData({
      id: '',
      name_en: '',
      name_ar: '',
      name_ku: '',
      region: 'none',
      is_active: true,
      coordinates: { lat: '', lng: '' },
    })
  }

  const handleAddNew = () => {
    setEditingLocation(null)
    resetForm()
    setEditDialogOpen(true)
  }

  const filteredLocations = locations.filter((location) => {
    const matchesSearch =
      !searchQuery ||
      location.name_en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.name_ku?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRegion = regionFilter === 'all' || location.region === regionFilter

    return matchesSearch && matchesRegion
  })

  const getRegionBadgeColor = (region: string) => {
    const colors: Record<string, string> = {
      kurdistan: 'bg-green-600',
      central: 'bg-blue-600',
      southern: 'bg-yellow-600',
      western: 'bg-orange-600',
      northern: 'bg-purple-600',
    }
    return colors[region] || 'bg-gray-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Location Management</h1>
            <p className="text-gray-400 mt-2">Manage service locations across Iraq</p>
          </div>
        </div>
        <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((region) => (
                  <SelectItem key={region.value || 'all'} value={region.value || 'all'}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-gray-400 text-sm flex items-center">
              Showing {filteredLocations.length} location(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : filteredLocations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No locations found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-white">ID</TableHead>
                    <TableHead className="text-white">Name (EN)</TableHead>
                    <TableHead className="text-white">Name (AR)</TableHead>
                    <TableHead className="text-white">Name (KU)</TableHead>
                    <TableHead className="text-white">Region</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white">Coordinates</TableHead>
                    <TableHead className="text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((location) => (
                    <TableRow key={location.id} className="border-gray-700">
                      <TableCell className="text-gray-300 font-mono text-sm">
                        {location.id}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {location.name_en}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {location.name_ar || '—'}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {location.name_ku || '—'}
                      </TableCell>
                      <TableCell>
                        {location.region ? (
                          <Badge
                            className={`${getRegionBadgeColor(location.region)} text-white`}
                          >
                            {location.region}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={location.is_active ? 'default' : 'secondary'}
                          className={location.is_active ? 'bg-green-600' : 'bg-gray-600'}
                        >
                          {location.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {location.coordinates
                          ? typeof location.coordinates === 'string'
                            ? location.coordinates
                            : `${location.coordinates.lat}, ${location.coordinates.lng}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleToggleStatus(location.id, location.is_active)
                            }
                            className="text-gray-400 hover:text-white"
                          >
                            {location.is_active ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(location)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {location.id !== 'all' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setLocationToDelete(location)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingLocation
                ? 'Update location information'
                : 'Create a new service location'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="id" className="text-white">
                  Location ID *
                </Label>
                <Input
                  id="id"
                  value={formData.id}
                  onChange={(e) =>
                    setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                  }
                  placeholder="e.g., erbil, baghdad"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  disabled={!!editingLocation}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingLocation
                    ? 'ID cannot be changed'
                    : 'Lowercase, use hyphens (e.g., erbil, sulaymaniyah)'}
                </p>
              </div>
              <div>
                <Label htmlFor="region" className="text-white">
                  Region
                </Label>
                <Select
                  value={formData.region}
                  onValueChange={(value) => setFormData({ ...formData, region: value })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Region</SelectItem>
                    <SelectItem value="kurdistan">Kurdistan Region</SelectItem>
                    <SelectItem value="central">Central Iraq</SelectItem>
                    <SelectItem value="southern">Southern Iraq</SelectItem>
                    <SelectItem value="western">Western Iraq</SelectItem>
                    <SelectItem value="northern">Northern Iraq</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name_en" className="text-white">
                  Name (English) *
                </Label>
                <Input
                  id="name_en"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name_ar" className="text-white">
                  Name (Arabic)
                </Label>
                <Input
                  id="name_ar"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="name_ku" className="text-white">
                  Name (Kurdish)
                </Label>
                <Input
                  id="name_ku"
                  value={formData.name_ku}
                  onChange={(e) => setFormData({ ...formData, name_ku: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lat" className="text-white">
                  Latitude
                </Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  value={formData.coordinates.lat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      coordinates: { ...formData.coordinates, lat: e.target.value },
                    })
                  }
                  placeholder="e.g., 36.1911"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lng" className="text-white">
                  Longitude
                </Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  value={formData.coordinates.lng}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      coordinates: { ...formData.coordinates, lng: e.target.value },
                    })
                  }
                  placeholder="e.g., 44.0091"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label className="text-white">Active</Label>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingLocation(null)
                resetForm()
              }}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {editingLocation ? 'Update Location' : 'Create Location'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Location</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete "{locationToDelete?.name_en}"? This action
              cannot be undone.
              {locationToDelete?.service_count > 0 && (
                <span className="block mt-2 text-yellow-400">
                  Warning: This location is used by {locationToDelete.service_count} service(s).
                  You cannot delete it.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setLocationToDelete(null)
              }}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={locationToDelete?.service_count > 0}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
