"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  Bell,
  Wrench,
  Building2
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminInfo, setAdminInfo] = useState<{ name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const { toast } = useToast()

  const checkAuth = useCallback(async () => {
    try {
      const adminToken = localStorage.getItem('admin_token')
      if (!adminToken) {
        router.push(`/${locale}/admin/login`)
        return
      }
      const admin = await apiClient.getAdminMe()
      const storedInfo = localStorage.getItem('admin_info')
      if (storedInfo) {
        setAdminInfo(JSON.parse(storedInfo))
      } else {
        setAdminInfo({ name: admin.name, role: admin.role })
        localStorage.setItem('admin_info', JSON.stringify({ name: admin.name, role: admin.role }))
      }
      setLoading(false)
    } catch (error) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_info')
      router.push(`/${locale}/admin/login`)
    }
  }, [router, locale])

  useEffect(() => {
    // Skip auth check for login page
    if (pathname?.includes('/admin/login')) {
      setLoading(false)
      return
    }
    checkAuth()
  }, [pathname, checkAuth])

  const handleLogout = async () => {
    try {
      await apiClient.adminLogout()
    } catch (error) {
      // Ignore errors
    } finally {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_info')
      router.push(`/${locale}/admin/login`)
    }
  }

  const menuItems = [
    { href: `/${locale}/admin/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/${locale}/admin/feedback`, label: 'Feedback Management', icon: MessageSquare },
    { href: `/${locale}/admin/users`, label: 'User Management', icon: Users },
    { href: `/${locale}/admin/services`, label: 'Services Management', icon: Wrench },
    { href: `/${locale}/admin/services/providers`, label: 'Providers Management', icon: Building2 },
    { href: `/${locale}/admin/settings`, label: 'System Settings', icon: Settings },
    { href: `/${locale}/admin/reports`, label: 'Reports', icon: FileText },
  ]

  // For login page, render children without sidebar
  if (pathname?.includes('/admin/login')) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-blue-500" />
              <span className="text-white font-bold text-lg">Admin Panel</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="border-t border-gray-700 p-4">
            {adminInfo && (
              <div className="mb-4 px-4 py-2 bg-gray-700 rounded-lg">
                <p className="text-white text-sm font-medium">{adminInfo.name}</p>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {adminInfo.role.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            )}
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Top Header */}
        <header className="bg-gray-800 border-b border-gray-700 h-16 flex items-center justify-between px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center space-x-4">
            <button className="text-gray-400 hover:text-white relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
