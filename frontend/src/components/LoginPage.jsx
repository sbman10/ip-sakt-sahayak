/**
 * frontend/src/components/LoginPage.jsx
 * --------------------------------------
 * Unified Authentication Page for RAGVYN.
 * 
 * Features:
 * - Optional single Admin prototype login.
 * - Direct ID & Password Authentication (bypasses email OTP for instant access).
 * - Optional Supabase Email OTP with 6/8 digit dynamic length support.
 * - Automatic session synchronization and reactive navigation.
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../App'
import { useAuth } from '../context/AuthContext'
import { IpSaktiLogo, IconCheck, IconLock, IconRefreshCw } from './Icons'

// Demo credentials are read from local environment variables and never rendered.
const ADMIN_DEMO_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN_DEMO === 'true'
const ADMIN_DEMO_EMAIL = import.meta.env.VITE_ADMIN_DEMO_EMAIL || 'admin@ipsakti.gov.in'
const ADMIN_DEMO_PASSWORD = import.meta.env.VITE_ADMIN_DEMO_PASSWORD || 'Password@123'

// Keep exactly one frontend demo profile. This does not create or delete Supabase users.
const DUMMY_ACCOUNTS = [
  {
    id: 'admin',
    name: 'Admin',
    roleBadge: 'Administrator',
    icon: '🛡️',
    desc: 'Prototype workspace access for demonstrations.',
  },
]

// Strict email format validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export default function LoginPage({ onLogin }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    signInWithOtp,
    verifyOtp,
    signUp,
    signUpWithPassword,
    loginWithPassword,
    isLoggedIn,
    loading: authLoading,
  } = useAuth()

  // Tabs: 'demo' | 'password' | 'otp' | 'register'
  const [authTab, setAuthTab] = useState('demo')

  // Remember Me State (strictly opt-in; never pre-selected without explicit user consent)
  const [rememberMe, setRememberMe] = useState(false)

  // Password Login State
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Registration State
  const [registerFullName, setRegisterFullName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')

  // OTP Login State
  const [otpStep, setOtpStep] = useState('email')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpLength, setOtpLength] = useState(8)
  const [otpCode, setOtpCode] = useState(() => Array(8).fill(''))
  const [cooldown, setCooldown] = useState(0)

  // Common UI State
  const [isLoading, setIsLoading] = useState(false)
  const [loadingAccountId, setLoadingAccountId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const otpInputsRef = useRef([])

  // Helper to render accessible Remember Me checkbox
  const renderRememberMe = (id) => (
    <div className="login-remember-me">
      <label htmlFor={id} className="login-remember-label">
        <input
          type="checkbox"
          id={id}
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          disabled={isLoading}
          className="login-remember-checkbox"
          aria-label="Remember me"
        />
        <span className="login-remember-text">Remember me</span>
      </label>
    </div>
  )

  // If already logged in, redirect away
  useEffect(() => {
    if (isLoggedIn) {
      const redirectUrl = location.state?.from || '/'
      navigate(redirectUrl, { replace: true })
    }
  }, [isLoggedIn, navigate, location.state])

  // Cooldown timer for resending OTP
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (authTab === 'otp' && otpStep === 'otp') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus()
      }, 100)
    }
  }, [authTab, otpStep, otpLength])

  const toggleOtpLength = (targetLen) => {
    const newLen = targetLen || (otpLength === 8 ? 6 : 8)
    setOtpLength(newLen)
    setOtpCode(Array(newLen).fill(''))
    setError('')
  }

  // 0. Google OAuth - Redirect to backend OAuth URL
  const handleGoogleLogin = async () => {
    setError('')
    setSuccess('')
    setIsLoading(true)
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
      const res = await fetch(`${apiBase}/api/auth/google/url`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to initiate Google login')
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No OAuth URL returned from server')
      }
    } catch (err) {
      console.error('[LoginPage] Google OAuth error:', err)
      const msg = err.message || ''
      if (msg.includes('not configured') || msg.includes('Client ID')) {
        setError('Google OAuth is not configured. Please use email/password login.')
      } else {
        setError(msg || 'Unable to start Google login. Please try email/password.')
      }
      setIsLoading(false)
    }
  }

  // 1. Instant Demo / Test Account Login
  const handleQuickLogin = async (acc) => {
    setError('')
    setSuccess('')
    setIsLoading(true)
    setLoadingAccountId(acc.id)
    try {
      if (!ADMIN_DEMO_EMAIL || !ADMIN_DEMO_PASSWORD) {
        throw new Error('Admin demo access is not configured for this environment.')
      }
      const sessionData = await loginWithPassword(ADMIN_DEMO_EMAIL, ADMIN_DEMO_PASSWORD, rememberMe)
      setSuccess(`Authenticated as ${acc.name}! Accessing workspace...`)
      if (onLogin && sessionData.user) {
        onLogin(sessionData.user.email, sessionData.user.user_metadata?.full_name || acc.name)
      }
      setTimeout(() => {
        const redirectUrl = location.state?.from || '/'
        navigate(redirectUrl, { replace: true })
      }, 300)
    } catch (err) {
      console.error('[LoginPage] Quick login failed:', err)
      setError(err.message || 'Login failed. Please check backend status.')
    } finally {
      setIsLoading(false)
      setLoadingAccountId(null)
    }
  }

  // 2. Manual Email & Password Login
  const handlePasswordSubmit = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    const cleanEmail = loginEmail.trim().toLowerCase()
    if (!cleanEmail || !loginPassword) {
      setError('Please provide both email and password.')
      return
    }

    setIsLoading(true)
    try {
      const sessionData = await loginWithPassword(cleanEmail, loginPassword, rememberMe)
      setSuccess('Login successful! Entering workspace...')
      if (onLogin && sessionData.user) {
        onLogin(
          sessionData.user.email,
          sessionData.user.user_metadata?.full_name || sessionData.user.email.split('@')[0]
        )
      }
      setTimeout(() => {
        const redirectUrl = location.state?.from || '/'
        navigate(redirectUrl, { replace: true })
      }, 300)
    } catch (err) {
      console.error('[LoginPage] Password login error:', err)
      setError(err.message || 'Invalid email or password.')
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Registration with full name, email, password
  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    const cleanName = registerFullName.trim()
    const cleanEmail = registerEmail.trim().toLowerCase()
    const cleanPassword = registerPassword

    if (!cleanName) {
      setError('Please enter your full name.')
      return
    }
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!cleanPassword || cleanPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsLoading(true)
    try {
      const registerFn = signUp || signUpWithPassword
      const sessionData = await registerFn(cleanEmail, cleanPassword, cleanName, rememberMe)
      setSuccess('Account created successfully! Entering workspace...')
      if (onLogin && sessionData?.user) {
        onLogin(
          sessionData.user.email,
          sessionData.user.user_metadata?.full_name || cleanName
        )
      }
      setTimeout(() => {
        const redirectUrl = location.state?.from || '/'
        navigate(redirectUrl, { replace: true })
      }, 300)
    } catch (err) {
      console.error('[LoginPage] Registration error:', err)
      const msg = err.message || ''
      if (msg.includes('already exists') || msg.includes('409')) {
        setError('An account with this email already exists. Please login instead.')
      } else if (msg.includes('password') || msg.includes('weak')) {
        setError('Password is too weak. Use at least 8 characters with uppercase, lowercase, number, and special character.')
      } else {
        setError(msg || 'Registration failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 4. Send Supabase Email OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    const cleanEmail = otpEmail.trim().toLowerCase()
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setIsLoading(true)
    try {
      await signInWithOtp(cleanEmail)
      setOtpStep('otp')
      setCooldown(60)
      setSuccess(`A verification passcode has been sent to ${cleanEmail}.`)
    } catch (err) {
      console.error('[LoginPage] OTP request error:', err)
      const msg = err.message || ''
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setError('Too many login attempts. Please wait a minute before requesting another code.')
      } else if (msg.includes('Invalid API key') || msg.includes('anon') || msg.includes('placeholder')) {
        setError('Supabase anonymous key (VITE_SUPABASE_ANON_KEY) is missing. You can use the Quick Demo Logins tab above!')
      } else if (msg.includes('Error sending') || msg.includes('unexpected_failure')) {
        setError('Supabase could not dispatch email (Custom SMTP required). Use the Quick Demo Logins tab to enter instantly!')
      } else {
        setError(msg || 'Unable to send verification code. Please check your connection.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OTP digit changes
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/[^0-9]/g, '')

    if (cleanVal.length > 1) {
      const targetLen = cleanVal.length >= 8 ? 8 : 6
      if (targetLen !== otpLength) {
        setOtpLength(targetLen)
      }
      const digits = cleanVal.slice(0, targetLen).split('')
      const newOtp = Array(targetLen).fill('')
      digits.forEach((d, i) => {
        newOtp[i] = d
      })
      setOtpCode(newOtp)
      const nextFocus = Math.min(digits.length, targetLen - 1)
      otpInputsRef.current[nextFocus]?.focus()
      return
    }

    const newOtp = [...otpCode]
    newOtp[index] = cleanVal ? cleanVal[0] : ''
    setOtpCode(newOtp)

    if (cleanVal && index < otpLength - 1) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  // Verify Supabase OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    const code = otpCode.join('').trim()
    if (code.length !== otpLength) {
      setError(`Please enter the complete ${otpLength}-digit verification code.`)
      return
    }

    setIsLoading(true)
    try {
      const data = await verifyOtp(otpEmail.trim().toLowerCase(), code, rememberMe)
      setSuccess('Verification successful! Accessing workspace...')
      if (onLogin && data.user) {
        onLogin(
          data.user.email,
          data.user.user_metadata?.full_name || data.user.email.split('@')[0]
        )
      }
      setTimeout(() => {
        const redirectUrl = location.state?.from || '/'
        navigate(redirectUrl, { replace: true })
      }, 300)
    } catch (err) {
      console.error('[LoginPage] Verification error:', err)
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('expired') || msg.includes('timeout')) {
        setError('Verification code has expired. Please request a new code.')
      } else if (msg.includes('invalid') || msg.includes('token')) {
        setError('Invalid verification code. Please check your email and try again.')
      } else {
        setError(err.message || 'Verification failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="gov-spinner" style={{ width: 44, height: 44, border: '3px solid rgba(22, 101, 52, 0.2)', borderTopColor: '#15803d', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#475569', fontSize: '0.95rem', fontWeight: 500 }}>Checking authentication session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Panel - Branding */}
        <div className="login-branding">
          <div className="login-brand-content">
            <Link to="/" className="login-logo" aria-label="RAGVYN home">
              <IpSaktiLogo className="login-logo-svg" size={64} />
              <span className="login-logo-text">RAGVYN</span>
            </Link>

            <h1 className="login-brand-title">
              {t('') || 'Know what comes next.'}
            </h1>

            <p className="login-brand-description">
              Source-backed IP guidance for innovation, AYUSH regulation, traditional knowledge, and biodiversity pathways.
            </p>

            <div className="login-features">
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCheck size={14} />
                </span>
                <span>{t('Close to Zero Hallucination') || 'Zero-Hallucination Legal Grounding'}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCheck size={14} />
                </span>
                <span>{t('Source cited') || 'Statutory Section & Treaty Citations'}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCheck size={14} />
                </span>
                <span>Role-Based Multi-Tenant Isolation</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Panel - Auth Controls */}
        <div className="login-form-panel">
          <div className="login-form-container" style={{ maxWidth: '520px' }}>
            <div className="login-form-header">
              <h2>Workspace Authentication</h2>
              <p>Sign in to continue to your RAGVYN workspace.</p>
            </div>

            {/* Password login remains primary; OTP is intentionally a bottom action. */}
            <div className="login-auth-tabs" role="tablist" aria-label="Authentication methods">
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'demo'}
                onClick={() => { setAuthTab('demo'); setError(''); setSuccess('') }}
                className="login-auth-tab"
              >
                Demo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'password'}
                onClick={() => { setAuthTab('password'); setError(''); setSuccess('') }}
                className="login-auth-tab"
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === 'register'}
                onClick={() => { setAuthTab('register'); setError(''); setSuccess('') }}
                className="login-auth-tab"
              >
                Register
              </button>
            </div>

            {/* Error & Success Banners */}
            {error && <div className="login-error" role="alert">{error}</div>}
            {success && <div className="login-success" role="status">{success}</div>}

            {/* Single Admin prototype entry; this does not create or delete users. */}
            {authTab === 'demo' && (
              <div className="login-demo-section">
                <p className="login-demo-intro">Use the configured prototype profile to preview the workspace.</p>
                <div className="login-demo-list">
                  {DUMMY_ACCOUNTS.map((acc) => {
                    const isCardLoading = isLoading && loadingAccountId === acc.id
                    return (
                      <div key={acc.id} className="login-demo-card">
                        <div className="login-demo-card-copy">
                          <span className="login-demo-icon" aria-hidden="true">{acc.icon}</span>
                          <div>
                            <h4>{acc.name}</h4>
                            <p>{acc.roleBadge}</p>
                            <span>{acc.desc}</span>
                          </div>
                        </div>
                        {renderRememberMe(`rememberMe-demo-${acc.id}`)}
                        <button
                          type="button"
                          onClick={() => handleQuickLogin(acc)}
                          disabled={isLoading || !ADMIN_DEMO_ENABLED}
                          className="login-submit-btn"
                        >
                          {isCardLoading ? <IconRefreshCw size={14} className="spin" /> : null}
                          <span>{isCardLoading ? 'Entering...' : ADMIN_DEMO_ENABLED ? 'Continue as Admin →' : 'Demo unavailable'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Manual Password Login */}
            {authTab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="login-form" noValidate>
                <div className="login-field">
                  <label htmlFor="loginEmail">Email Address</label>
                  <input
                    type="email"
                    id="loginEmail"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. admin@ipsakti.gov.in"
                    required
                    autoFocus
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="loginPassword">Password</label>
                  <input
                    type="password"
                    id="loginPassword"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password@123"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>

                {renderRememberMe('rememberMe-password')}

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isLoading || !loginEmail.trim() || !loginPassword}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isLoading && <IconRefreshCw size={16} className="spin" />}
                  <span>{isLoading ? 'Authenticating...' : 'Sign In with Password →'}</span>
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                  <span style={{ padding: '0 12px', color: '#64748b', fontSize: '0.85rem' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                </div>

                {/* Google OAuth Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="login-google-btn"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '12px 20px',
                    background: '#fff',
                    border: '1px solid #dadce0',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#3c4043',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                  }}
                  onMouseOver={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)' }}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Google "G" logo SVG */}
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isLoading ? 'Redirecting...' : 'Continue with Google'}</span>
                </button>
              </form>
            )}

            {/* Tab 3: Registration with Full Name */}
            {authTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="login-form" noValidate>
                <div className="login-field">
                  <label htmlFor="registerFullName">Full Name</label>
                  <input
                    type="text"
                    id="registerFullName"
                    value={registerFullName}
                    onChange={(e) => setRegisterFullName(e.target.value)}
                    placeholder="Dr. Anshuman Sharma"
                    required
                    autoFocus
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="registerEmail">Email Address</label>
                  <input
                    type="email"
                    id="registerEmail"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value.toLowerCase())}
                    placeholder="name@organization.gov.in"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="registerPassword">Password</label>
                  <input
                    type="password"
                    id="registerPassword"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <span className="login-field-hint">Use uppercase, lowercase, number, and special character.</span>
                </div>

                {renderRememberMe('rememberMe-register')}

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isLoading || !registerFullName.trim() || !registerEmail.trim() || !registerPassword}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isLoading && <IconRefreshCw size={16} className="spin" />}
                  <span>{isLoading ? 'Creating Account...' : 'Create Account →'}</span>
                </button>

                <p className="login-register-note" style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #666)', marginTop: '12px', textAlign: 'center' }}>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthTab('password'); setError(''); setSuccess('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary, #1a5f2a)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}

            {/* Tab 4: Supabase Email OTP */}
            {authTab === 'otp' && (
              otpStep === 'email' ? (
                <form onSubmit={handleSendOtp} className="login-form" noValidate>
                  <div className="login-field">
                    <label htmlFor="otpEmail">Email for OTP Code</label>
                    <input
                      type="email"
                      id="otpEmail"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value.toLowerCase())}
                      placeholder="name@organization.gov.in"
                      required
                      autoFocus
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  <button
                    type="submit"
                    className="login-submit-btn"
                    disabled={isLoading || !otpEmail.trim()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {isLoading && <IconRefreshCw size={16} className="spin" />}
                    <span>{isLoading ? 'Sending Passcode...' : 'Send Verification Code →'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="login-form" noValidate>
                  <div className="login-field">
                    <label>{otpLength}-Digit Verification Code</label>
                    <div
                      style={{
                        display: 'flex',
                        gap: otpLength === 8 ? '6px' : '8px',
                        justifyContent: 'center',
                        marginTop: '8px',
                        marginBottom: '8px',
                        flexWrap: 'nowrap',
                      }}
                    >
                      {otpCode.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (otpInputsRef.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          disabled={isLoading}
                          style={{
                            width: otpLength === 8 ? '36px' : '44px',
                            height: otpLength === 8 ? '46px' : '52px',
                            textAlign: 'center',
                            fontSize: otpLength === 8 ? '1.2rem' : '1.4rem',
                            fontWeight: '700',
                            borderRadius: '8px',
                            border: digit ? '2px solid #2d5a3d' : '1px solid #cbd5e1',
                            background: 'var(--bg-input, #ffffff)',
                            color: 'var(--text-primary, #0f172a)',
                            transition: 'border-color 0.2s',
                          }}
                        />
                      ))}
                    </div>

                    <div style={{ textAlign: 'center', margin: '4px 0 8px 0' }}>
                      <button
                        type="button"
                        onClick={() => toggleOtpLength()}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand-primary, #2d5a3d)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {otpLength === 8
                          ? 'Received a 6-digit code? Switch to 6 boxes'
                          : 'Received an 8-digit code? Switch to 8 boxes'}
                      </button>
                    </div>
                  </div>

                  {renderRememberMe('rememberMe-otp')}

                  <button
                    type="submit"
                    className="login-submit-btn"
                    disabled={isLoading || otpCode.join('').length !== otpLength}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {isLoading && <IconRefreshCw size={16} className="spin" />}
                    <span>{isLoading ? 'Verifying...' : 'Verify & Continue →'}</span>
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '16px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('email')
                        setOtpCode(Array(otpLength).fill(''))
                        setError('')
                        setSuccess('')
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#475569',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      ← Change Email
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendOtp(null)}
                      disabled={isLoading || cooldown > 0}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: cooldown > 0 ? '#94a3b8' : '#1e3a8a',
                        fontWeight: '600',
                        cursor: cooldown > 0 ? 'default' : 'pointer',
                        padding: 0,
                      }}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </form>
              )
            )}

            {authTab !== 'otp' && <div className="login-otp-action">
              <span>Prefer a code instead?</span>
              <button
                type="button"
                onClick={() => { setAuthTab('otp'); setError(''); setSuccess('') }}
                aria-label="Sign in with email OTP"
              >
                Sign in with email OTP
              </button>
            </div>}

            {/* Terms Note */}
            <p className="login-terms" style={{ marginTop: '20px' }}>
              {t('termsNote') || 'By proceeding, you agree to the'}{' '}
              <Link to="/privacy">{t('termsLink') || 'Terms of Service'}</Link>{' '}
              {t('andText') || 'and'}{' '}
              <Link to="/privacy">{t('privacyLink') || 'Privacy Policy'}</Link>.
            </p>

            {/* Security Badge */}
            <div className="login-security" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconLock size={14} />
              <span>Secure session handling</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
