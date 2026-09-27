/**
 * frontend/src/components/LoginPage.jsx
 * --------------------------------------
 * Supabase Email OTP Authentication Page for IP-SAKTI Sahayak.
 * 
 * Features:
 * - Email input screen with strict client-side validation & normalization.
 * - 6-digit OTP verification screen with countdown cooldown for resend.
 * - Loading states, duplicate submit protection, and clear error banners.
 * - Seamless session initialization via Supabase Auth without trusting localStorage.
 * - Preserves authoritative Ministry of AYUSH branding & visual design.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../App'
import { useAuth } from '../context/AuthContext'
import { IpSaktiLogo, IconCheck, IconGovt, IconLock, IconRefreshCw } from './Icons'

// Strict email format validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export default function LoginPage({ onLogin }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithOtp, verifyOtp, isLoggedIn } = useAuth()

  // Steps: 'email' | 'otp'
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cooldown, setCooldown] = useState(0)

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
    if (step === 'otp') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus()
      }, 100)
    }
  }, [step])

  const validateEmail = (val) => {
    const clean = (val || '').trim().toLowerCase()
    if (!clean) return 'Email address is required.'
    if (!EMAIL_REGEX.test(clean)) return 'Please enter a valid email address (e.g. user@domain.com).'
    return ''
  }

  // Handle Step 1: Send OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    const cleanEmail = email.trim().toLowerCase()
    const validationError = validateEmail(cleanEmail)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    try {
      await signInWithOtp(cleanEmail)
      setStep('otp')
      setCooldown(60)
      setSuccess(`A 6-digit verification code has been sent to ${cleanEmail}.`)
    } catch (err) {
      console.error('[LoginPage] OTP request error:', err)
      const msg = err.message || ''
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setError('Too many login attempts. Please wait a minute before requesting another code.')
      } else {
        setError(msg || 'Unable to send verification code. Please verify your connection.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OTP digit changes
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/[^0-9]/g, '')
    const newOtp = [...otpCode]

    if (cleanVal.length > 1) {
      // Handle paste of 6 digits
      const digits = cleanVal.slice(0, 6).split('')
      digits.forEach((d, i) => {
        newOtp[i] = d
      })
      setOtpCode(newOtp)
      const nextFocus = Math.min(digits.length, 5)
      otpInputsRef.current[nextFocus]?.focus()
      return
    }

    newOtp[index] = cleanVal ? cleanVal[0] : ''
    setOtpCode(newOtp)

    // Move to next input if digit entered
    if (cleanVal && index < 5) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  // Handle Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    const code = otpCode.join('').trim()
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit verification code.')
      return
    }

    setIsLoading(true)
    try {
      const data = await verifyOtp(email.trim().toLowerCase(), code)
      setSuccess('Verification successful! Accessing your workspace...')

      if (onLogin && data.user) {
        onLogin(
          data.user.email,
          data.user.user_metadata?.full_name || data.user.email.split('@')[0]
        )
      }

      setTimeout(() => {
        const redirectUrl = location.state?.from || '/'
        navigate(redirectUrl, { replace: true })
      }, 500)
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
                <span>Passwordless OTP Security</span>
              </div>
            </div>

            <div className="login-govt-badge">
              <span style={{ display: 'flex' }}><IconGovt size={16} /></span>
              <span>{t('ministry') || 'Ministry of AYUSH'} · {t('govtOf') || 'Government of India'}</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="login-form-panel">
          <div className="login-form-container">
            <div className="login-form-header">
              <h2>{step === 'email' ? 'Secure Sign In' : 'Verify Passcode'}</h2>
              <p>
                {step === 'email'
                  ? 'Access your IP matters and AI consultations via secure email OTP.'
                  : `Enter the 6-digit code sent to ${email}`}
              </p>
            </div>

            {/* Error & Success Banners */}
            {error && <div className="login-error" role="alert">{error}</div>}
            {success && <div className="login-success" role="status">{success}</div>}

            {step === 'email' ? (
              /* Step 1: Email Form */
              <form onSubmit={handleSendOtp} className="login-form">
                <div className="login-field">
                  <label htmlFor="emailInput">Work or Personal Email</label>
                  <input
                    type="email"
                    id="emailInput"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    placeholder="name@organization.gov.in"
                    required
                    autoFocus
                    disabled={isLoading}
                    autoComplete="email"
                    aria-label="Email address"
                  />
                </div>

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isLoading || !email.trim()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isLoading && <IconRefreshCw size={16} className="spin" />}
                  <span>{isLoading ? 'Sending Passcode...' : 'Send Verification Code →'}</span>
                </button>
              </form>
            ) : (
              /* Step 2: 6-Digit OTP Form */
              <form onSubmit={handleVerifyOtp} className="login-form">
                <div className="login-field">
                  <label>6-Digit Verification Code</label>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'center',
                      marginTop: '8px',
                      marginBottom: '8px',
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
                          width: '44px',
                          height: '52px',
                          textAlign: 'center',
                          fontSize: '1.4rem',
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
                </div>

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isLoading || otpCode.join('').length !== 6}
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
                      setStep('email')
                      setOtpCode(['', '', '', '', '', ''])
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
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            )}

            {/* Terms Note */}
            <p className="login-terms" style={{ marginTop: '24px' }}>
              {t('termsNote') || 'By proceeding, you agree to the'}{' '}
              <Link to="/privacy">{t('termsLink') || 'Terms of Service'}</Link>{' '}
              {t('andText') || 'and'}{' '}
              <Link to="/privacy">{t('privacyLink') || 'Privacy Policy'}</Link>.
            </p>

            {/* Security Badge */}
            <div className="login-security" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconLock size={14} />
              <span>Secured by Supabase Auth & DPDP Compliance</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
