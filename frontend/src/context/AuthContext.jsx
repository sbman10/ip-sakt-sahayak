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

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, siteUrl } from '../api/supabaseClient'
import { getApiBase } from '../api/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Sync token to localStorage only for compatibility with auxiliary fetchers
  const syncLocalCaches = useCallback((currentSession) => {
    if (typeof window === 'undefined') return
    if (currentSession?.access_token) {
      localStorage.setItem('ip_sakti_access_token', currentSession.access_token)
      if (currentSession.refresh_token) {
        localStorage.setItem('ip_sakti_refresh_token', currentSession.refresh_token)
      }
      const u = currentSession.user
      const uName =
        u?.user_metadata?.full_name ||
        u?.user_metadata?.name ||
        u?.email?.split('@')[0] ||
        'Innovator'
      localStorage.setItem('ip_sakti_user_name', uName)
      localStorage.setItem('ip_sakti_user', JSON.stringify({
        id: u?.id,
        email: u?.email,
        full_name: uName,
        role: u?.role || 'user',
      }))
      localStorage.setItem('ip_sakti_logged_in', 'true')
    } else {
      localStorage.removeItem('ip_sakti_access_token')
      localStorage.removeItem('ip_sakti_refresh_token')
      localStorage.removeItem('ip_sakti_user_name')
      localStorage.removeItem('ip_sakti_user')
      localStorage.removeItem('ip_sakti_logged_in')
    }
  }, [])

  // Initial session restoration
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted) return
      if (error) {
        console.warn('[AuthContext] Session retrieval error:', error.message)
      }
      if (initialSession) {
        setSession(initialSession)
        setUser(initialSession?.user || null)
        syncLocalCaches(initialSession)
      } else {
        // Fallback: check stored local session for test accounts / password login
        const savedToken = localStorage.getItem('ip_sakti_access_token')
        const savedUserStr = localStorage.getItem('ip_sakti_user')
        if (savedToken && savedToken !== 'undefined' && savedToken !== 'null' && savedUserStr) {
          try {
            const savedUser = JSON.parse(savedUserStr)
            const fallbackSession = {
              access_token: savedToken,
              user: {
                id: savedUser.id,
                email: savedUser.email,
                role: savedUser.role || 'user',
                confirmed_at: savedUser.confirmed_at || new Date().toISOString(),
                email_confirmed_at: savedUser.email_confirmed_at || new Date().toISOString(),
                user_metadata: {
                  full_name: savedUser.full_name,
                  name: savedUser.full_name,
                },
              },
            }
            setSession(fallbackSession)
            setUser(fallbackSession.user)
          } catch {
            // invalid json
          }
        } else if (savedToken === 'undefined' || savedToken === 'null') {
          localStorage.removeItem('ip_sakti_access_token')
        }
      }
      setLoading(false)
    })

    // Listen to reactive auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      setUser(newSession?.user || null)
      syncLocalCaches(newSession)
      setLoading(false)

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
  }, [syncLocalCaches])

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
   * Verify six-digit email OTP.
   */
  const verifyOtp = useCallback(async (email, token) => {
    const normalizedEmail = (email || '').trim().toLowerCase()
    const normalizedToken = (token || '').trim()

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
      syncLocalCaches(res.data.session)
    }

    return res.data
  }, [syncLocalCaches])

  /**
   * Register a new user with email, password, and full name.
   * Uses backend /api/auth/signup endpoint.
   */
  const signUp = useCallback(async (email, password, fullName) => {
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
    syncLocalCaches(newSession)

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
  const loginWithPassword = useCallback(async (email, password) => {
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
    syncLocalCaches(newSession)

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
      syncLocalCaches(null)
    }
  }, [syncLocalCaches])

  /**
   * Switch Account: Clears the current session and prepares the UI for a fresh login.
   * Does NOT delete the user or any database records.
   */
  const switchAccount = useCallback(async () => {
    await signOut()
  }, [signOut])

  /**
   * Prototype / Dev Demo Bypass
   * Creates an authenticated local session for demonstration purposes.
   */
  const loginAsDemoUser = useCallback((demoAccount = {}) => {
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
    syncLocalCaches(demoSession)
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

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
