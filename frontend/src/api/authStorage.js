/**
 * frontend/src/api/authStorage.js
 * -------------------------------
 * Unified storage adapter for Supabase client and auxiliary auth caches.
 *
 * Implements strict "Remember me" semantics:
 * - Remember me ENABLED:
 *     Persists session across page refreshes, tab closures, and browser restarts (localStorage).
 * - Remember me DISABLED:
 *     Preserves session during normal page refreshes and route navigation within the tab (sessionStorage),
 *     without persisting beyond the current browser session.
 * - Explicit Sign Out:
 *     Completely purges session and tokens from both localStorage and sessionStorage.
 */

const REMEMBER_ME_KEY = 'ragvyn_remember_me'
const TOKEN_KEY = 'ip_sakti_access_token'
const REFRESH_TOKEN_KEY = 'ip_sakti_refresh_token'
const USER_KEY = 'ip_sakti_user'
const USER_NAME_KEY = 'ip_sakti_user_name'
const LOGGED_IN_KEY = 'ip_sakti_logged_in'

/**
 * Check whether "Remember me" is currently active.
 * Default is FALSE (never assumed without explicit user consent).
 */
export function isRememberMeEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Persist or clear the "Remember me" preference.
 */
export function setRememberMePreference(enabled) {
  if (typeof window === 'undefined') return
  try {
    if (enabled) {
      localStorage.setItem(REMEMBER_ME_KEY, 'true')
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY)
    }
  } catch {
    // ignore quota/security errors
  }
}

/**
 * SupportedStorage interface implementation passed to Supabase createClient.
 */
export const authStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null
    try {
      if (isRememberMeEnabled()) {
        return localStorage.getItem(key) || sessionStorage.getItem(key)
      }
      return sessionStorage.getItem(key) || localStorage.getItem(key)
    } catch {
      return null
    }
  },

  setItem: (key, value) => {
    if (typeof window === 'undefined') return
    try {
      if (isRememberMeEnabled()) {
        localStorage.setItem(key, value)
        sessionStorage.setItem(key, value)
      } else {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      }
    } catch {
      // ignore quota errors
    }
  },

  removeItem: (key) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

/**
 * Get the current access token from whichever storage holds it.
 */
export function getStoredToken() {
  if (typeof window === 'undefined') return null
  try {
    return (
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(TOKEN_KEY) ||
      null
    )
  } catch {
    return null
  }
}

/**
 * Get the current refresh token from whichever storage holds it.
 */
export function getStoredRefreshToken() {
  if (typeof window === 'undefined') return null
  try {
    return (
      sessionStorage.getItem(REFRESH_TOKEN_KEY) ||
      localStorage.getItem(REFRESH_TOKEN_KEY) ||
      null
    )
  } catch {
    return null
  }
}

/**
 * Get parsed user profile object from active storage.
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Synchronize session tokens into storage respecting Remember me preference.
 */
export function syncAuthCaches(session, rememberMeOverride) {
  if (typeof window === 'undefined') return

  const remember =
    typeof rememberMeOverride === 'boolean'
      ? rememberMeOverride
      : isRememberMeEnabled()

  if (session?.access_token) {
    const token = session.access_token
    const refreshToken = session.refresh_token || ''
    const user = session.user || {}
    const userName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Innovator'

    const serializedUser = JSON.stringify({
      id: user.id,
      email: user.email,
      full_name: userName,
      role: user.role || 'user',
    })

    if (remember) {
      localStorage.setItem(TOKEN_KEY, token)
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      localStorage.setItem(USER_NAME_KEY, userName)
      localStorage.setItem(USER_KEY, serializedUser)
      localStorage.setItem(LOGGED_IN_KEY, 'true')

      // Also mirror to sessionStorage so in-tab lookups find it instantly
      sessionStorage.setItem(TOKEN_KEY, token)
      if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      sessionStorage.setItem(USER_NAME_KEY, userName)
      sessionStorage.setItem(USER_KEY, serializedUser)
      sessionStorage.setItem(LOGGED_IN_KEY, 'true')
    } else {
      // Remember me is disabled: ONLY store in sessionStorage
      sessionStorage.setItem(TOKEN_KEY, token)
      if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      sessionStorage.setItem(USER_NAME_KEY, userName)
      sessionStorage.setItem(USER_KEY, serializedUser)
      sessionStorage.setItem(LOGGED_IN_KEY, 'true')

      // Clean up from localStorage to guarantee non-persistence past tab closure
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(USER_NAME_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(LOGGED_IN_KEY)
    }
  } else {
    // No session: clear everywhere
    clearAllAuthStorage()
  }
}

/**
 * Purge all session keys and tokens across all storages.
 */
export function clearAllAuthStorage() {
  if (typeof window === 'undefined') return
  const keys = [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_NAME_KEY, USER_KEY, LOGGED_IN_KEY]
  try {
    keys.forEach((k) => {
      localStorage.removeItem(k)
      sessionStorage.removeItem(k)
    })
    // Also clear any supabase client storage keys in localStorage/sessionStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        localStorage.removeItem(k)
      }
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        sessionStorage.removeItem(k)
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Decode JWT payload safely without external dependencies.
 */
export function parseJwt(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Check if a JWT token is expired (with 30-second clock skew buffer).
 */
export function isTokenExpired(token) {
  if (!token) return true
  // Demo tokens do not expire locally
  if (typeof token === 'string' && token.startsWith('demo-')) return false
  const payload = parseJwt(token)
  if (!payload || !payload.exp) return false
  return payload.exp * 1000 < Date.now() + 30000
}
