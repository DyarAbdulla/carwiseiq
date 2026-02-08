"use client"


import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { CarRow, CarInsert } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Car, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const locale = useLocale() || 'en'
  const { toast } = useToast()

  const [cars, setCars] = useState<CarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [guardChecking, setGuardChecking] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<CarRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState<CarInsert>({
    car_name: '',
    car_model: '',
    car_year: undefined as number | undefined,
    car_price: undefined as number | undefined,
    car_image_url: '',
    description: '',
  })

  const resetForm = () => {
    setForm({
      car_name: '',
      car_model: '',
      car_year: undefined,
      car_price: undefined,
      car_image_url: '',
      description: '',
    })
    setEditing(null)
  }

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      return
    }
    setCars((data as CarRow[]) || [])
  }

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.replace(`/${locale}/login?returnUrl=/${locale}/dashboard`)
        return
      }
      setGuardChecking(false)
      await fetchCars()
    }
    run()
  }, [locale, router])

  useEffect(() => {
    if (!guardChecking) {
      setLoading(false)
    }
  }, [guardChecking])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) return

    setSaving(true)
    try {
      const { error } = await supabase.from('cars').insert({
        user_id: session.user.id,
        car_name: form.car_name,
        car_model: form.car_model || null,
        car_year: form.car_year ? Number(form.car_year) : null,
        car_price: form.car_price ? Number(form.car_price) : null,
        car_image_url: form.car_image_url || null,
        description: form.description || null,
      })
      if (error) throw error
      toast({ title: 'Success', description: 'Car added' })
      setAddOpen(false)
      resetForm()
      await fetchCars()
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to add car', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('cars')
        .update({
          car_name: form.car_name,
          car_model: form.car_model || null,
          car_year: form.car_year ? Number(form.car_year) : null,
          car_price: form.car_price ? Number(form.car_price) : null,
          car_image_url: form.car_image_url || null,
          description: form.description || null,
        })
        .eq('id', editing.id)
      if (error) throw error
      toast({ title: 'Success', description: 'Car updated' })
      setEditing(null)
      resetForm()
      await fetchCars()
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to update', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase.from('cars').delete().eq('id', id)
      if (error) throw error
      toast({ title: 'Success', description: 'Car deleted' })
      await fetchCars()
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to delete', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const openEdit = (c: CarRow) => {
    setEditing(c)
    setForm({
      car_name: c.car_name,
      car_model: c.car_model || '',
      car_year: c.car_year ?? undefined,
      car_price: c.car_price != null ? Number(c.car_price) : undefined,
      car_image_url: c.car_image_url || '',
      description: c.description || '',
    })
  }

  if (guardChecking || loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-[#5B7FFF]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Cars</h1>
          <p className="text-slate-600 dark:text-[#94a3b8]">Add, edit, and manage your cars.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 gap-2">
              <Plus className="h-4 w-4" />
              Add Car
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Add Car</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-[#94a3b8]">Add a new car to your list.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="grid gap-4">
              <div>
                <Label className="text-slate-900 dark:text-white">Car name *</Label>
                <Input
                  value={form.car_name}
                  onChange={(e) => setForm((f) => ({ ...f, car_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label className="text-white">Model</Label>
                <Input
                  value={form.car_model ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, car_model: e.target.value }))}
                  className="border-[#2a2d3a] bg-[#0f1117] text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Year</Label>
                  <Input
                    type="number"
                    value={form.car_year ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, car_year: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                    className="border-[#2a2d3a] bg-[#0f1117] text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.car_price ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, car_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="border-[#2a2d3a] bg-[#0f1117] text-white"
                  />
                </div>
              </div>
              <div>
                <Label className="text-white">Image URL</Label>
                <Input
                  value={form.car_image_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, car_image_url: e.target.value }))}
                  className="border-[#2a2d3a] bg-[#0f1117] text-white"
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label className="text-white">Description</Label>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 dark:border-[#2a2d3a] bg-white dark:bg-[#0f1117] px-3 py-2 text-slate-900 dark:text-white"
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={saving} className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90">
                {saving ? 'Saving...' : 'Add Car'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Edit Car</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="grid gap-4">
            <div>
              <Label className="text-white">Car name *</Label>
              <Input
                value={form.car_name}
                onChange={(e) => setForm((f) => ({ ...f, car_name: e.target.value }))}
                className="border-[#2a2d3a] bg-[#0f1117] text-white"
                required
              />
            </div>
            <div>
              <Label className="text-white">Model</Label>
              <Input
                value={form.car_model ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, car_model: e.target.value }))}
                className="border-[#2a2d3a] bg-[#0f1117] text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white">Year</Label>
                <Input
                  type="number"
                  value={form.car_year ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, car_year: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                  className="border-[#2a2d3a] bg-[#0f1117] text-white"
                />
              </div>
              <div>
                <Label className="text-white">Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.car_price ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, car_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="border-[#2a2d3a] bg-[#0f1117] text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-white">Image URL</Label>
              <Input
                value={form.car_image_url ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, car_image_url: e.target.value }))}
                className="border-[#2a2d3a] bg-[#0f1117] text-white"
              />
            </div>
            <div>
              <Label className="text-white">Description</Label>
              <textarea
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2 text-white"
                rows={2}
              />
            </div>
            <Button type="submit" disabled={saving} className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {cars.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Car className="h-16 w-16 text-slate-400 dark:text-[#94a3b8] mb-4" />
            <p className="text-slate-600 dark:text-[#94a3b8] text-center">No cars yet. Add your first car above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cars.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex">
                {c.car_image_url ? (
                  <img
                    src={c.car_image_url}
                    alt={c.car_name}
                    className="h-32 w-32 object-cover shrink-0"
                  />
                ) : (
                  <div className="h-32 w-32 shrink-0 flex items-center justify-center bg-slate-100 dark:bg-[#0f1117]">
                    <Car className="h-10 w-10 text-slate-400 dark:text-[#94a3b8]" />
                  </div>
                )}
                <CardContent className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{c.car_name}</h3>
                    {(c.car_model || c.car_year) && (
                      <p className="text-sm text-slate-600 dark:text-[#94a3b8]">
                        {[c.car_model, c.car_year].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    {c.car_price != null && (
                      <p className="text-sm text-[#5B7FFF] mt-1">
                        ${Number(c.car_price).toLocaleString()}
                      </p>
                    )}
                    {c.description && (
                      <p className="text-xs text-slate-600 dark:text-[#94a3b8] mt-1 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      disabled={deletingId === c.id}
                      onClick={() => handleDelete(c.id)}
                    >
                      {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-slate-600 dark:text-[#94a3b8]">
        <Link href={`/${locale}`} className="text-[#5B7FFF] hover:underline">
          Back to Home
        </Link>
      </p>
    </div>
  )
}
