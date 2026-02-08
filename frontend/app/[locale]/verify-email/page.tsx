"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export default function VerifyEmailPage() {
  const router = useRouter()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    const token = searchParams?.get('token')
    const emailParam = searchParams?.get('email')
    
    if (emailParam) {
      setEmail(emailParam)
    }

    if (token) {
      verifyEmail(token)
    }
  }, [searchParams])

  const verifyEmail = async (token: string) => {
    setVerifying(true)
    try {
      await apiClient.verifyEmail(token)
      setVerified(true)
      toast({
        title: 'Email verified!',
        description: 'Your email has been verified successfully'
      })
      setTimeout(() => {
        router.push(`/${locale}`)
      }, 2000)
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired verification token',
        variant: 'destructive'
      })
    } finally {
      setVerifying(false)
    }
  }

  const resendVerification = async () => {
    if (!email) {
      toast({
        title: 'Error',
        description: 'Email address is required',
        variant: 'destructive'
      })
      return
    }

    setResending(true)
    try {
      await apiClient.resendVerification(email)
      toast({
        title: 'Verification email sent',
        description: 'Please check your email for the verification link'
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend verification email',
        variant: 'destructive'
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
      <Card className="w-full max-w-md border-[#2a2d3a] bg-[#1a1d29] text-white">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            {verified ? (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            ) : verifying ? (
              <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
            ) : (
              <Mail className="h-16 w-16 text-blue-500" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {verified ? 'Email Verified!' : verifying ? 'Verifying...' : 'Verify Your Email'}
          </CardTitle>
          <CardDescription className="text-[#94a3b8]">
            {verified
              ? 'Your email has been verified successfully. Redirecting...'
              : verifying
              ? 'Please wait while we verify your email...'
              : 'Please check your email and click the verification link'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {email && !verified && !verifying && (
            <>
              <p className="text-sm text-[#94a3b8] text-center">
                Didn't receive the email? Check your spam folder or resend the verification link.
              </p>
              <Button
                onClick={resendVerification}
                disabled={resending}
                variant="outline"
                className="w-full border-gray-600 text-gray-300"
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
            </>
          )}
          <Button
            onClick={() => router.push(`/${locale}`)}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
