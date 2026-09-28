/**
 * frontend/src/components/LoginPage.jsx
 * --------------------------------------
 * Unified Authentication Page for IP-SAKTI Sahayak.
 * 
 * Features:
 * - Instant 1-Click Demo / Test Logins with 4 pre-configured persona accounts.
 * - Direct ID & Password Authentication (bypasses email OTP for instant access).
 * - Optional Supabase Email OTP with 6/8 digit dynamic length support.
 * - Automatic session synchronization and reactive navigation.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../App'
import { useAuth } from '../context/AuthContext'
import { IpSaktiLogo, IconCheck, IconGovt, IconLock, IconRefreshCw } from './Icons'

// 4 Pre-seeded Dummy Test Accounts
export const DUMMY_ACCOUNTS = [
  {
    id: 'admin',
    name: 'Admin Director',
    roleBadge: 'Admin',
    badgeBg: '#f3e8ff',
    badgeColor: '#7e22ce',
    icon: '🛡️',
    email: 'admin@ipsakti.gov.in',
    password: 'Password@123',
    org: 'Ministry of AYUSH',
    desc: 'System oversight, multi-tenant governance, and master controls.',
  },
  {
    id: 'scientist',
    name: 'Dr. Charaka Sharma',
    roleBadge: 'AYUSH Scientist',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
    icon: '🔬',
    email: 'scientist@ccras.nic.in',
    password: 'Password@123',
    org: 'CCRAS Research Council',
    desc: 'Formulation research, TKDL citations, and patent novelty queries.',
  },
  {
    id: 'attorney',
    name: 'Adv. Meera Sen',
    roleBadge: 'IP Attorney',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    icon: '⚖️',
    email: 'attorney@ipfirm.in',
    password: 'Password@123',
    org: 'AYUSH IP Legal Services',
    desc: 'Prior-art search, section 3(p) objections, and matter workspaces.',
  },
  {
    id: 'innovator',
    name: 'Rohit Verma',
    roleBadge: 'Startup Innovator',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    icon: '💡',
    email: 'innovator@ayurstartup.co',
    password: 'Password@123',
    org: 'Patanjali Bio Innovations',
    desc: 'Product patentability assessments and compliance roadmaps.',
  },
]

// Strict email format validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export default function LoginPage({ onLogin }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithOtp, verifyOtp, loginWithPassword, isLoggedIn } = useAuth()

  // Tabs: 'demo' | 'password' | 'otp'
  const [authTab, setAuthTab] = useState('demo')

  // Password Login State
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

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

  // 1. Instant Demo / Test Account Login
  const handleQuickLogin = async (acc) => {
    setError('')
    setSuccess('')
    setIsLoading(true)
    setLoadingAccountId(acc.id)
    try {
      const sessionData = await loginWithPassword(acc.email, acc.password)
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
      const sessionData = await loginWithPassword(cleanEmail, loginPassword)
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

  // 3. Send Supabase Email OTP
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
      const data = await verifyOtp(otpEmail.trim().toLowerCase(), code)
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

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Panel - Branding */}
        <div className="login-branding">
          <div className="login-brand-content">
            <Link to="/" className="login-logo">
              <IpSaktiLogo className="login-logo-svg" size={64} />
              <span className="login-logo-text">IP-SAKTI Sahayak</span>
            </Link>

            <h1 className="login-brand-title">
              {t('heroSubtitle') || 'AI-Powered Intellectual Property & Patent Assistant'}
            </h1>

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
                  <IconCheck size={14} />
                </span>
                <span>Role-Based Multi-Tenant Isolation</span>
              </div>
            </div>

            <div className="login-govt-badge">
              <span style={{ display: 'flex' }}><IconGovt size={16} /></span>
              <span>{t('ministry') || 'Ministry of AYUSH'} · {t('govtOf') || 'Government of India'}</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Auth Controls */}
        <div className="login-form-panel">
          <div className="login-form-container" style={{ maxWidth: '520px' }}>
            <div className="login-form-header">
              <h2>Workspace Authentication</h2>
              <p>Select your testing persona or sign in with your credentials.</p>
            </div>

            {/* Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-card, #f1f5f9)',
                padding: '4px',
                borderRadius: '10px',
                marginBottom: '20px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => { setAuthTab('demo'); setError(''); setSuccess('') }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: authTab === 'demo' ? 'var(--bg-input, #ffffff)' : 'transparent',
                  color: authTab === 'demo' ? 'var(--brand-primary, #1e3a8a)' : '#64748b',
                  fontWeight: authTab === 'demo' ? '700' : '500',
                  boxShadow: authTab === 'demo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                }}
              >
                🚀 Quick Test IDs
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('password'); setError(''); setSuccess('') }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: authTab === 'password' ? 'var(--bg-input, #ffffff)' : 'transparent',
                  color: authTab === 'password' ? 'var(--brand-primary, #1e3a8a)' : '#64748b',
                  fontWeight: authTab === 'password' ? '700' : '500',
                  boxShadow: authTab === 'password' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                }}
              >
                🔑 Password Login
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('otp'); setError(''); setSuccess('') }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: authTab === 'otp' ? 'var(--bg-input, #ffffff)' : 'transparent',
                  color: authTab === 'otp' ? 'var(--brand-primary, #1e3a8a)' : '#64748b',
                  fontWeight: authTab === 'otp' ? '700' : '500',
                  boxShadow: authTab === 'otp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                }}
              >
                ✉️ Supabase OTP
              </button>
            </div>

            {/* Error & Success Banners */}
            {error && <div className="login-error" role="alert">{error}</div>}
            {success && <div className="login-success" role="status">{success}</div>}

            {/* Tab 1: 4 Instant Demo / Test Accounts */}
            {authTab === 'demo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.88rem', color: '#64748b' }}>
                  Click any profile below to instantly log in with that persona:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
                  {DUMMY_ACCOUNTS.map((acc) => {
                    const isCardLoading = isLoading && loadingAccountId === acc.id
                    return (
                      <div
                        key={acc.id}
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: '10px',
                          padding: '12px',
                          background: 'var(--bg-card, #ffffff)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '1.2rem' }}>{acc.icon}</span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: acc.badgeBg,
                                color: acc.badgeColor,
                              }}
                            >
                              {acc.roleBadge}
                            </span>
                          </div>
                          <h4 style={{ margin: '0 0 2px 0', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary, #0f172a)' }}>
                            {acc.name}
                          </h4>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>
                            {acc.org}
                          </div>
                          <div
                            style={{
                              background: 'var(--bg-subtle, #f8fafc)',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              marginBottom: '10px',
                              color: 'var(--text-secondary, #334155)',
                            }}
                          >
                            <div><strong>ID:</strong> {acc.email}</div>
                            <div><strong>Pass:</strong> {acc.password}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleQuickLogin(acc)}
                          disabled={isLoading}
                          className="login-submit-btn"
                          style={{
                            padding: '8px',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          {isCardLoading ? <IconRefreshCw size={14} className="spin" /> : null}
                          <span>{isCardLoading ? 'Entering...' : `Enter as ${acc.roleBadge} →`}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Manual Password Login */}
            {authTab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="login-form">
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

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isLoading || !loginEmail.trim() || !loginPassword}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isLoading && <IconRefreshCw size={16} className="spin" />}
                  <span>{isLoading ? 'Authenticating...' : 'Sign In with Password →'}</span>
                </button>
              </form>
            )}

            {/* Tab 3: Supabase Email OTP */}
            {authTab === 'otp' && (
              otpStep === 'email' ? (
                <form onSubmit={handleSendOtp} className="login-form">
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
                <form onSubmit={handleVerifyOtp} className="login-form">
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
              <span>Secured by IP-SAKTI Identity Engine & DPDP Compliance</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
