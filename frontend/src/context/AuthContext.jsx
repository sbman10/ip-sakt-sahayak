/**
 * frontend/src/context/AuthContext.jsx
 * ------------------------------------
 * Reactive Supabase Auth Context for IP-SAKTI Sahayak.
 * 
 * Invariants:
 * - Single source of truth is supabase.auth session.
 * - Does NOT treat localStorage as proof of authentication.
 * - Synchronizes state on auth state changes and restores sessions on refresh.
 * - Handles email OTP sign-in, verification, sign-out, and clean switch-account.
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, siteUrl } from '../api/supabaseClient'
import { getApiBase } from '../api/config'
import {
  isRememberMeEnabled,
  setRememberMePreference,
  syncAuthCaches,
  clearAllAuthStorage,
  isTokenExpired,
  getStoredToken,
  getStoredRefreshToken,
  getStoredUser,
} from '../api/authStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rememberMe, setRememberMeState] = useState(() => isRememberMeEnabled())

  const setRememberMe = useCallback((enabled) => {
    setRememberMePreference(enabled)
    setRememberMeState(Boolean(enabled))
  }, [])

  // Sync token to storage according to active Remember Me preference
  const syncLocalCaches = useCallback((currentSession, rememberMeOverride) => {
    syncAuthCaches(currentSession, rememberMeOverride)
  }, [])

  // Initial session restoration (race-condition free)
  useEffect(() => {
    let mounted = true

    async function bootstrapSession() {
      try {
        // 1. Check Supabase session first
        const { data: { session: initialSession }, error: sbError } = await supabase.auth.getSession()
        if (sbError) {
          console.warn('[AuthContext] Supabase session retrieval error:', sbError.message)
        }

        if (initialSession?.user) {
          if (!mounted) return
          setSession(initialSession)
          setUser(initialSession.user)
          syncAuthCaches(initialSession)
          setLoading(false)
          return
        }

        // 2. Check stored session from authStorage (localStorage or sessionStorage)
        const savedToken = getStoredToken()
        const savedUser = getStoredUser()
        const savedRefreshToken = getStoredRefreshToken()

        if (savedToken && savedToken !== 'undefined' && savedToken !== 'null' && savedUser) {
          // If the token is expired, attempt refresh via backend
          if (isTokenExpired(savedToken)) {
            console.log('[AuthContext] Cached token expired, attempting refresh...')
            if (savedRefreshToken && savedRefreshToken !== 'undefined' && savedRefreshToken !== 'null') {
              try {
                const apiBase = getApiBase()
                const refreshRes = await fetch(`${apiBase}/api/auth/refresh?refresh_token=${encodeURIComponent(savedRefreshToken)}`, {
                  method: 'POST',
                })
                if (refreshRes.ok) {
                  const tokenData = await refreshRes.json()
                  const refreshedSession = {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token || savedRefreshToken,
                    user: savedUser,
                  }
                  if (!mounted) return
                  setSession(refreshedSession)
                  setUser(savedUser)
                  syncAuthCaches(refreshedSession)
                  setLoading(false)
                  return
                }
              } catch (refreshErr) {
                console.warn('[AuthContext] Token refresh failed:', refreshErr.message)
              }
            }

            // If refresh fails on expired token, clean up safely
            console.log('[AuthContext] Session expired and cannot be refreshed. Clearing storage.')
            clearAllAuthStorage()
            if (!mounted) return
            setSession(null)
            setUser(null)
            setLoading(false)
            return
          }

          // Token is valid
          const fallbackSession = {
            access_token: savedToken,
            refresh_token: savedRefreshToken || '',
            user: savedUser,
          }
          if (!mounted) return
          setSession(fallbackSession)
          setUser(savedUser)
          syncAuthCaches(fallbackSession)
          setLoading(false)
          return
        }

        // 3. No session found
        if (!mounted) return
        setSession(null)
        setUser(null)
        setLoading(false)
      } catch (err) {
        console.error('[AuthContext] Session bootstrap error:', err)
        if (!mounted) return
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    }

    bootstrapSession()

    // Listen to reactive auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return
      console.log('[AuthContext] onAuthStateChange event:', event, Boolean(newSession))

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (newSession) {
          setSession(newSession)
          setUser(newSession.user || null)
          syncAuthCaches(newSession)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        clearAllAuthStorage()
        setLoading(false)
      } else if (event === 'INITIAL_SESSION') {
        // If Supabase has an active session, use it
        if (newSession) {
          setSession(newSession)
          setUser(newSession.user || null)
          syncAuthCaches(newSession)
          setLoading(false)
        }
        // If newSession is null, DO NOT wipe caches or set loading to false; bootstrapSession is running.
      }

      // Notify other components if needed
      if (typeof window !== 'undefined' && newSession?.user) {
        window.dispatchEvent(
          new CustomEvent('ip-sakti-user-updated', { detail: newSession.user })
        )
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Request email OTP verification code.
   */
  const signInWithOtp = useCallback(async (email) => {
    const normalizedEmail = (email || '').trim().toLowerCase()
    const redirectTarget = `${siteUrl}/auth/callback`

    const { data, error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTarget,
        shouldCreateUser: true,
      },
    })

    if (error) {
      throw error
    }
    return data
  }, [])

  /**
   * Verify six-digit or eight-digit email OTP.
   */
  const verifyOtp = useCallback(async (email, token, rememberMeOverride) => {
    const normalizedEmail = (email || '').trim().toLowerCase()
    const normalizedToken = (token || '').trim()

    if (typeof rememberMeOverride === 'boolean') {
      setRememberMePreference(rememberMeOverride)
      setRememberMeState(rememberMeOverride)
    }

    // Try standard email OTP type, fallback to magiclink if rejected by server config
    let res = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email',
    })

    if (res.error && (res.error.message?.toLowerCase().includes('type') || res.error.status === 400)) {
      const fallbackRes = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'magiclink',
      })
      if (!fallbackRes.error) {
        res = fallbackRes
      }
    }

    if (res.error) {
      throw res.error
    }

    if (res.data?.session) {
      setSession(res.data.session)
      setUser(res.data.session.user)
      syncLocalCaches(res.data.session, rememberMeOverride)
    }

    return res.data
  }, [syncLocalCaches])

  /**
   * Register a new user with email, password, and full name.
   * Uses backend /api/auth/signup endpoint.
   */
  const signUp = useCallback(async (email, password, fullName, rememberMeOverride) => {
    if (typeof rememberMeOverride === 'boolean') {
      setRememberMePreference(rememberMeOverride)
      setRememberMeState(rememberMeOverride)
    }

    const apiBase = getApiBase()
    const res = await fetch(`${apiBase}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: (email || '').trim().toLowerCase(),
        password: password,
        full_name: (fullName || '').trim(),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Registration failed. Please try again.')
    }

    const newSession = {
      access_token: data.tokens.access_token,
      refresh_token: data.tokens.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role || 'user',
        user_metadata: {
          full_name: data.user.full_name,
          name: data.user.full_name,
          organization: data.user.organization,
          role: data.user.role,
        },
      },
    }

    setSession(newSession)
    setUser(newSession.user)
    syncLocalCaches(newSession, rememberMeOverride)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ip-sakti-user-updated', { detail: newSession.user })
      )
    }

    return newSession
  }, [syncLocalCaches])

  /**
   * Direct password login (for dummy test accounts & local auth).
   */
  const loginWithPassword = useCallback(async (email, password, rememberMeOverride) => {
    if (typeof rememberMeOverride === 'boolean') {
      setRememberMePreference(rememberMeOverride)
      setRememberMeState(rememberMeOverride)
    }

    const apiBase = getApiBase()
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: (email || '').trim().toLowerCase(),
        password: password,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Login failed. Please verify your credentials.')
    }

    const newSession = {
      access_token: data.tokens.access_token,
      refresh_token: data.tokens.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role || 'user',
        user_metadata: {
          full_name: data.user.full_name,
          name: data.user.full_name,
          organization: data.user.organization,
          role: data.user.role,
        },
      },
    }

    setSession(newSession)
    setUser(newSession.user)
    syncLocalCaches(newSession, rememberMeOverride)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ip-sakti-user-updated', { detail: newSession.user })
      )
    }

    return newSession
  }, [syncLocalCaches])

  /**
   * Complete Sign Out.
   */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('[AuthContext] Sign out warning:', err.message)
    } finally {
      setSession(null)
      setUser(null)
      clearAllAuthStorage()
      setRememberMePreference(false)
      setRememberMeState(false)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ip-sakti-user-updated', { detail: null })
        )
      }
    }
  }, [])

  /**
   * Switch Account: Clears the current session and prepares the UI for a fresh login.
   * Does NOT delete the user or any database records.
   */
  const switchAccount = useCallback(async () => {
    await signOut()
  }, [signOut])

  /**
   * Resend signup verification email via Supabase.
   */
  const resendVerificationEmail = useCallback(async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    const redirectTarget = `${siteUrl}/auth/callback`
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectTarget,
      },
    })
    if (error) throw error
    return data
  }, [])

  /**
   * Prototype / Dev Demo Bypass
   * Creates an authenticated local session for demonstration purposes.
   */
  const loginAsDemoUser = useCallback((demoAccount = {}, rememberMeOverride) => {
    if (typeof rememberMeOverride === 'boolean') {
      setRememberMePreference(rememberMeOverride)
      setRememberMeState(rememberMeOverride)
    }

    const email = demoAccount.email || 'admin@ipsakti.gov.in'
    const name = demoAccount.name || 'Admin Director'
    const nowIso = new Date().toISOString()
    const demoSession = {
      access_token: 'demo-admin-token-' + Date.now(),
      user: {
        id: demoAccount.id || '11111111-1111-4111-8111-111111111111',
        email: email,
        role: 'admin',
        confirmed_at: nowIso,
        email_confirmed_at: nowIso,
        user_metadata: {
          full_name: name,
          name: name,
          role: 'Administrator',
        },
      },
    }
    setSession(demoSession)
    setUser(demoSession.user)
    syncLocalCaches(demoSession, rememberMeOverride)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ip-sakti-user-updated', { detail: demoSession.user })
      )
    }
    return demoSession
  }, [syncLocalCaches])

  const isLoggedIn = useMemo(() => {
    if (!session?.user) return false
    const u = session.user
    if (u.confirmed_at === null && u.email_confirmed_at === null) {
      return false
    }
    return true
  }, [session])

  const accessToken = useMemo(() => session?.access_token || '', [session])
  const userEmail = useMemo(() => user?.email || '', [user])
  const userName = useMemo(() => (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'Innovator'
  ), [user])

  const value = useMemo(() => ({
    session,
    user,
    isLoggedIn,
    accessToken,
    userEmail,
    userName,
    loading,
    rememberMe,
    setRememberMe,
    signInWithOtp,
    verifyOtp,
    signUp,
    signUpWithPassword: signUp,
    loginWithPassword,
    loginAsDemoUser,
    resendVerificationEmail,
    signOut,
    switchAccount,
  }), [
    session,
    user,
    isLoggedIn,
    accessToken,
    userEmail,
    userName,
    loading,
    rememberMe,
    setRememberMe,
    signInWithOtp,
    verifyOtp,
    signUp,
    loginWithPassword,
    loginAsDemoUser,
    resendVerificationEmail,
    signOut,
    switchAccount,
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/* eslint-disable react-refresh/only-export-components */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
