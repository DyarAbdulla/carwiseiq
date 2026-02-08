"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient, getToken, removeToken } from '@/lib/api'

interface User {
  id: number
  email: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Refs to prevent infinite loops
  const checkingRef = useRef(false)
  const mountedRef = useRef(false)

  const checkAuth = useCallback(async () => {
    // Prevent multiple simultaneous checks
    if (checkingRef.current) {
      return
    }

    try {
      checkingRef.current = true

      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        setUser(null)
        setLoading(false)
        return
      }

      // Check Supabase session first (source of truth for Google sign-in)
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          // Supabase session exists - use it as source of truth
          setUser({
            id: 0, // Placeholder - Supabase users don't have REST API IDs
            email: session.user.email || ''
          })
          setLoading(false)
          return
        }
      } catch (supabaseError) {
        // Supabase check failed - continue to REST API check
      }

      // Fallback to REST API token (for email/password login)
      const token = getToken()
      
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const userData = await apiClient.getMe()
        
        // Validate userData structure
        if (userData && typeof userData === 'object' && userData.email) {
          setUser(userData)
        } else {
          throw new Error('Invalid user data received')
        }
      } catch (apiError: any) {
        // Only remove token if it's an auth error (401, 403), not network errors
        if (apiError?.response?.status === 401 || apiError?.response?.status === 403) {
          removeToken()
          setUser(null)
        }
      }
    } catch (error) {
      // Not authenticated or token expired
      if (typeof window !== 'undefined') {
        const token = getToken()
        // Only remove if token exists but verification failed
        if (token) {
          removeToken()
        }
      }
      setUser(null)
    } finally {
      setLoading(false)
      checkingRef.current = false
    }
  }, [])

  // Check auth ONLY once on mount, not on every pathname change
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      checkAuth()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once on mount

  // Check auth on window focus (user might have logged in another tab)
  // But only if not already checking and not recently checked
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocus = () => {
      // Only check if not already checking and enough time has passed
      if (!checkingRef.current) {
        checkAuth()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [checkAuth])

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required')
      }
      const response = await apiClient.login(email, password, rememberMe || false)
      
      if (response && response.user && typeof response.user === 'object') {
        setUser(response.user)
        // apiClient.login already called setToken(access_token); no extra /auth/me here
      } else {
        throw new Error('Invalid user data in response')
      }
      
      // Force re-check auth state to ensure consistency
      await checkAuth()
      
      return response
    } catch (error) {
      console.error('[useAuth.login] Login error:', error)
      throw error
    }
  }

  const register = async (
    email: string,
    password: string,
    confirmPassword: string,
    fullName?: string,
    termsAccepted: boolean = false
  ) => {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required')
      }
      const response = await apiClient.register(email, password, confirmPassword, fullName, termsAccepted)
      if (response && response.user && typeof response.user === 'object') {
        setUser(response.user)
        // apiClient.register already called setToken(access_token); no extra /auth/me here
      }
      return response
    } catch (error) {
      console.error('Register error:', error)
      throw error
    }
  }

  const verify = async () => {
    try {
      if (typeof window === 'undefined') {
        return false
      }
      const response = await apiClient.verifyToken()
      if (response && response.valid && response.user && typeof response.user === 'object') {
        setUser(response.user)
        return true
      }
      return false
    } catch (error) {
      console.error('Verify error:', error)
      setUser(null)
      return false
    }
  }

  const logout = async () => {
    try {
      // Clear user state immediately
      setUser(null)
      if (typeof window !== 'undefined') {
        await apiClient.logout()
        removeToken()
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still clear user even if API call fails
      setUser(null)
      if (typeof window !== 'undefined') {
        removeToken()
      }
    }
  }

  return {
    user,
    loading,
    login,
    register,
    logout,
    checkAuth,
    verify,
    isAuthenticated: !!user,
  }
}









