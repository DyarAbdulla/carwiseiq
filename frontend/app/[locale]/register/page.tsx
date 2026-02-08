'use client'
export const runtime = 'edge';

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { PasswordStrength } from '@/components/common/PasswordStrength'
import { LoadingButton } from '@/components/common/LoadingButton'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Mail, Lock, Eye, EyeOff, User, Phone, Car } from 'lucide-react'
import Link from 'next/link'
import { GoogleIcon } from '@/components/GoogleIcon'

const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
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

type RegisterForm = z.infer<typeof registerSchema>

const SELL_REASON_MESSAGE = 'Create account to sell your car'

export default function RegisterPage() {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const locale = useLocale() || 'en'
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const isSellReason = searchParams?.get('reason') === 'sell'
  const returnUrl = searchParams?.get('returnUrl') || (isSellReason ? `/${locale}/sell-car` : `/${locale}`)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: { terms_accepted: false },
  })

  const password = watch('password')

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true)
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/${locale}/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`
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
      const msg = e instanceof Error ? e.message : 'Google sign-up failed.'
      toast({ title: tCommon('error'), description: msg, variant: 'destructive' })
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const onSubmit = async (data: RegisterForm) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name.trim(),
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
          msg = 'Email rate limit reached (too many signups). Wait about an hour, or set up custom SMTP in Supabase: Authentication → Notifications.'
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

      router.push(returnUrl)
      router.refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (t('registerError') || 'Registration failed')
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

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
      <Card className="w-full max-w-md border-[#2a2d3a] bg-[#1a1d29] text-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-white">{getT('register', 'Register')}</CardTitle>
          <CardDescription className="text-[#94a3b8]">
            {getT('registerDescription', 'Create a new account to save cars and comparisons')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSellReason && (
            <Alert variant="info" className="mb-4">
              <Car className="h-4 w-4" />
              <AlertTitle>Sell your car</AlertTitle>
              <AlertDescription>{SELL_REASON_MESSAGE}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-white">{getT('fullNameOptional', 'Full name')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8] rtl:left-auto rtl:right-3" />
                <Input
                  id="full_name"
                  type="text"
                  placeholder={t('fullNamePlaceholder')}
                  className={`ps-10 border-[#2a2d3a] bg-[#0f1117] text-white placeholder:text-[#94a3b8] ${
                    errors.full_name ? 'border-red-500 focus:border-red-500' : 'focus:border-[#5B7FFF]'
                  }`}
                  {...register('full_name')}
                  disabled={isSubmitting}
                />
              </div>
              {errors.full_name && <p className="text-sm text-red-400">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">{getT('email', 'Email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8] rtl:left-auto rtl:right-3" />
                <Input
                  id="email"
                  type="email"
                  placeholder={getT('emailPlaceholder', 'Enter your email')}
                  className={`ps-10 border-[#2a2d3a] bg-[#0f1117] text-white placeholder:text-[#94a3b8] ${
                    errors.email ? 'border-red-500 focus:border-red-500' : 'focus:border-[#5B7FFF]'
                  }`}
                  {...register('email')}
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number" className="text-white">Phone number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8] rtl:left-auto rtl:right-3" />
                <Input
                  id="phone_number"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  className="ps-10 border-[#2a2d3a] bg-[#0f1117] text-white placeholder:text-[#94a3b8] focus:border-[#5B7FFF]"
                  {...register('phone_number')}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">{getT('password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8] rtl:left-auto rtl:right-3" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={getT('passwordPlaceholder', 'Enter your password')}
                  className={`ps-10 pe-10 border-[#2a2d3a] bg-[#0f1117] text-white placeholder:text-[#94a3b8] ${
                    errors.password ? 'border-red-500 focus:border-red-500' : 'focus:border-[#5B7FFF]'
                  }`}
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
              {password && <PasswordStrength password={password} className="mt-2" />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">{getT('confirmPassword', 'Confirm password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8] rtl:left-auto rtl:right-3" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={getT('confirmPasswordPlaceholder', 'Confirm your password')}
                  className={`ps-10 pe-10 border-[#2a2d3a] bg-[#0f1117] text-white placeholder:text-[#94a3b8] ${
                    errors.confirmPassword ? 'border-red-500 focus:border-red-500' : 'focus:border-[#5B7FFF]'
                  }`}
                  {...register('confirmPassword')}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-[#94a3b8] hover:text-white rtl:right-auto rtl:left-3"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={!!watch('terms_accepted')}
                onCheckedChange={(c) => setValue('terms_accepted', !!c)}
                disabled={isSubmitting}
                className="border-[#2a2d3a] mt-1"
              />
              <Label htmlFor="terms" className="text-sm text-[#94a3b8] cursor-pointer leading-relaxed">
                {t('termsAcceptPrefix')}
                <Link href={`/${locale}/terms`} className="text-[#5B7FFF] hover:underline" target="_blank">
                  {t('termsOfService')}
                </Link>
                {t('termsAnd')}
                <Link href={`/${locale}/privacy`} className="text-[#5B7FFF] hover:underline" target="_blank">
                  {t('privacyPolicy')}
                </Link>
              </Label>
            </div>
            {errors.terms_accepted && <p className="text-sm text-red-400">{errors.terms_accepted.message}</p>}

            <LoadingButton
              type="submit"
              loading={isSubmitting}
              loadingText={getT('registering', 'Creating account...')}
              className="w-full bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 text-white"
            >
              {getT('register', 'Register')}
            </LoadingButton>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#2a2d3a]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1a1d29] px-2 text-[#94a3b8]">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-[#2a2d3a] bg-[#0f1117] text-white hover:bg-[#2a2d3a]"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isGoogleLoading}
          >
            <GoogleIcon className="mr-2 h-4 w-4 shrink-0" />
            {isGoogleLoading ? 'Redirecting…' : 'Sign up with Google'}
          </Button>

          <p className="mt-4 text-center text-sm text-[#94a3b8]">
            {getT('hasAccount', 'Already have an account?')}{' '}
            <Link href={`/${locale}/login`} className="text-[#5B7FFF] hover:underline font-medium">
              {getT('login', 'Login')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
