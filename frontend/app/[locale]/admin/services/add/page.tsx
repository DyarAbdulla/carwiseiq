"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Save } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'

const LOCATIONS = [
  { id: 'erbil', nameEn: 'Erbil', nameAr: 'أربيل', nameKu: 'هەولێر', region: 'kurdistan' },
  { id: 'sulaymaniyah', nameEn: 'Sulaymaniyah', nameAr: 'السليمانية', nameKu: 'سلێمانی', region: 'kurdistan' },
  { id: 'duhok', nameEn: 'Duhok', nameAr: 'دهوك', nameKu: 'دهۆک', region: 'kurdistan' },
  { id: 'baghdad', nameEn: 'Baghdad', nameAr: 'بغداد', nameKu: 'بەغدا', region: 'central' },
  { id: 'basra', nameEn: 'Basra', nameAr: 'البصرة', nameKu: 'بەسرە', region: 'southern' },
  { id: 'mosul', nameEn: 'Mosul', nameAr: 'الموصل', nameKu: 'موسڵ', region: 'northern' },
  { id: 'kirkuk', nameEn: 'Kirkuk', nameAr: 'كركوك', nameKu: 'کەرکووک', region: 'central' },
  { id: 'najaf', nameEn: 'Najaf', nameAr: 'النجف', nameKu: 'نەجەف', region: 'southern' },
  { id: 'karbala', nameEn: 'Karbala', nameAr: 'كربلاء', nameKu: 'کەربەلا', region: 'southern' },
  { id: 'ramadi', nameEn: 'Ramadi', nameAr: 'الرمادي', nameKu: 'ڕەمادی', region: 'western' },
  { id: 'fallujah', nameEn: 'Fallujah', nameAr: 'الفلوجة', nameKu: 'فەلوجە', region: 'western' },
  { id: 'amarah', nameEn: 'Amarah', nameAr: 'العمارة', nameKu: 'ئەمارە', region: 'southern' },
  { id: 'nasiriyah', nameEn: 'Nasiriyah', nameAr: 'الناصرية', nameKu: 'ناسریە', region: 'southern' },
]

const ICONS = [
  'fuel-pump', 'droplet', 'wrench', 'truck', 'handshake', 'circle', 'battery',
  'car', 'settings', 'tool', 'shield', 'star', 'heart', 'zap'
]

