"use client"
export const runtime = 'edge';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { Plus, Edit, Trash2, Search, Building2 } from 'lucide-react'

export default function ProvidersManagementPage() {
  const router = useRouter()
  const locale = useLocale()
  const { toast } = useToast()

  const [providers, setProviders] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadProviders()
  }, [serviceFilter, statusFilter])

  const loadData = async () => {
    try {
      const [servicesRes, providersRes] = await Promise.all([
        apiClient.adminGetServices(),
        apiClient.adminGetProviders()
      ])

      if (servicesRes && servicesRes.services) {
        setServices(servicesRes.services)
      }

      if (providersRes && providersRes.providers) {
        setProviders(providersRes.providers)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadProviders = async () => {
    try {
      const params: any = {}
      if (serviceFilter !== 'all') params.service_id = serviceFilter
      if (statusFilter !== 'all') params.status = statusFilter

      const res = await apiClient.adminGetProviders(params)
      if (res && res.providers) {
        setProviders(res.providers)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load providers',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (providerId: string, providerName: string) => {
    if (!confirm(`Are you sure you want to delete "${providerName}"?`)) return

    try {
      await apiClient.adminDeleteProvider(providerId)
      toast({
        title: 'Success',
        description: 'Provider deleted successfully',
      })
      loadProviders()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete provider',
        variant: 'destructive',
      })
    }
  }

  const filteredProviders = providers.filter(provider => {
    const matchesSearch = !searchQuery ||
      provider.provider_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.provider_address?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const getServiceName = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    if (!service) return serviceId
    if (locale === 'ar' && service.name_ar) return service.name_ar
    if (locale === 'ku' && service.name_ku) return service.name_ku
    return service.name_en
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-400">Loading providers...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Providers Management</h1>
          <p className="text-gray-400 mt-1">Manage all service providers</p>
        </div>
        <Button
          onClick={() => router.push(`/${locale}/admin/services/providers/add`)}
          className="bg-[#8b5cf6] hover:bg-[#7c3aed]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search providers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Services</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {getServiceName(service.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Providers Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Providers ({filteredProviders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProviders.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No providers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-white">Provider Name</TableHead>
                  <TableHead className="text-white">Service</TableHead>
                  <TableHead className="text-white">Phone</TableHead>
                  <TableHead className="text-white">Address</TableHead>
                  <TableHead className="text-white">Rating</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <TableRow key={provider.id} className="border-gray-700">
                    <TableCell className="text-white font-medium">
                      {provider.provider_name}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {getServiceName(provider.service_id)}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {provider.provider_phone || '-'}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {provider.provider_address || '-'}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {provider.rating ? `${provider.rating.toFixed(1)} ⭐` : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${provider.status === 'active'
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                        }`}>
                        {provider.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/${locale}/admin/services/providers/edit/${provider.id}`)}
                          className="border-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(provider.id, provider.provider_name)}
                          className="border-red-600 text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
