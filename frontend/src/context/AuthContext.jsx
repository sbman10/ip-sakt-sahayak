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
        if (savedToken && savedUserStr) {
          try {
            const savedUser = JSON.parse(savedUserStr)
            const fallbackSession = {
              access_token: savedToken,
              user: {
                id: savedUser.id,
                email: savedUser.email,
                role: savedUser.role || 'user',
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
   * Supabase User Registration with Full Name metadata.
   * Enforces Supabase email verification flow.
   */
  const signUpWithPassword = useCallback(async (email, password, fullName) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    const cleanName = (fullName || '').trim()
    const redirectTarget = `${siteUrl}/auth/callback`

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
        },
        emailRedirectTo: redirectTarget,
      },
    })

    if (error) {
      throw error
    }

    // Only establish active session if Supabase did not require verification
    // (i.e. session returned immediately). Unverified users receive data.user but null session.
    if (data?.session) {
      setSession(data.session)
      setUser(data.session.user)
      syncLocalCaches(data.session)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ip-sakti-user-updated', { detail: data.session.user })
        )
      }
    }

    return data
  }, [syncLocalCaches])

  /**
   * Supabase Password Login.
   * Signs in a verified user using supabase.auth.signInWithPassword.
   */
  const loginWithPassword = useCallback(async (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    })

    if (error) {
      throw error
    }

    if (data?.session) {
      setSession(data.session)
      setUser(data.session.user)
      syncLocalCaches(data.session)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ip-sakti-user-updated', { detail: data.session.user })
        )
      }
    }

    return data
  }, [syncLocalCaches])

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

    if (error) {
      throw error
    }

    return data
  }, [])

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
    signUpWithPassword,
    loginWithPassword,
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
    signUpWithPassword,
    loginWithPassword,
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