export default function AddServicePage() {
  const router = useRouter()
  const locale = useLocale()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name_en: '',
    name_ar: '',
    name_ku: '',
    description_en: '',
    description_ar: '',
    description_ku: '',
    icon: 'fuel-pump',
    icon_type: 'library',
    is_all_iraq: true,
    locations: [] as string[],
    status: 'active',
    display_order: 50,
    contact_phone: '',
    contact_email: '',
    service_url: '',
    is_featured: false,
    provider_name: '',
    provider_logo: '',
    provider_phone: '',
    provider_email: '',
    provider_website: '',
    provider_address: '',
    provider_whatsapp: '',
    map_latitude: '',
    map_longitude: '',
    gallery_images: [] as string[],
    working_hours: '',
    rating: 0,
    review_count: 0,
    price_range: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name_en || !formData.description_en) {
      toast({
        title: 'Validation Error',
        description: 'English name and description are required',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Prepare form data with proper types
      const submitData: any = { ...formData }

      // Convert map coordinates to numbers
      if (submitData.map_latitude) submitData.map_latitude = parseFloat(submitData.map_latitude) || null
      if (submitData.map_longitude) submitData.map_longitude = parseFloat(submitData.map_longitude) || null

      // Convert rating and review_count to numbers
      submitData.rating = parseFloat(submitData.rating.toString()) || 0
      submitData.review_count = parseInt(submitData.review_count.toString()) || 0

      await apiClient.adminCreateService(submitData)
      toast({
        title: 'Success',
        description: 'Service created successfully',
      })
      router.push(`/${locale}/admin/services`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create service',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLocationToggle = (locationId: string) => {
    if (formData.is_all_iraq) return

    const newLocations = formData.locations.includes(locationId)
      ? formData.locations.filter(id => id !== locationId)
      : [...formData.locations, locationId]

    setFormData({ ...formData, locations: newLocations })
  }

  const groupedLocations = LOCATIONS.reduce((acc, loc) => {
    if (!acc[loc.region]) acc[loc.region] = []
    acc[loc.region].push(loc)
    return acc
  }, {} as Record<string, typeof LOCATIONS>)

  return (
    <div className="space-y-6">
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
          <h1 className="text-3xl font-bold text-white">Add New Service</h1>
          <p className="text-gray-400 mt-2">Create a new automotive service</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name_en" className="text-white">Service Name (English) *</Label>
                <Input
                  id="name_en"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name_ar" className="text-white">Service Name (Arabic)</Label>
                <Input
                  id="name_ar"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="name_ku" className="text-white">Service Name (Kurdish)</Label>
                <Input
                  id="name_ku"
                  value={formData.name_ku}
                  onChange={(e) => setFormData({ ...formData, name_ku: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description_en" className="text-white">Description (English) *</Label>
              <Textarea
                id="description_en"
                value={formData.description_en}
                onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white mt-1"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="description_ar" className="text-white">Description (Arabic)</Label>
                <Textarea
                  id="description_ar"
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="description_ku" className="text-white">Description (Kurdish)</Label>
                <Textarea
                  id="description_ku"
                  value={formData.description_ku}
                  onChange={(e) => setFormData({ ...formData, description_ku: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Icon */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Service Icon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`p-3 rounded border-2 transition-colors ${formData.icon === icon
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                    }`}
                >
                  <span className="text-lg">{icon}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Availability */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Service Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_all_iraq}
                onCheckedChange={(checked) => setFormData({ ...formData, is_all_iraq: checked, locations: [] })}
              />
              <Label className="text-white">Available in All Iraq</Label>
            </div>

            {!formData.is_all_iraq && (
              <div className="space-y-4">
                <Label className="text-white">Select Specific Locations:</Label>
                {Object.entries(groupedLocations).map(([region, locations]) => (
                  <div key={region} className="space-y-2">
                    <Label className="text-gray-400 capitalize">{region} Region:</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {locations.map((loc) => (
                        <div key={loc.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`loc-${loc.id}`}
                            checked={formData.locations.includes(loc.id)}
                            onCheckedChange={() => handleLocationToggle(loc.id)}
                          />
                          <Label htmlFor={`loc-${loc.id}`} className="text-gray-300 text-sm">
                            {loc.nameEn}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provider Information */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Provider Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider_name" className="text-white">Provider Name</Label>
                <Input
                  id="provider_name"
                  value={formData.provider_name}
                  onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                  placeholder="e.g., Cihan Motors, Express Oil Center"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="provider_logo" className="text-white">Provider Logo URL</Label>
                <Input
                  id="provider_logo"
                  value={formData.provider_logo}
                  onChange={(e) => setFormData({ ...formData, provider_logo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="provider_phone" className="text-white">Provider Phone</Label>
                <Input
                  id="provider_phone"
                  value={formData.provider_phone}
                  onChange={(e) => setFormData({ ...formData, provider_phone: e.target.value })}
                  placeholder="+964 750 123 4567"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="provider_email" className="text-white">Provider Email</Label>
                <Input
                  id="provider_email"
                  type="email"
                  value={formData.provider_email}
                  onChange={(e) => setFormData({ ...formData, provider_email: e.target.value })}
                  placeholder="info@example.com"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="provider_whatsapp" className="text-white">WhatsApp Number</Label>
                <Input
                  id="provider_whatsapp"
                  value={formData.provider_whatsapp}
                  onChange={(e) => setFormData({ ...formData, provider_whatsapp: e.target.value })}
                  placeholder="+964 750 123 4567"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider_website" className="text-white">Provider Website</Label>
                <Input
                  id="provider_website"
                  type="url"
                  value={formData.provider_website}
                  onChange={(e) => setFormData({ ...formData, provider_website: e.target.value })}
                  placeholder="www.example.com"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="provider_address" className="text-white">Provider Address</Label>
                <Input
                  id="provider_address"
                  value={formData.provider_address}
                  onChange={(e) => setFormData({ ...formData, provider_address: e.target.value })}
                  placeholder="123 Main Street, Erbil"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="map_latitude" className="text-white">Map Latitude</Label>
                <Input
                  id="map_latitude"
                  type="number"
                  step="any"
                  value={formData.map_latitude}
                  onChange={(e) => setFormData({ ...formData, map_latitude: e.target.value })}
                  placeholder="36.1911"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="map_longitude" className="text-white">Map Longitude</Label>
                <Input
                  id="map_longitude"
                  type="number"
                  step="any"
                  value={formData.map_longitude}
                  onChange={(e) => setFormData({ ...formData, map_longitude: e.target.value })}
                  placeholder="44.0091"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="working_hours" className="text-white">Working Hours</Label>
                <Input
                  id="working_hours"
                  value={formData.working_hours}
                  onChange={(e) => setFormData({ ...formData, working_hours: e.target.value })}
                  placeholder="Sun-Thu: 8AM-8PM"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="price_range" className="text-white">Price Range</Label>
                <Input
                  id="price_range"
                  value={formData.price_range}
                  onChange={(e) => setFormData({ ...formData, price_range: e.target.value })}
                  placeholder="10,000 - 50,000 IQD"
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rating" className="text-white">Rating (0-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="review_count" className="text-white">Review Count</Label>
                <Input
                  id="review_count"
                  type="number"
                  min="0"
                  value={formData.review_count}
                  onChange={(e) => setFormData({ ...formData, review_count: parseInt(e.target.value) || 0 })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Additional Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Status</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={formData.status === 'active'}
                      onChange={() => setFormData({ ...formData, status: 'active' })}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">Active</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={formData.status === 'inactive'}
                      onChange={() => setFormData({ ...formData, status: 'inactive' })}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">Inactive</span>
                  </label>
                </div>
              </div>
              <div>
                <Label htmlFor="display_order" className="text-white">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 50 })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="contact_phone" className="text-white">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contact_email" className="text-white">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="service_url" className="text-white">Service URL</Label>
                <Input
                  id="service_url"
                  type="url"
                  value={formData.service_url}
                  onChange={(e) => setFormData({ ...formData, service_url: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_featured}
                onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
              />
              <Label className="text-white">Featured Service</Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="border-gray-600 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Service'}
          </Button>
        </div>
      </form>
    </div>
  )
}
