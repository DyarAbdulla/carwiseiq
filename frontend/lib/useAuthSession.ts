"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

interface AuthSessionState {
  session: { user: User } | null
  sessionLoaded: boolean
  user: User | null
}

// Global singleton store to prevent duplicate initialization
let globalSessionState: AuthSessionState = {
  session: null,
  sessionLoaded: false,
  user: null,
}

let globalListeners: Set<() => void> = new Set()
let isInitialized = false
let authSubscription: { unsubscribe: () => void } | null = null

const notifyListeners = () => {
  globalListeners.forEach((listener) => listener())
}

let initPromise: Promise<void> | null = null

const initializeAuth = async (): Promise<void> => {
  // If already initialized, return immediately
  if (isInitialized) return

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise
  }

  // Start initialization
  initPromise = (async () => {
    if (isInitialized) return

    isInitialized = true

    // CRITICAL: Load initial session immediately - this MUST complete
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('[useAuthSession] getSession error:', error)
      }

      // ALWAYS set sessionLoaded to true, even on error
      globalSessionState = {
        session: session ? { user: session.user } : null,
        sessionLoaded: true,
        user: session?.user || null,
      }
      notifyListeners()
    } catch (error) {
      console.error('[useAuthSession] getSession exception:', error)
      // CRITICAL: Always set sessionLoaded to true, even on exception
      globalSessionState = {
        session: null,
        sessionLoaded: true,
        user: null,
      }
      notifyListeners()
    }

    // Subscribe to auth state changes (non-blocking listener)
    authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
      globalSessionState = {
        session: session ? { user: session.user } : null,
        sessionLoaded: true,
        user: session?.user || null,
      }
      notifyListeners()
    }).data.subscription

    // Refresh session on window focus/visibility change (handles tab switching)
    const handleFocus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        globalSessionState = {
          session: session ? { user: session.user } : null,
          sessionLoaded: true,
          user: session?.user || null,
        }
        notifyListeners()
      } catch (error) {
        console.error('[useAuthSession] Focus refresh error:', error)
      }
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await handleFocus()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (authSubscription) {
        authSubscription.unsubscribe()
        authSubscription = null
      }
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  })()

  return initPromise
}

/**
 * Deterministic auth session hook
 * - Always resolves sessionLoaded (never stuck)
 * - Single source of truth for session state
 * - Handles tab switching and visibility changes
 * - No timeouts or race conditions
 */
export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>(globalSessionState)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Subscribe to global state changes
    const listener = () => {
      if (mountedRef.current) {
        setState({ ...globalSessionState })
      }
    }

    globalListeners.add(listener)

    // Initialize auth if not already done - await to ensure sessionLoaded is set
    initializeAuth().then(() => {
      // After initialization completes, update state
      if (mountedRef.current) {
        setState({ ...globalSessionState })
      }
    }).catch((error) => {
      console.error('[useAuthSession] Initialization error:', error)
      // Even on error, ensure sessionLoaded is true
      if (mountedRef.current) {
        setState({ ...globalSessionState })
      }
    })

    // Set initial state immediately (may be false initially, but will update)
    if (mountedRef.current) {
      setState({ ...globalSessionState })
    }

    return () => {
      globalListeners.delete(listener)
    }
  }, [])

  // Manual refresh function (for explicit refresh needs)
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      globalSessionState = {
        session: session ? { user: session.user } : null,
        sessionLoaded: true,
        user: session?.user || null,
      }
      notifyListeners()
    } catch (error) {
      console.error('[useAuthSession] Manual refresh error:', error)
    }
  }, [])

  return {
    session: state.session,
    user: state.user,
    sessionLoaded: state.sessionLoaded,
    isAuthenticated: !!state.user,
    refreshSession,
  }
}
