'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { apiClient, setToken } from '@/lib/api'

function isAbortError(e: unknown): boolean {
  return (e instanceof Error && e.name === 'AbortError') ||
    (typeof e === 'object' && e !== null && (e as DOMException).name === 'AbortError')
}

// Sync Supabase token with REST API system
async function syncSupabaseTokenToRestAPI(supabaseToken: string) {
  try {
    console.log('[AuthCallback] ========== SYNCING SUPABASE TOKEN ==========')
    console.log('[AuthCallback] Supabase token received:', !!supabaseToken)
    
    // Save Supabase token to localStorage so REST API can use it
    // Note: This is a temporary solution - ideally we'd exchange Supabase token for REST API token
    if (typeof window !== 'undefined' && supabaseToken) {
      setToken(supabaseToken)
      console.log('[AuthCallback] ✅ Token saved using setToken()')
      
      // Verify it was saved
      const saved = localStorage.getItem('auth_token')
      console.log('[AuthCallback] Token verification:', !!saved)
      
      // Try to verify with REST API (may fail if backend doesn't accept Supabase tokens)
      try {
        const userData = await apiClient.getMe()
        console.log('[AuthCallback] ✅ User verified with REST API:', userData.email)
      } catch (error: any) {
        console.warn('[AuthCallback] ⚠️ Could not verify with REST API:', error.message)
        console.warn('[AuthCallback] Supabase token saved, but REST API may not accept it')
        console.warn('[AuthCallback] This is expected if backend uses different auth system')
      }
    }
  } catch (error) {
    console.error('[AuthCallback] ❌ Error syncing token:', error)
  }
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale() || 'en'
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Fallback to home (/{locale}) if no returnUrl or empty
    const returnUrl = searchParams?.get('returnUrl')?.trim() || `/${locale}`
    
    console.log('[AuthCallback] returnUrl:', returnUrl)

    const finish = async () => {
      // Wait a bit to ensure token is fully saved
      await new Promise((r) => setTimeout(r, 500))
      console.log('[AuthCallback] Redirecting to:', returnUrl)
      // Use full page reload to ensure auth hooks re-initialize
      if (typeof window !== 'undefined') {
        window.location.href = returnUrl
      } else {
        router.replace(returnUrl)
      }
    }

    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          console.log('[AuthCallback] Session found immediately')
          // Sync Supabase token with REST API system
          await syncSupabaseTokenToRestAPI(session.access_token)
          await finish()
          return
        }

        try {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
            try {
              if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && s) {
                console.log('[AuthCallback] Auth state changed:', event)
                // Sync Supabase token with REST API system
                await syncSupabaseTokenToRestAPI(s.access_token)
                sub?.unsubscribe()
                await finish()
              }
            } catch (err) {
              if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'Auth state error')
            }
          })
          sub = subscription
        } catch (e) {
          if (isAbortError(e)) finish()
          else setError(e instanceof Error ? e.message : 'Sign-in failed')
          return
        }

        timeoutId = setTimeout(async () => {
          try {
            const { data: { session: s2 } } = await supabase.auth.getSession()
            if (s2) {
              console.log('[AuthCallback] Session found in timeout')
              // Sync Supabase token with REST API system
              await syncSupabaseTokenToRestAPI(s2.access_token)
              sub?.unsubscribe()
              await finish()
            }
          } catch (err) {
            if (isAbortError(err)) finish()
            else setError(err instanceof Error ? err.message : 'Sign-in failed')
          }
        }, 1000)
      } catch (e) {
        if (isAbortError(e)) finish()
        else setError(e instanceof Error ? e.message : 'Sign-in failed')
      }
    }

    run().catch((e) => {
      if (!isAbortError(e)) setError(e instanceof Error ? e.message : 'Sign-in failed')
    })
    return () => {
      sub?.unsubscribe()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [router, searchParams, locale])

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
        <div className="text-center text-[#94a3b8]">
          <p className="text-red-400 mb-4">{error}</p>
          <a href={`/${locale}/login`} className="text-[#5B7FFF] hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-6 bg-[#0f1117]">
      <div className="text-[#94a3b8]">Completing sign in…</div>
    </div>
  )
}
