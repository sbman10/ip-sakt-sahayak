import { useState, useEffect } from 'react'

// Icons
const IconCheck = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconX = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconStar = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const IconZap = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const IconCrown = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
)

const API_BASE = 'http://127.0.0.1:8000'

export default function PricingPage() {
  const [plans, setPlans] = useState([])
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [currentTier, setCurrentTier] = useState('free')
  const [loading, setLoading] = useState(true)
  const [showTrialModal, setShowTrialModal] = useState(false)
  const [trialStarted, setTrialStarted] = useState(false)

  useEffect(() => {
    fetchPlans()
    fetchCurrentStatus()
  }, [])

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscription/plans`)
      if (res.ok) {
        const data = await res.json()
        setPlans(data)
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscription/status?user_id=anonymous`)
      if (res.ok) {
        const data = await res.json()
        setCurrentTier(data.tier)
      }
    } catch (err) {
      console.error('Failed to fetch status:', err)
    }
  }

  const startTrial = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscription/start-trial?user_id=anonymous`, {
        method: 'POST'
      })
      if (res.ok) {
        setTrialStarted(true)
        setCurrentTier('professional')
        setTimeout(() => setShowTrialModal(false), 2000)
      }
    } catch (err) {
      console.error('Failed to start trial:', err)
    }
  }

  const handleUpgrade = async (tier) => {
    // In production, this would redirect to payment gateway
    alert(`Payment gateway integration pending.\n\nSelected Plan: ${tier}\nBilling: ${billingCycle}\n\nThis is a demo - no actual payment will be processed.`)
  }

  const tierIcons = {
    free: '🆓',
    basic: '⭐',
    professional: '💎',
    enterprise: '🏢'
  }

  const tierColors = {
    free: { bg: 'rgba(156, 163, 175, 0.1)', border: 'rgba(156, 163, 175, 0.3)', accent: '#9ca3af' },
    basic: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', accent: '#3b82f6' },
    professional: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.5)', accent: '#10b981' },
    enterprise: { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)', accent: '#a855f7' }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading pricing plans...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            background: 'linear-gradient(135deg, #10b981, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1rem'
          }}>
            Choose Your Plan
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
            Unlock the full potential of IP-SAKTI Sahayak with our affordable pricing plans designed for Indian inventors, researchers, and legal professionals.
          </p>

          {/* Billing Toggle */}
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px'
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: billingCycle === 'monthly' ? '#10b981' : 'transparent',
                color: billingCycle === 'monthly' ? '#fff' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: billingCycle === 'yearly' ? '#10b981' : 'transparent',
                color: billingCycle === 'yearly' ? '#fff' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Yearly
              <span style={{
                background: '#f59e0b',
                color: '#000',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: '700'
              }}>
                SAVE 17%
              </span>
            </button>
          </div>
        </div>

        {/* Trial Banner */}
        {currentTier === 'free' && !trialStarted && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.2))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '1.25rem 2rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <IconZap size={24} color="#10b981" />
              <div>
                <p style={{ color: '#fff', fontWeight: '600', margin: 0 }}>
                  Try Professional FREE for 7 days!
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: 0 }}>
                  No credit card required. Full access to all premium features.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowTrialModal(true)}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Start Free Trial
            </button>
          </div>
        )}

        {/* Pricing Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          {plans.map(plan => {
            const colors = tierColors[plan.tier] || tierColors.free
            const isCurrentPlan = currentTier === plan.tier
            const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly
            const monthlyEquivalent = billingCycle === 'yearly' ? Math.round(plan.price_yearly / 12) : plan.price_monthly

            return (
              <div
                key={plan.tier}
                style={{
                  background: colors.bg,
                  border: `2px solid ${plan.popular ? colors.accent : colors.border}`,
                  borderRadius: '16px',
                  padding: '2rem',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  transform: plan.popular ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    padding: '4px 16px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IconStar size={12} /> MOST POPULAR
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: '600'
                  }}>
                    CURRENT
                  </div>
                )}

                {/* Plan Header */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '2rem' }}>{tierIcons[plan.tier]}</span>
                  <h3 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '700', 
                    color: colors.accent, 
                    margin: '0.5rem 0 0.25rem' 
                  }}>
                    {plan.name}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', margin: 0 }}>
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.25rem' }}>₹</span>
                    <span style={{ fontSize: '3rem', fontWeight: '800', color: '#fff' }}>
                      {price === 0 ? '0' : monthlyEquivalent}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>/mo</span>
                  </div>
                  {billingCycle === 'yearly' && price > 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                      Billed ₹{price}/year
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => isCurrentPlan ? null : (plan.tier === 'free' ? null : handleUpgrade(plan.tier))}
                  disabled={isCurrentPlan || plan.tier === 'free'}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: isCurrentPlan ? 'rgba(255,255,255,0.1)' : 
                               plan.tier === 'free' ? 'rgba(255,255,255,0.1)' :
                               plan.popular ? 'linear-gradient(135deg, #10b981, #059669)' : 
                               `linear-gradient(135deg, ${colors.accent}, ${colors.accent}dd)`,
                    color: isCurrentPlan || plan.tier === 'free' ? 'rgba(255,255,255,0.5)' : '#fff',
                    cursor: isCurrentPlan || plan.tier === 'free' ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    marginBottom: '1.5rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isCurrentPlan ? 'Current Plan' : 
                   plan.tier === 'free' ? 'Free Forever' : 
                   `Upgrade to ${plan.name}`}
                </button>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {plan.features.map((feature, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconCheck size={12} color="#10b981" />
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', color: '#fff', marginBottom: '2rem' }}>
            Frequently Asked Questions
          </h2>
          
          {[
            {
              q: "Can I change my plan later?",
              a: "Yes! You can upgrade or downgrade anytime. Upgrades take effect immediately, downgrades at the end of your billing cycle."
            },
            {
              q: "What payment methods do you accept?",
              a: "We accept UPI, Credit/Debit Cards, Net Banking, and Wallets. All payments are processed securely through Razorpay."
            },
            {
              q: "Is there a refund policy?",
              a: "Yes, we offer a 7-day money-back guarantee if you're not satisfied with your subscription."
            },
            {
              q: "What happens when I hit my limit?",
              a: "You'll be notified and can either wait for the limit to reset or upgrade to a higher plan for immediate access."
            },
            {
              q: "Do you offer discounts for students?",
              a: "Yes! Students get 50% off on all paid plans. Contact us with your .edu email for verification."
            }
          ].map((faq, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '1.25rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#10b981', margin: '0 0 0.5rem', fontSize: '1rem' }}>
                {faq.q}
              </h4>
              <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <div style={{
          textAlign: 'center',
          marginTop: '3rem',
          padding: '2rem',
          background: 'rgba(16, 185, 129, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <p style={{ color: '#10b981', fontWeight: '600', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
            🛡️ 7-Day Money-Back Guarantee
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Try any paid plan risk-free. If you're not satisfied, get a full refund within 7 days.
          </p>
        </div>
      </div>

      {/* Trial Modal */}
      {showTrialModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a1a',
            borderRadius: '16px',
            padding: '2rem 1.5rem',
            width: 'min(calc(100% - 2rem), 400px)',
            boxSizing: 'border-box',
            textAlign: 'center',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            {trialStarted ? (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                <h3 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Trial Started!</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Enjoy 7 days of Professional features for free.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💎</div>
                <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Start Your Free Trial</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                  Get 7 days of Professional plan features absolutely free. No credit card required.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => setShowTrialModal(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.7)',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startTrial}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Start Trial
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
