'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Mail, Lock, Eye, EyeOff, User, Phone, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { LoadingButton } from '@/components/common/LoadingButton'
import { PasswordStrength } from '@/components/common/PasswordStrength'
import { GoogleIcon } from '@/components/GoogleIcon'
import { motion, AnimatePresence } from 'framer-motion'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

const registerSchema = z
  .object({
    full_name: z.string().optional(),
    email: z.string().email('Please enter a valid email address'),
    phone_number: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must not exceed 72 characters')
      .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter')
      .refine((p) => /[0-9]/.test(p), 'Password must contain at least one number')
      .refine((p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), 'Password must contain at least one special character'),
    confirmPassword: z.string(),
    terms_accepted: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnUrl?: string
  defaultTab?: 'signin' | 'register'
}

export function AuthModal({ open, onOpenChange, returnUrl, defaultTab = 'signin' }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>(defaultTab)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [emailNotConfirmedFor, setEmailNotConfirmedFor] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const locale = useLocale() || 'en'
  const router = useRouter()
  const { toast } = useToast()

  const resolvedReturnUrl = returnUrl || (typeof window !== 'undefined' ? `${window.location.origin}/${locale}` : `/${locale}`)

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: { terms_accepted: false },
  })

  const password = registerForm.watch('password')

  useEffect(() => {
    if (open) setActiveTab(defaultTab)
  }, [open, defaultTab])

  const getT = useCallback((key: string, fallback: string) => {
    try { return t(key as 'login') || fallback } catch { return fallback }
  }, [t])

  const handleGoogleSignIn = async (isRegister: boolean) => {
    try {
      setIsGoogleLoading(true)
      const afterAuth = `/${locale}`
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/auth/callback?returnUrl=${encodeURIComponent(afterAuth)}`
        : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) {
        toast({ title: tCommon('error'), description: error.message, variant: 'destructive' })
        return
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (isRegister ? 'Google sign-up failed.' : 'Google sign-in failed.')
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleResend = async () => {
    if (!emailNotConfirmedFor) return
    setIsResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: emailNotConfirmedFor })
    setIsResending(false)
    if (error) {
      const m = (error.message ?? '').toLowerCase()
      const msg = m.includes('rate limit') || m.includes('rate limit exceeded')
        ? 'Too many resend attempts. Wait a few minutes.'
        : error.message
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
      return
    }
    toast({ title: tCommon('success'), description: 'Verification email sent. Check your inbox and spam folder.' })
    setEmailNotConfirmedFor(null)
  }

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        let msg = error.message
        const lower = msg?.toLowerCase() ?? ''
        if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
          msg = "Incorrect email or password. If you're sure they're correct, try Forgot password to reset."
          setEmailNotConfirmedFor(null)
        } else if (lower.includes('email not confirmed')) {
          msg = 'Please confirm your email first. Check your inbox (and spam) for the verification link. You can resend it below.'
          setEmailNotConfirmedFor(data.email)
        } else if (lower.includes('rate limit') || lower.includes('rate limit exceeded')) {
          msg = 'Too many attempts. Wait a few minutes.'
          setEmailNotConfirmedFor(null)
        } else {
          setEmailNotConfirmedFor(null)
        }
        toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
        return
      }

      toast({ title: tCommon('success'), description: 'Welcome back!' })
      onOpenChange(false)
      if (typeof window !== 'undefined') {
        window.location.href = resolvedReturnUrl
      } else {
        router.push(resolvedReturnUrl)
        router.refresh()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (t('loginError') || 'Login failed.')
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    }
  }

  const onRegisterSubmit = async (data: RegisterForm) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: (data.full_name ?? '').trim() || undefined,
            phone_number: (data.phone_number ?? '').trim() || undefined,
          },
        },
      })

      if (error) {
        let msg = error.message
        const lower = error.message?.toLowerCase() ?? ''
        if (lower.includes('already registered')) {
          msg = 'An account with this email already exists. Try logging in.'
        } else if (lower.includes('email rate limit exceeded') || lower.includes('rate limit')) {
          msg = 'Email rate limit reached. Wait about an hour or set up custom SMTP in Supabase.'
        }
        toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
        return
      }

      toast({
        title: tCommon('success'),
        description: authData?.user?.identities?.length === 0
          ? 'Account created! Please check your email to verify your account.'
          : 'Account created! Welcome!',
      })
      onOpenChange(false)
      router.push(`/${locale}`)
      router.refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (t('registerError') || 'Registration failed')
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-md:fixed max-md:inset-0 max-md:translate-x-0 max-md:translate-y-0 max-md:max-w-none max-md:max-h-none
          max-md:w-full max-md:h-[100dvh] max-md:rounded-none max-md:p-4 max-md:overflow-y-auto
          md:max-w-lg md:max-h-[90vh] md:overflow-y-auto
          border-[#2a2d3a] bg-slate-900/95 dark:bg-[#1a1d29]/95 backdrop-blur-xl shadow-2xl
          [&>button:last-of-type]:hidden
        `}
      >
        {/* Custom close: min 44px for touch, only our close is visible */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#1a1d29]"
          aria-label={tCommon('close')}
        >
          <X className="h-5 w-5" />
        </button>

        <DialogHeader className="pr-12">
          <DialogTitle className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            {getT('accountTitle', 'Account')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'register')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-white/5 border border-white/10 rounded-xl mb-4">
            <TabsTrigger
              value="signin"
              className="rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              {getT('signIn', 'Sign In')}
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              {getT('createAccount', 'Create Account')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <AnimatePresence mode="wait">
              <motion.div
                key="signin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="auth-email" className="text-slate-200 text-sm">{getT('email', 'Email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 rtl:left-auto rtl:right-3" />
                      <Input
                        id="auth-email"
                        type="email"
                        placeholder={getT('emailPlaceholder', 'Enter your email')}
                        className={`pl-10 pr-4 min-h-[44px] text-base border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 ${
                          loginForm.formState.errors.email ? 'border-red-500' : ''
                        }`}
                        {...loginForm.register('email')}
                        disabled={loginForm.formState.isSubmitting}
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-red-400">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-y-1">
                      <Label htmlFor="auth-password" className="text-slate-200 text-sm">{getT('password', 'Password')}</Label>
                      <Link
                        href={`/${locale}/forgot-password`}
                        onClick={() => onOpenChange(false)}
                        className="text-sm text-indigo-400 hover:underline"
                      >
                        {t('forgotPassword')}
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 rtl:left-auto rtl:right-3" />
                      <Input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={getT('passwordPlaceholder', 'Enter your password')}
                        className={`pl-10 pr-12 min-h-[44px] text-base border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 ${
                          loginForm.formState.errors.password ? 'border-red-500' : ''
                        }`}
                        {...loginForm.register('password')}
                        disabled={loginForm.formState.isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white rtl:right-auto rtl:left-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-400">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="auth-remember"
                      checked={!!loginForm.watch('rememberMe')}
                      onCheckedChange={(c) => loginForm.setValue('rememberMe', !!c)}
                      disabled={loginForm.formState.isSubmitting}
                      className="border-white/20 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                    <Label htmlFor="auth-remember" className="text-sm text-slate-400 cursor-pointer">
                      {t('rememberMe')}
                    </Label>
                  </div>

                  <LoadingButton
                    type="submit"
                    loading={loginForm.formState.isSubmitting}
                    loadingText={getT('loggingIn', 'Logging in...')}
                    className="w-full min-h-[44px] text-base font-medium bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl"
                  >
                    {getT('login', 'Login')}
                  </LoadingButton>

                  {emailNotConfirmedFor && (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <AlertDescription className="text-slate-300 text-sm">
                        Check your inbox and spam.{' '}
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-indigo-400"
                          onClick={handleResend}
                          disabled={isResending}
                        >
                          {isResending ? 'Sending…' : 'Resend verification email'}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900/95 px-2 text-slate-500">{getT('orContinueWith', 'Or continue with')}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-[44px] text-base border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => handleGoogleSignIn(false)}
                  disabled={loginForm.formState.isSubmitting || isGoogleLoading}
                >
                  <GoogleIcon className="mr-2 h-4 w-4 shrink-0" />
                  {isGoogleLoading ? 'Redirecting…' : 'Sign in with Google'}
                </Button>

                <p className="text-center text-sm text-slate-400 pt-2">
                  {getT('noAccount', "Don't have an account?")}{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="text-indigo-400 hover:underline font-medium"
                  >
                    {getT('createOne', 'Create one')}
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="register" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <AnimatePresence mode="wait">
              <motion.div
                key="register"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="auth-fullname" className="text-slate-200 text-sm">{getT('fullNameOptional', 'Full Name (optional)')}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 rtl:left-auto rtl:right-3" />
                      <Input
                        id="auth-fullname"
                        type="text"
                        placeholder={t('fullNamePlaceholder')}
                        className="pl-10 pr-4 min-h-[44px] text-base border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                        {...registerForm.register('full_name')}
                        disabled={registerForm.formState.isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auth-reg-email" className="text-slate-200 text-sm">{getT('email', 'Email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 rtl:left-auto rtl:right-3" />
                      <Input
                        id="auth-reg-email"
                        type="email"
                        placeholder={getT('emailPlaceholder', 'Enter your email')}
                        className={`pl-10 pr-4 min-h-[44px] text-base border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 ${
                          registerForm.formState.errors.email ? 'border-red-500' : ''
                        }`}
                        {...registerForm.register('email')}
                        disabled={registerForm.formState.isSubmitting}
                      />
                    </div>
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-400">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auth-phone" className="text-slate-200 text-sm">Phone number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 rtl:left-auto rtl:right-3" />
                      <Input
                        id="auth-phone"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        className="pl-10 pr-4 min-h-[44px] text-base border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                        {...registerForm.register('phone_number')}
                        disabled={registerForm.formState.isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auth-reg-password" className="text-slate-200 text-sm">{getT('password', 'Password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 rtl:left-auto rtl:right-3" />
                      <Input
                        id="auth-reg-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={getT('passwordPlaceholder', 'Enter your password')}
                        className={`pl-10 pr-12 min-h-[44px] text-base border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 ${
                          registerForm.formState.errors.password ? 'border-red-500' : ''
                        }`}
                        {...registerForm.register('password')}
                        disabled={registerForm.formState.isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white rtl:right-auto rtl:left-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {registerForm.formState.errors.password && (
                      <p className="text-sm text-red-400">{registerForm.formState.errors.password.message}</p>
                    )}
                    {password && <PasswordStrength password={password} className="mt-2" />}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auth-confirm" className="text-slate-200 text-sm">{getT('confirmPassword', 'Confirm Password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 rtl:left-auto rtl:right-3" />
                      <Input
                        id="auth-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder={getT('confirmPasswordPlaceholder', 'Confirm your password')}
                        className={`pl-10 pr-12 min-h-[44px] text-base border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 ${
                          registerForm.formState.errors.confirmPassword ? 'border-red-500' : ''
                        }`}
                        {...registerForm.register('confirmPassword')}
                        disabled={registerForm.formState.isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white rtl:right-auto rtl:left-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-400">{registerForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="auth-terms"
                      checked={!!registerForm.watch('terms_accepted')}
                      onCheckedChange={(c) => registerForm.setValue('terms_accepted', !!c)}
                      disabled={registerForm.formState.isSubmitting}
                      className="border-white/20 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 mt-1"
                    />
                    <Label htmlFor="auth-terms" className="text-sm text-slate-400 cursor-pointer leading-relaxed">
                      {t('termsAcceptPrefix')}
                      <Link href={`/${locale}/terms`} className="text-indigo-400 hover:underline" target="_blank">
                        {t('termsOfService')}
                      </Link>
                      {t('termsAnd')}
                      <Link href={`/${locale}/privacy`} className="text-indigo-400 hover:underline" target="_blank">
                        {t('privacyPolicy')}
                      </Link>
                    </Label>
                  </div>
                  {registerForm.formState.errors.terms_accepted && (
                    <p className="text-sm text-red-400">{registerForm.formState.errors.terms_accepted.message}</p>
                  )}

                  <LoadingButton
                    type="submit"
                    loading={registerForm.formState.isSubmitting}
                    loadingText={getT('registering', 'Creating account...')}
                    className="w-full min-h-[44px] text-base font-medium bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl"
                  >
                    {getT('register', 'Register')}
                  </LoadingButton>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900/95 px-2 text-slate-500">{getT('orContinueWith', 'Or continue with')}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-[44px] text-base border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => handleGoogleSignIn(true)}
                  disabled={registerForm.formState.isSubmitting || isGoogleLoading}
                >
                  <GoogleIcon className="mr-2 h-4 w-4 shrink-0" />
                  {isGoogleLoading ? 'Redirecting…' : 'Sign up with Google'}
                </Button>

                <p className="text-center text-sm text-slate-400 pt-2">
                  {getT('hasAccount', 'Already have an account?')}{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('signin')}
                    className="text-indigo-400 hover:underline font-medium"
                  >
                    {getT('signIn', 'Sign in')}
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
