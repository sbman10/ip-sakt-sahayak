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
      setSession(initialSession)
      setUser(initialSession?.user || null)
      syncLocalCaches(initialSession)
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

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email',
    })

    if (error) {
      throw error
    }

    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
      syncLocalCaches(data.session)
    }

    return data
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

  const isLoggedIn = useMemo(() => Boolean(session?.user), [session])
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
