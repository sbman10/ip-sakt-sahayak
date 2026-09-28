/**
 * frontend/src/components/LoginPage.jsx
 * --------------------------------------
 * Unified Authentication Surface for RAGVYN AI.
 * 
 * Features:
 * - Single combined Login/Register entry point with clean mode switching.
 * - Registration with Full Name, Email, and Password via Supabase Auth.
 * - Strict enforcement of Supabase email verification with "check your email" state and resend capability.
 * - Login with Email & Password via supabase.auth.signInWithPassword.
 * - Clear error states for unverified email, invalid credentials, rate-limits, and network errors.
 * - Optional Admin demo and OTP fallback.
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../App'
import { useAuth } from '../context/AuthContext'
import { IpSaktiLogo, IconCheck, IconLock, IconRefreshCw, IconMail, IconShieldCheck } from './Icons'

// Demo credentials for local / prototype review
const ADMIN_DEMO_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN_DEMO === 'true'
const ADMIN_DEMO_EMAIL = import.meta.env.VITE_ADMIN_DEMO_EMAIL || 'admin@ipsakti.gov.in'
const ADMIN_DEMO_PASSWORD = import.meta.env.VITE_ADMIN_DEMO_PASSWORD || 'Password@123'

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
    signUpWithPassword,
    loginWithPassword,
    resendVerificationEmail,
    isLoggedIn,
  } = useAuth()

  // Initial tab resolution: supports ?mode=register or state.register
  const [authTab, setAuthTab] = useState(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('mode') === 'register' || location.state?.register) {
      return 'register'
    }
    return 'login'
  })

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register Form State
  const [regFullName, setRegFullName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  // Email Verification Screen State
  const [verificationPending, setVerificationPending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [unverifiedLoginEmail, setUnverifiedLoginEmail] = useState(null)

  // OTP Login State (optional secondary action)
  const [otpStep, setOtpStep] = useState('email')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpLength, setOtpLength] = useState(8)
  const [otpCode, setOtpCode] = useState(() => Array(8).fill(''))
  const [cooldown, setCooldown] = useState(0)

  // Feedback UI State
  const [isLoading, setIsLoading] = useState(false)
  const [loadingAccountId, setLoadingAccountId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const otpInputsRef = useRef([])

  // If already logged in, redirect away to requested page or home
  useEffect(() => {
    if (isLoggedIn) {
      const redirectUrl = location.state?.from || '/'
      navigate(redirectUrl, { replace: true })
    }
  }, [isLoggedIn, navigate, location.state])

  // Cooldown timer for resending verification / OTP
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

  // Reset tab errors on tab switch
  const switchTab = (tab) => {
    setAuthTab(tab)
    setError('')
    setSuccess('')
    setUnverifiedLoginEmail(null)
  }

  // -------------------------------------------------------------
  // 1. Supabase User Registration
  // -------------------------------------------------------------
  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')
    setUnverifiedLoginEmail(null)

    const cleanName = regFullName.trim()
    const cleanEmail = regEmail.trim().toLowerCase()
    const cleanPass = regPassword

    // Validation
    if (!cleanName || !cleanEmail || !cleanPass) {
      setError('Please provide your full name, email address, and password.')
      return
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (cleanPass.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setIsLoading(true)
    try {
      const data = await signUpWithPassword(cleanEmail, cleanPass, cleanName)
      
      // If email verification is required (standard Supabase configuration)
      // data.user exists but data.session is null until verified.
      if (data?.user && !data?.session) {
        setPendingEmail(cleanEmail)
        setVerificationPending(true)
        setCooldown(60)
        setSuccess('Registration successful! Please verify your email to continue.')
      } else if (data?.session) {
        // Auto-confirmed environment
        setSuccess('Registration successful! Entering workspace...')
        if (onLogin && data.user) {
          onLogin(data.user.email, cleanName)
        }
        setTimeout(() => {
          const redirectUrl = location.state?.from || '/'
          navigate(redirectUrl, { replace: true })
        }, 400)
      }
    } catch (err) {
      console.error('[LoginPage] Registration error:', err)
      const msg = err.message || ''
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already exists')) {
        setError('An account with this email address already exists. Please log in instead.')
      } else if (msg.toLowerCase().includes('rate limit')) {
        setError('Too many registration attempts. Please wait a few moments and try again.')
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('Network connection error. Please check your internet connection and try again.')
      } else {
        setError(msg || 'Registration failed. Please check your details and try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // -------------------------------------------------------------
  // 2. Supabase Password Login
  // -------------------------------------------------------------
  const handlePasswordSubmit = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')
    setUnverifiedLoginEmail(null)

    const cleanEmail = loginEmail.trim().toLowerCase()
    const cleanPass = loginPassword

    if (!cleanEmail || !cleanPass) {
      setError('Please provide both email and password.')
      return
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setIsLoading(true)
    try {
      const data = await loginWithPassword(cleanEmail, cleanPass)
      setSuccess('Login successful! Entering workspace...')
      if (onLogin && data?.user) {
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
      console.error('[LoginPage] Password login error:', err)
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('email not confirmed')) {
        setUnverifiedLoginEmail(cleanEmail)
        setError('Your email has not been verified yet. Please check your inbox or resend the verification email below.')
      } else if (msg.includes('invalid login credentials') || msg.includes('invalid') || msg.includes('grant_error')) {
        setError('Invalid email or password. Please verify your credentials and try again.')
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('Too many login attempts. Please wait a few moments and try again.')
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('Unable to connect to the authentication service. Please check your internet connection.')
      } else {
        setError(err.message || 'Login failed. Please verify your credentials.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // -------------------------------------------------------------
  // 3. Resend Verification Email
  // -------------------------------------------------------------
  const handleResendVerification = async (targetEmail) => {
    const emailToUse = targetEmail || pendingEmail || unverifiedLoginEmail || loginEmail
    if (!emailToUse) return

    setError('')
    setSuccess('')
    setIsLoading(true)
    try {
      await resendVerificationEmail(emailToUse)
      setSuccess(`Verification link re-sent to ${emailToUse}. Please check your inbox.`)
      setCooldown(60)
    } catch (err) {
      console.error('[LoginPage] Resend verification error:', err)
      const msg = (err.message || '').toLowerCase()
      if (msg.includes('rate limit')) {
        setError('Please wait a moment before requesting another verification email.')
      } else {
        setError(err.message || 'Failed to resend verification email. Please try again later.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // -------------------------------------------------------------
  // 4. Quick Demo / Prototype Profile Login
  // -------------------------------------------------------------
  const handleQuickLogin = async (acc) => {
    setError('')
    setSuccess('')
    setIsLoading(true)
    setLoadingAccountId(acc.id)
    try {
      if (!ADMIN_DEMO_EMAIL || !ADMIN_DEMO_PASSWORD) {
        throw new Error('Admin demo access is not configured for this environment.')
      }
      const data = await loginWithPassword(ADMIN_DEMO_EMAIL, ADMIN_DEMO_PASSWORD)
      setSuccess(`Authenticated as ${acc.name}! Accessing workspace...`)
      if (onLogin && data?.user) {
        onLogin(data.user.email, data.user.user_metadata?.full_name || acc.name)
      }
      setTimeout(() => {
        const redirectUrl = location.state?.from || '/'
        navigate(redirectUrl, { replace: true })
      }, 300)
    } catch (err) {
      console.error('[LoginPage] Quick login failed:', err)
      setError(err.message || 'Demo login failed.')
    } finally {
      setIsLoading(false)
      setLoadingAccountId(null)
    }
  }

  // -------------------------------------------------------------
  // 5. OTP Login Handlers
  // -------------------------------------------------------------
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')
    const cleanEmail = otpEmail.trim().toLowerCase()
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address to receive your passcode.')
      return
    }

    setIsLoading(true)
    try {
      await signInWithOtp(cleanEmail)
      setOtpStep('otp')
      setCooldown(60)
      setSuccess(`Verification code dispatched to ${cleanEmail}.`)
    } catch (err) {
      console.error('[LoginPage] OTP dispatch error:', err)
      setError(err.message || 'Failed to dispatch verification code.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    const digit = value.slice(-1).replace(/[^0-9]/g, '')
    const newOtp = [...otpCode]
    newOtp[index] = digit
    setOtpCode(newOtp)
    if (digit && index < otpLength - 1) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  const toggleOtpLength = (targetLen) => {
    const newLen = targetLen || (otpLength === 8 ? 6 : 8)
    setOtpLength(newLen)
    setOtpCode(Array(newLen).fill(''))
    setError('')
  }

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault()
    const token = otpCode.join('').trim()
    if (token.length !== otpLength) {
      setError(`Please enter the complete ${otpLength}-digit code.`)
      return
    }

    setError('')
    setSuccess('')
    setIsLoading(true)
    try {
      const data = await verifyOtp(otpEmail, token)
      setSuccess('Verification verified! Entering workspace...')
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
      setError(err.message || 'Invalid or expired verification code.')
    } finally {
      setIsLoading(false)
    }
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
              {t('heroSubtitle') || 'Know what comes next.'}
            </h1>

            <p className="login-brand-description">
              Source-backed IP guidance for innovation, AYUSH regulation, traditional knowledge, and biodiversity pathways.
            </p>

            <div className="login-features">
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCheck size={14} />
                </span>
                <span>{t('zeroHallucination') || 'Zero-Hallucination Legal Grounding'}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCheck size={14} />
                </span>
                <span>{t('sourceCited') || 'Statutory Section & Treaty Citations'}</span>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconShieldCheck size={14} />
                </span>
                <span>Supabase Protected Authentication</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Auth Controls */}
        <div className="login-form-panel">
          <div className="login-form-container" style={{ maxWidth: '440px' }}>
            <div className="login-form-header">
              <h2>Workspace Authentication</h2>
              <p>
                {authTab === 'register'
                  ? 'Create an account to begin your verified IP consultation.'
                  : 'Sign in to access your RAGVYN workspace.'}
              </p>
            </div>

            {/* Combined Login/Register Tabs */}
            {!verificationPending && (
              <div className="login-auth-tabs" role="tablist" aria-label="Authentication methods">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'login'}
                  onClick={() => switchTab('login')}
                  className="login-auth-tab"
                  id="tab-login"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'register'}
                  onClick={() => switchTab('register')}
                  className="login-auth-tab"
                  id="tab-register"
                >
                  Register
                </button>
                {ADMIN_DEMO_ENABLED && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authTab === 'demo'}
                    onClick={() => switchTab('demo')}
                    className="login-auth-tab"
                    id="tab-demo"
                  >
                    Admin demo
                  </button>
                )}
              </div>
            )}

            {/* Error & Success Messages */}
            {error && (
              <div className="login-error" role="alert">
                <p>{error}</p>
                {unverifiedLoginEmail && (
                  <button
                    type="button"
                    onClick={() => handleResendVerification(unverifiedLoginEmail)}
                    disabled={isLoading || cooldown > 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#991b1b',
                      textDecoration: 'underline',
                      fontWeight: '700',
                      cursor: cooldown > 0 ? 'default' : 'pointer',
                      marginTop: '6px',
                      display: 'block',
                      fontSize: '0.85rem',
                      width: '100%',
                      textAlign: 'center',
                    }}
                  >
                    {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}
            {success && <div className="login-success" role="status">{success}</div>}

            {/* ========================================================
                EMAIL VERIFICATION ENFORCEMENT STATE
                ======================================================== */}
            {verificationPending ? (
              <div className="login-verification-card" style={{ textAlign: 'center', padding: '16px 0' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(21, 94, 55, 0.12)',
                    color: '#155e37',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <IconMail size={32} />
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#155e37', marginBottom: '8px' }}>
                  Check Your Email
                </h3>

                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', marginBottom: '16px' }}>
                  A verification link has been sent to <strong>{pendingEmail}</strong>. Please check your inbox and verify your email to activate your account.
                </p>

                <div
                  style={{
                    background: 'rgba(248, 250, 252, 0.8)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '0.82rem',
                    color: '#64748b',
                    marginBottom: '20px',
                    textAlign: 'left',
                  }}
                >
                  <strong>Note:</strong> Email verification is strictly enforced before accessing protected workspace features. Once verified, you can return here to sign in.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleResendVerification(pendingEmail)}
                    disabled={isLoading || cooldown > 0}
                    className="login-submit-btn"
                    style={{ margin: 0 }}
                  >
                    {isLoading ? <IconRefreshCw size={16} className="spin" /> : null}
                    <span>{cooldown > 0 ? `Resend Email (${cooldown}s)` : 'Resend Verification Email'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVerificationPending(false)
                      switchTab('login')
                      setLoginEmail(pendingEmail)
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '10px',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </div>
            ) : null}

            {/* ========================================================
                TAB 1: SIGN IN (EMAIL + PASSWORD)
                ======================================================== */}
            {!verificationPending && authTab === 'login' && (
              <form onSubmit={handlePasswordSubmit} className="login-form" noValidate>
                <div className="login-field">
                  <label htmlFor="loginEmail">Email Address</label>
                  <input
                    type="email"
                    id="loginEmail"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="innovator@organization.gov.in"
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
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isLoading || !loginEmail.trim() || !loginPassword}
                >
                  {isLoading ? <IconRefreshCw size={16} className="spin" /> : null}
                  <span>{isLoading ? 'Signing In...' : 'Sign In →'}</span>
                </button>

                <div className="login-toggle">
                  <span>Don't have an account?</span>
                  <button
                    type="button"
                    onClick={() => switchTab('register')}
                  >
                    Register here
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================
                TAB 2: REGISTRATION (FULL NAME + EMAIL + PASSWORD)
                ======================================================== */}
            {!verificationPending && authTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="login-form" noValidate>
                <div className="login-field">
                  <label htmlFor="regFullName">Full Name</label>
                  <input
                    type="text"
                    id="regFullName"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Dr. Ananya Sharma"
                    required
                    autoFocus
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="regEmail">Email Address</label>
                  <input
                    type="email"
                    id="regEmail"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="innovator@organization.gov.in"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="regPassword">Password (Min. 6 Characters)</label>
                  <input
                    type="password"
                    id="regPassword"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isLoading || !regFullName.trim() || !regEmail.trim() || !regPassword}
                >
                  {isLoading ? <IconRefreshCw size={16} className="spin" /> : null}
                  <span>{isLoading ? 'Creating Account...' : 'Create Account →'}</span>
                </button>

                <div className="login-toggle">
                  <span>Already have an account?</span>
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                  >
                    Sign in here
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================
                TAB 3: PROTOTYPE DEMO ACCESS (OPTIONAL)
                ======================================================== */}
            {!verificationPending && authTab === 'demo' && ADMIN_DEMO_ENABLED && (
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
                        <button
                          type="button"
                          onClick={() => handleQuickLogin(acc)}
                          disabled={isLoading}
                          className="login-submit-btn"
                        >
                          {isCardLoading ? <IconRefreshCw size={14} className="spin" /> : null}
                          <span>{isCardLoading ? 'Entering...' : 'Continue as Admin →'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ========================================================
                TAB 4: OPTIONAL OTP FALLBACK
                ======================================================== */}
            {!verificationPending && authTab === 'otp' && (
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
                  >
                    {isLoading ? <IconRefreshCw size={16} className="spin" /> : null}
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

                  <button
                    type="submit"
                    className="login-submit-btn"
                    disabled={isLoading || otpCode.join('').length !== otpLength}
                  >
                    {isLoading ? <IconRefreshCw size={16} className="spin" /> : null}
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

            {!verificationPending && authTab !== 'otp' && (
              <div className="login-otp-action" style={{ marginTop: '16px' }}>
                <span>Prefer a one-time code?</span>
                <button
                  type="button"
                  onClick={() => switchTab('otp')}
                  aria-label="Sign in with email OTP"
                >
                  Sign in with email OTP
                </button>
              </div>
            )}

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
              <span>Official Supabase Encrypted Authentication</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
