/**
 * frontend/src/components/AuthCallbackPage.jsx
 * ---------------------------------------------
 * Supabase Auth Callback Handler for IP-SAKTI Sahayak.
 * 
 * Handles:
 * - Magic link / OTP token hash fragments (`#access_token=...`)
 * - Authorization code exchange (`?code=...`)
 * - Error fragments and query parameters
 * - Safe URL fragment cleanup without leaking tokens in browser history
 * - Automatic redirect to originally requested page or home
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../api/supabaseClient'

export default function AuthCallbackPage({ onLogin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(true)

  useEffect(() => {
    let isSubscribed = true

    const handleAuthCallback = async () => {
      try {
        // 1. Check for query error parameters
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

        const errorMsg =
          searchParams.get('error_description') ||
          hashParams.get('error_description') ||
          searchParams.get('error') ||
          hashParams.get('error')

        if (errorMsg) {
          if (!isSubscribed) return
          setError(decodeURIComponent(errorMsg).replace(/\+/g, ' '))
          setProcessing(false)
          return
        }

        // 2. Exchange code or restore session
        const code = searchParams.get('code')
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
          if (data.session && onLogin) {
            onLogin(
              data.session.user.email,
              data.session.user.user_metadata?.full_name || data.session.user.email.split('@')[0]
            )
          }
        } else {
          // Check if session was automatically populated by detectSessionInUrl
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) {
            throw sessionError
          }
          if (session && onLogin) {
            onLogin(
              session.user.email,
              session.user.user_metadata?.full_name || session.user.email.split('@')[0]
            )
          }
        }

        // 3. Safe cleanup of URL fragments and query tokens
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, document.title, window.location.pathname)
        }

        // 4. Resolve return destination
        const destination = sessionStorage.getItem('auth_redirect') || '/'
        sessionStorage.removeItem('auth_redirect')

        setTimeout(() => {
          if (isSubscribed) {
            navigate(destination, { replace: true })
          }
        }, 300)
      } catch (err) {
        console.error('[AuthCallback] Session exchange error')
        if (!isSubscribed) return
        setError(err.message || 'Authentication link is invalid or has expired. Please sign in again.')
        setProcessing(false)
      }
    }

    handleAuthCallback()

    return () => {
      isSubscribed = false
    }
  }, [navigate, onLogin])

  if (processing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 50%, #1a472a 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            border: '4px solid rgba(255,255,255,0.25)',
            borderTop: '4px solid #d4af37',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px',
          }}
        />
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>Authenticating session...</h2>
        <p style={{ opacity: 0.8, marginTop: '8px', fontSize: '0.95rem' }}>Verifying your secure credentials</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Error state
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 50%, #1a472a 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'rgba(220, 53, 69, 0.25)',
          border: '1px solid rgba(220, 53, 69, 0.6)',
          borderRadius: '12px',
          padding: '28px 36px',
          textAlign: 'center',
          maxWidth: '440px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 600 }}>Authentication Error</h2>
        <p style={{ opacity: 0.95, margin: '0 0 20px 0', lineHeight: 1.5, fontSize: '0.95rem' }}>{error}</p>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: '#d4af37',
            color: '#1a472a',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          Return to Login
        </button>
      </div>
    </div>
  )
}
