'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { defaultLocale } from '@/i18n'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { getUserFacingApiError } from '@/lib/getUserFacingApiError'
import { LoadingButton } from '@/components/common/LoadingButton'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GoogleIcon } from '@/components/GoogleIcon'
import { useAuth } from '@/hooks/use-auth'
import { useAuthContext } from '@/context/AuthContext'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginPageContent() {
  const [mounted, setMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [emailNotConfirmedFor, setEmailNotConfirmedFor] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tRoot = useTranslations()
  const locale = useLocale() || defaultLocale
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const returnUrl = searchParams?.get('returnUrl') || `/${locale}`
  const { user, loading: authLoading, login: loginUser } = useAuth()
  // Also check Supabase auth (used by Header) to handle Google sign-in
  const { user: supabaseUser, loading: supabaseLoading } = useAuthContext()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // If already logged in (via REST API OR Supabase), redirect to returnUrl
  useEffect(() => {
    const isLoggedIn = user || supabaseUser
    const isLoading = authLoading || supabaseLoading
    
    if (!isLoading && isLoggedIn) {
      console.log('[Login] User already authenticated, redirecting to:', returnUrl)
      console.log('[Login] REST API user:', !!user)
      console.log('[Login] Supabase user:', !!supabaseUser)
      router.replace(returnUrl)
    }
  }, [authLoading, supabaseLoading, user, supabaseUser, returnUrl, router])

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true)
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/${locale}/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`
          : undefined
      
      // Use Supabase for Google OAuth
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      
      if (error) {
        toast({ 
          title: tCommon('error'), 
          description: error.message || 'Google sign-in failed. Please try again.', 
          variant: 'destructive' 
        })
        return
      }
      // Browser navigates to Google; no further action needed
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed.'
      toast({ 
        title: tCommon('error'), 
        description: msg, 
        variant: 'destructive' 
      })
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleResend = async () => {
    // Email resend not yet implemented with REST API
    toast({ 
      title: tCommon('error'), 
      description: 'Email resend is not yet available. Please contact support.', 
      variant: 'destructive' 
    })
  }

  const onSubmit = async (data: LoginForm) => {
    try {
      console.log('========================================')
      console.log('[Login] ========== STARTING LOGIN ==========')
      console.log('[Login] Email:', data.email)
      console.log('[Login] Before login - localStorage:', {
        auth_token: localStorage.getItem('auth_token') ? 'EXISTS' : 'NULL',
        refresh_token: localStorage.getItem('refresh_token') ? 'EXISTS' : 'NULL'
      })
      
      // Call login
      const response = await loginUser(data.email, data.password, data.rememberMe || false)
      
      console.log('[Login] Login response received:', response)
      console.log('[Login] Response has token:', !!response?.token)
      console.log('[Login] Response token value:', response?.token ? response.token.substring(0, 30) + '...' : 'null')
      
      // CRITICAL: Check token immediately after login
      let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      console.log('[Login] Token check #1 (immediate):', !!token)
      
      // Wait and check again
      await new Promise((r) => setTimeout(r, 200))
      token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      console.log('[Login] Token check #2 (after 200ms):', !!token)
      
      // If still no token but response has one, save manually
      if (!token && response?.token) {
        console.log('[Login] ⚠️ Token missing! Manually saving from response...')
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', response.token)
          await new Promise((r) => setTimeout(r, 100))
          token = localStorage.getItem('auth_token')
          console.log('[Login] Manual save result:', !!token)
        }
      }
      
      // Final verification
      token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      console.log('[Login] Final token check:', !!token)
      console.log('[Login] Token value:', token ? token.substring(0, 30) + '...' : 'null')
      console.log('[Login] localStorage state:', {
        auth_token: localStorage.getItem('auth_token') ? 'EXISTS (' + localStorage.getItem('auth_token')!.substring(0, 20) + '...)' : 'NULL',
        refresh_token: localStorage.getItem('refresh_token') ? 'EXISTS' : 'NULL'
      })
      
      if (!token) {
        console.error('========================================')
        console.error('[Login] ❌ CRITICAL ERROR: TOKEN NOT SAVED!')
        console.error('[Login] Response:', JSON.stringify(response, null, 2))
        console.error('[Login] localStorage:', {
          auth_token: localStorage.getItem('auth_token'),
          refresh_token: localStorage.getItem('refresh_token'),
          allKeys: Object.keys(localStorage)
        })
        console.error('========================================')
        
        toast({ 
          title: tCommon('error'), 
          description: 'Login succeeded but token was not saved. Check console for details.', 
          variant: 'destructive',
          duration: 10000
        })
        return
      }

      console.log('[Login] ✅ LOGIN SUCCESS - Token saved!')
      console.log('========================================')
      
      toast({ title: tCommon('success'), description: 'Welcome back!' })

      // Wait longer to ensure everything is saved and auth state updates
      await new Promise((r) => setTimeout(r, 800))
      
      // Final check before redirect
      const finalToken = localStorage.getItem('auth_token')
      console.log('[Login] Pre-redirect token check:', !!finalToken)
      console.log('[Login] Redirecting to returnUrl:', returnUrl)
      
      if (!finalToken) {
        console.error('[Login] ❌ Token disappeared before redirect!')
        toast({ 
          title: tCommon('error'), 
          description: 'Token was lost. Please try logging in again.', 
          variant: 'destructive' 
        })
        return
      }
      
      // Use full page reload to ensure all hooks re-initialize with new token
      // This ensures favorites page can read the token
      if (typeof window !== 'undefined') {
        window.location.href = returnUrl
      } else {
        router.push(returnUrl)
        router.refresh()
      }
    } catch (e: any) {
      const lower = (e.message || '').toLowerCase()
      const msg =
        lower.includes('invalid') || lower.includes('incorrect') || lower.includes('credentials')
          ? "Incorrect email or password. If you're sure they're correct, try Forgot password to reset."
          : lower.includes('rate limit') || lower.includes('rate limit exceeded')
            ? 'Too many attempts. Please wait a few minutes before trying again.'
            : getUserFacingApiError(e, tRoot)
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    }
  }

  const getT = (key: string, fallback: string) => {
    try {
      return t(key as 'login') || fallback
    } catch {
      return fallback
    }
  }

  if (!mounted) {
    return (
      <AuthPageShell>
        <div className="text-slate-300">Loading...</div>
      </AuthPageShell>
    )
  }

  if (!authLoading && user) {
    return (
      <AuthPageShell>
        <div className="text-slate-300">Redirecting...</div>
      </AuthPageShell>
    )
  }

  return (
    <ErrorBoundary>
      <AuthPageShell>
        <Card className="auth-glass-card w-full max-w-md text-white shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-white">{getT('login', 'Login')}</CardTitle>
            <CardDescription className="text-[#94a3b8]">
              {getT('loginDescription', 'Sign in to your account')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">{getT('email', 'Email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8] rtl:left-auto rtl:right-3" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={getT('emailPlaceholder', 'Enter your email')}
                    className={cn(
                      'auth-glass-input ps-10',
                      errors.email ? '!border-red-500 focus-visible:!border-red-500' : ''
                    )}
                    {...register('email')}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-y-1">
                  <Label htmlFor="password" className="text-white">{getT('password', 'Password')}</Label>
                  <Link
                    href={`/${locale}/forgot-password`}
                    className="text-sm text-[#5B7FFF] hover:underline text-end"
                  >
                    {t('forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8] rtl:left-auto rtl:right-3" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={getT('passwordPlaceholder', 'Enter your password')}
                    className={cn(
                      'auth-glass-input ps-10 pe-10',
                      errors.password ? '!border-red-500 focus-visible:!border-red-500' : ''
                    )}
                    {...register('password')}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#94a3b8] hover:text-white rtl:right-auto rtl:left-3"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-400">{errors.password.message}</p>}
              </div>

              <div className="flex items-center gap-2 rtl:flex-row-reverse rtl:gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={!!watch('rememberMe')}
                  onCheckedChange={(c) => setValue('rememberMe', !!c)}
                  disabled={isSubmitting}
                  className="border-[#2a2d3a] shrink-0"
                />
                <Label htmlFor="rememberMe" className="text-sm text-[#94a3b8] cursor-pointer min-w-0">
                  {t('rememberMe')}
                </Label>
              </div>

              <LoadingButton
                type="submit"
                loading={isSubmitting}
                loadingText={getT('loggingIn', 'Logging in...')}
                className="w-full bg-gradient-to-r from-[#5B7FFF] to-purple-600 hover:from-[#4a6fe6] hover:to-purple-500 text-white font-semibold shadow-lg shadow-[#5B7FFF]/25"
              >
                {getT('login', 'Login')}
              </LoadingButton>

              {emailNotConfirmedFor && (
                <Alert className="mt-4 border-amber-500/50 bg-amber-500/10">
                  <AlertDescription className="text-[#94a3b8]">
                    Check your inbox and spam. If you didn’t get it,{' '}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-[#5B7FFF]"
                      onClick={handleResend}
                      disabled={isResending}
                    >
                      {isResending ? 'Sending…' : 'Resend verification email'}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#2a2d3a]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="auth-or-divider-label px-2 text-[#94a3b8]">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="auth-glass-social w-full h-11 font-medium"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isGoogleLoading}
            >
              <GoogleIcon className="mr-2 h-4 w-4 shrink-0" />
              {isGoogleLoading ? 'Redirecting…' : 'Sign in with Google'}
            </Button>

            <p className="mt-4 text-center text-sm text-[#94a3b8]">
              {getT('noAccount', "Don't have an account?")}{' '}
              <Link href={`/${locale}/register`} className="text-[#5B7FFF] hover:underline font-medium">
                {getT('register', 'Register')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </AuthPageShell>
    </ErrorBoundary>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <span className="text-slate-300">Loading…</span>
        </AuthPageShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
