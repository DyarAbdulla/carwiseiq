"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, Edit, Trash2, Eye, EyeOff, Filter, MapPin } from 'lucide-react'
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

export default function ServicesManagementPage() {
  const router = useRouter()
  const locale = useLocale()
  const { toast } = useToast()

  const [services, setServices] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'all',
    location_id: 'all',
    search: '',
  })
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null)

  useEffect(() => {
    loadServices()
  }, [page, filters])

  const loadServices = async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        page_size: pageSize,
      }
      if (filters.status && filters.status !== 'all') params.status = filters.status
      if (filters.location_id && filters.location_id !== 'all') params.location_id = filters.location_id

      const data = await apiClient.adminGetServices(params)
      setServices(data.services || [])
      setTotal(data.pagination?.total || 0)
    } catch (error: any) {
      console.error('Error loading services:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load services',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (serviceId: string) => {
    try {
      await apiClient.adminDeleteService(serviceId)
      toast({
        title: 'Success',
        description: 'Service deleted successfully',
      })
      loadServices()
      setDeleteDialogOpen(false)
      setServiceToDelete(null)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete service',
        variant: 'destructive',
      })
    }
  }

  const handleToggleStatus = async (serviceId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      await apiClient.adminToggleServiceStatus(serviceId, newStatus as 'active' | 'inactive')
      toast({
        title: 'Success',
        description: `Service ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      })
      loadServices()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update service status',
        variant: 'destructive',
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedServices.size === 0) return

    try {
      await apiClient.adminBulkDeleteServices(Array.from(selectedServices))
      toast({
        title: 'Success',
        description: `${selectedServices.size} service(s) deleted successfully`,
      })
      setSelectedServices(new Set())
      loadServices()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete services',
        variant: 'destructive',
      })
    }
  }

  const getLocationDisplay = (service: any) => {
    if (service.is_all_iraq) {
      return 'All Iraq'
    }
    if (service.locations && service.locations.length > 0) {
      return `${service.locations.length} location(s)`
    }
    return 'No locations'
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Services Management</h1>
          <p className="text-gray-400 mt-2">Manage automotive services across Iraq</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => router.push(`/${locale}/admin/services/locations`)}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Manage Locations
          </Button>
          <Button
            onClick={() => router.push(`/${locale}/admin/services/add`)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search services..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.location_id}
              onValueChange={(value) => setFilters({ ...filters, location_id: value })}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="all_iraq">All Iraq</SelectItem>
                <SelectItem value="erbil">Erbil</SelectItem>
                <SelectItem value="baghdad">Baghdad</SelectItem>
                <SelectItem value="sulaymaniyah">Sulaymaniyah</SelectItem>
                <SelectItem value="basra">Basra</SelectItem>
              </SelectContent>
            </Select>
            {selectedServices.size > 0 && (
              <Button
                onClick={handleBulkDelete}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedServices.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Services</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No services found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedServices.size === services.length && services.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServices(new Set(services.map(s => s.id)))
                            } else {
                              setSelectedServices(new Set())
                            }
                          }}
                          className="rounded border-gray-600"
                        />
                      </TableHead>
                      <TableHead className="text-white">Icon</TableHead>
                      <TableHead className="text-white">Service Name</TableHead>
                      <TableHead className="text-white">Description</TableHead>
                      <TableHead className="text-white">Locations</TableHead>
                      <TableHead className="text-white">Status</TableHead>
                      <TableHead className="text-white">Order</TableHead>
                      <TableHead className="text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.id} className="border-gray-700">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedServices.has(service.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedServices)
                              if (e.target.checked) {
                                newSet.add(service.id)
                              } else {
                                newSet.delete(service.id)
                              }
                              setSelectedServices(newSet)
                            }}
                            className="rounded border-gray-600"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">
                            {service.icon ? (
                              <span className="text-lg">{service.icon}</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-white font-medium">
                          {service.name_en || service.name}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {service.description_en?.substring(0, 50) || service.description?.substring(0, 50) || '—'}
                          {(service.description_en?.length || service.description?.length || 0) > 50 && '...'}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {getLocationDisplay(service)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={service.status === 'active' ? 'default' : 'secondary'}
                            className={service.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}
                          >
                            {service.status || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {service.display_order || 50}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleStatus(service.id, service.status || 'active')}
                              className="text-gray-400 hover:text-white"
                            >
                              {service.status === 'active' ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/${locale}/admin/services/edit/${service.id}`)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setServiceToDelete(service.id)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-gray-400 text-sm">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} services
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-gray-600 text-gray-300"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="border-gray-600 text-gray-300"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Service</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this service? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setServiceToDelete(null)
              }}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => serviceToDelete && handleDelete(serviceToDelete)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
