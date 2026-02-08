'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { User as AuthUser, Session as AuthSession } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/database.types'

type AuthContextValue = {
  user: AuthUser | null
  session: AuthSession | null
  role: UserRole | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchRole = useCallback(async (userId: string): Promise<UserRole | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null
    const row = data as { role: UserRole }
    return row.role ?? null
  }, [])

  const syncAuth = useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !currentSession) {
        setSession(null)
        setUser(null)
        setRole(null)
        return
      }

      setSession(currentSession)
      setUser(currentSession.user)
      setLoading(false)
      try {
        const userRole = await fetchRole(currentSession.user.id)
        setRole(userRole)
      } catch {
        setRole(null)
      }
    } catch {
      setSession(null)
      setUser(null)
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [fetchRole])

  useEffect(() => {
    syncAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        setSession(null)
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }
      setSession(nextSession)
      setUser(nextSession.user)
      try {
        const userRole = await fetchRole(nextSession.user.id)
        setRole(userRole)
      } finally {
        setLoading(false)
      }
    })

    // Safety: if getSession or sync hangs, stop showing loading after 8s
    const timeoutId = setTimeout(() => {
      setLoading((prev) => (prev ? false : prev))
    }, 8000)

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [syncAuth, fetchRole])

  const signOut = useCallback(async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setRole(null)
    setLoading(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      role,
      isAdmin: role === 'admin',
      loading,
      signOut,
    }),
    [user, session, role, loading, signOut]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return ctx
}
