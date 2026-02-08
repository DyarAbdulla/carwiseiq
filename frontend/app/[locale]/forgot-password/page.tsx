"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { LoadingButton } from '@/components/common/LoadingButton'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const locale = useLocale()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await apiClient.forgotPassword(email)
      setSent(true)
      toast({
        title: 'Reset link sent',
        description: 'If the email exists, a password reset link has been sent'
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reset link',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
      <Card className="w-full max-w-md border-[#2a2d3a] bg-[#1a1d29] text-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">
            Forgot Password
          </CardTitle>
          <CardDescription className="text-[#94a3b8]">
            {sent
              ? 'Check your email for the reset link'
              : 'Enter your email to receive a password reset link'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-[#94a3b8]">
                If an account with that email exists, we've sent a password reset link.
                Please check your inbox and spam folder.
              </p>
              <Button
                onClick={() => {
                  setSent(false)
                  setEmail('')
                }}
                variant="outline"
                className="w-full border-gray-600 text-gray-300"
              >
                Send Another Email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-[#2a2d3a] bg-[#0f1117] text-white"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <LoadingButton
                type="submit"
                loading={submitting}
                loadingText="Sending..."
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Send Reset Link
              </LoadingButton>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link
              href={`/${locale}/login`}
              className="text-sm text-[#5B7FFF] hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
