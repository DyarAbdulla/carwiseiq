"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { LoadingButton } from '@/components/common/LoadingButton'
import { PasswordStrength } from '@/components/common/PasswordStrength'

export default function ResetPasswordPage() {
  const router = useRouter()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const tokenParam = searchParams?.get('token')
    if (tokenParam) {
      setToken(tokenParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)
    try {
      await apiClient.resetPassword(token, password, confirmPassword)
      setSuccess(true)
      toast({
        title: 'Password reset successful',
        description: 'Your password has been reset. Redirecting to login...'
      })
      setTimeout(() => {
        router.push(`/${locale}/login`)
      }, 2000)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
        <Card className="w-full max-w-md border-[#2a2d3a] bg-[#1a1d29] text-white">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-green-500">
              Password Reset Successful!
            </CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Redirecting to login...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
      <Card className="w-full max-w-md border-[#2a2d3a] bg-[#1a1d29] text-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">
            Reset Password
          </CardTitle>
          <CardDescription className="text-[#94a3b8]">
            Enter your new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8]" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 border-[#2a2d3a] bg-[#0f1117] text-white"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#94a3b8]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && <PasswordStrength password={password} />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8]" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 border-[#2a2d3a] bg-[#0f1117] text-white"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-[#94a3b8]"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <LoadingButton
              type="submit"
              loading={submitting}
              loadingText="Resetting..."
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Reset Password
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
