import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'

/**
 * OnboardingTour — Guided, accessible walkthrough for IP-SAKTI Sahayak / RagVyn.
 *
 * Requirements:
 *  - Highlights only elements that actually exist on the page.
 *  - Includes Informatics navigation item.
 *  - Completely removes See Demo and Pricing references.
 *  - Provides Next, Previous, and Skip controls.
 *  - Left Arrow (Previous), Right Arrow / Enter (Next), Escape (Skip / Close).
 *  - Traps focus while active and restores focus to the launching element after closing.
 *  - Stable selectors with data-tour attributes.
 *  - Respects prefers-reduced-motion.
 *  - Scrolls target into view safely.
 */

const STORAGE_KEY = 'ip_sakti_tour_done_v3'

const TOUR_FALLBACK = {
  tourStep: 'Step',
  tourSkip: 'Skip',
  tourPrev: 'Back',
  tourNext: 'Next',
  tourFinish: 'Got it!',
  tourWelcomeTitle: 'Welcome to IP-SAKTI Sahayak! 👋',
  tourWelcomeDesc: 'Your sovereign AI assistant for Ayurvedic IP, patent eligibility, TKDL prior-art and regulatory compliance. Let us guide you through the key modules in 30 seconds.',
  tourChatTitle: '💬 Ask RagVyn AI',
  tourChatDesc: 'Consult on any Ayurvedic IP or regulatory question with verified, source-cited statutory answers grounded in domestic and international law.',
  tourInformaticsTitle: '🏛️ Statutory & Treaty Informatics',
  tourInformaticsDesc: 'Explore our comprehensive, source-backed legal compendium covering Patents, Treaties, TKDL, Biodiversity (ABS), and ASU drug licensing.',
  tourToolsTitle: '🧰 IP Diagnostic Tools',
  tourToolsDesc: 'Access specialized decision engines designed specifically for AYUSH innovators, researchers, and traditional practitioners.',
  tourVerdictTitle: '🛡️ Patentability Assessment',
  tourVerdictDesc: 'Screen your formulation against Section 3(p) traditional knowledge bars and Section 3(d) therapeutic efficacy standards.',
  tourRoadmapTitle: '🗺️ IP Journey Roadmap',
  tourRoadmapDesc: 'Track your personalized statutory timeline from provisional filing to publication, examination, and 20-year patent grant.',
  tourGuardianTitle: '🧭 Dual-Use Guardian',
  tourGuardianDesc: 'Unified compliance checklist across Patent filing, State AYUSH licensing, Biodiversity (ABS), and FSSAI rules.',
  tourFeeTitle: '💰 Statutory Fee Calculator',
  tourFeeDesc: 'Estimate official patent filing fees across applicant categories (Natural Person, Startup, Small Entity, Others).',
  tourDeadlineTitle: '📅 Statutory Deadline Calculator',
  tourDeadlineDesc: 'Calculate critical patent prosecution deadlines including RFE, FER response, publication, and PCT priority windows.',
  tourAbsTitle: '🌿 Biodiversity (ABS) Checker',
  tourAbsDesc: 'Verify whether access to endemic biological resources mandates prior approval from the National Biodiversity Authority (NBA).',
  tourChecklistTitle: '✅ Statutory Filing Checklists',
  tourChecklistDesc: 'Step-by-step documentation checklists and procedural guides for Patent, Trademark, and GI applications.',
  tourServicesTitle: '💼 Practitioner Services',
  tourServicesDesc: 'Drafting, matter prosecution tracking, private document search, and verified expert consultation.',
  tourDraftsTitle: '📝 Legal Draft Generator',
  tourDraftsDesc: 'Auto-fill official statutory templates including Patent Form-1, NBA Form III, and Section 3(p) opposition petitions.',
  tourWorkspaceTitle: '🗂️ Matter Workspace',
  tourWorkspaceDesc: 'Track and manage your confidential IP matters, filings, and prosecution milestones in one secure portal.',
  tourDocumentsTitle: '📎 Document Vault',
  tourDocumentsDesc: 'Securely upload research specifications and examine documents privately, completely isolated from public data.',
  tourExpertsTitle: '👥 Expert Connect',
  tourExpertsDesc: 'Consult verified Ayurvedic IP attorneys and regulatory facilitators for official legal representation.',
  tourSourcesTitle: '📚 Knowledge Base Sources',
  tourSourcesDesc: 'Inspect the authoritative legal corpus—statutes, rules, and international treaties—that ground every answer.',
  tourFinishTitle: '🎉 You are all set!',
  tourFinishDesc: 'You now know your way around IP-SAKTI Sahayak. Start by querying RagVyn AI or exploring the Informatics compendium.',
}

const STEPS = [
  {
    selector: '[data-tour="nav-brand"], .gov-brand-wrap',
    titleKey: 'tourWelcomeTitle',
    descKey: 'tourWelcomeDesc',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="nav-consult"], #gov-nav-consult-btn, .gov-nav-cta',
    titleKey: 'tourChatTitle',
    descKey: 'tourChatDesc',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="nav-informatics"], a[href="/informatics"]',
    titleKey: 'tourInformaticsTitle',
    descKey: 'tourInformaticsDesc',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="ip-tools"], [data-tour="nav-tools"]',
    titleKey: 'tourToolsTitle',
    descKey: 'tourToolsDesc',
    placement: 'bottom',
  },
  {
    selector: 'a[href="/patentability"], a[href="/verdict"]',
    titleKey: 'tourVerdictTitle',
    descKey: 'tourVerdictDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: 'a[href="/roadmap"]',
    titleKey: 'tourRoadmapTitle',
    descKey: 'tourRoadmapDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: 'a[href="/guardian"]',
    titleKey: 'tourGuardianTitle',
    descKey: 'tourGuardianDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: 'a[href="/ip-calculator"]',
    titleKey: 'tourFeeTitle',
    descKey: 'tourFeeDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: 'a[href="/deadline-calculator"]',
    titleKey: 'tourDeadlineTitle',
    descKey: 'tourDeadlineDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: 'a[href="/abs-checker"]',
    titleKey: 'tourAbsTitle',
    descKey: 'tourAbsDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: 'a[href="/checklists"]',
    titleKey: 'tourChecklistTitle',
    descKey: 'tourChecklistDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: '[data-tour="services"], [data-tour="nav-services"]',
    titleKey: 'tourServicesTitle',
    descKey: 'tourServicesDesc',
    placement: 'bottom',
  },
  {
    selector: 'a[href="/drafts"]',
    titleKey: 'tourDraftsTitle',
    descKey: 'tourDraftsDesc',
    placement: 'right',
    openServices: true,
  },
  {
    selector: 'a[href="/workspace"]',
    titleKey: 'tourWorkspaceTitle',
    descKey: 'tourWorkspaceDesc',
    placement: 'right',
    openServices: true,
  },
  {
    selector: 'a[href="/documents"]',
    titleKey: 'tourDocumentsTitle',
    descKey: 'tourDocumentsDesc',
    placement: 'right',
    openServices: true,
  },
  {
    selector: 'a[href="/experts"]',
    titleKey: 'tourExpertsTitle',
    descKey: 'tourExpertsDesc',
    placement: 'right',
    openServices: true,
  },
  {
    selector: '[data-tour="nav-sources"], a[href="/sources"]',
    titleKey: 'tourSourcesTitle',
    descKey: 'tourSourcesDesc',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="nav-consult"], #gov-nav-consult-btn, .gov-nav-cta',
    titleKey: 'tourFinishTitle',
    descKey: 'tourFinishDesc',
    placement: 'bottom',
  },
]

const PAD = 8

export default function OnboardingTour({ run, onClose, onOpenTools, onOpenServices, t: tProp }) {
  const t = useCallback((k) => {
    if (typeof tProp === 'function') {
      const res = tProp(k)
      if (res && res !== k) return res
    }
    return TOUR_FALLBACK[k] || k
  }, [tProp])
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)

  const triggerElementRef = useRef(null)
  const cardRef = useRef(null)
  const nextBtnRef = useRef(null)

  // Auto-start on first visit or when triggered externally
  useEffect(() => {
    if (run) {
      triggerElementRef.current = document.activeElement
      setIndex(0)
      setActive(true)
      return
    }
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      const timer = setTimeout(() => {
        triggerElementRef.current = document.activeElement
        setIndex(0)
        setActive(true)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [run])

  const step = STEPS[index] || null

  // Ensure appropriate dropdown is open for nested sub-items
  useEffect(() => {
    if (!active || !step) return
    if (step.openTools) {
      if (onOpenServices) onOpenServices(false)
      if (onOpenTools) onOpenTools(true)
    } else if (step.openServices) {
      if (onOpenTools) onOpenTools(false)
      if (onOpenServices) onOpenServices(true)
    } else {
      if (onOpenTools) onOpenTools(false)
      if (onOpenServices) onOpenServices(false)
    }
  }, [active, index, step, onOpenTools, onOpenServices])

  // Update spotlight rect without triggering any scroll events
  const updateRect = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.selector)
    if (!el) return
    const isVisible = el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
    if (!isVisible) return
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
  }, [step])

  // Measure element bounding box and scroll into view smoothly ONLY on step change
  const scrollAndMeasure = useCallback(() => {
    if (!step) return
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const findAndMeasure = (targetSelector) => {
      const el = document.querySelector(targetSelector)
      if (!el) return null
      
      // Check if element is visible
      const isVisible = el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
      if (!isVisible) return null

      // Check if element is inside sticky navbar or header
      const isInsideNav = Boolean(el.closest('.gov-portal-header-wrapper, .gov-nav-bar'))
      if (isInsideNav) {
        // If window is scrolled down, reset window scroll to top smoothly so navbar sits naturally
        if (typeof window !== 'undefined' && window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
        }
        // If element is inside a scrollable dropdown menu, scroll only within the menu container
        const menuContainer = el.closest('.gov-nav-dropdown-menu')
        if (menuContainer) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        }
      } else {
        // In-page element outside the header: center smoothly
        el.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        })
      }

      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        return { top: r.top, left: r.left, width: r.width, height: r.height }
      }
      return null
    }

    const initial = findAndMeasure(step.selector)
    if (initial) {
      setRect(initial)
      return
    }

    // Dropdown opening animation retry
    const retryTimer = setTimeout(() => {
      const retried = findAndMeasure(step.selector)
      if (retried) {
        setRect(retried)
      } else {
        // If element genuinely missing in current view (e.g. mobile hidden), advance
        setIndex((curr) => (curr < STEPS.length - 1 ? curr + 1 : curr))
      }
    }, 180)

    return () => clearTimeout(retryTimer)
  }, [step])

  // Run scrollAndMeasure ONLY when active step/index changes
  useLayoutEffect(() => {
    if (!active) return
    const id = setTimeout(scrollAndMeasure, (step?.openTools || step?.openServices) ? 220 : 40)
    return () => clearTimeout(id)
  }, [active, index, scrollAndMeasure, step])

  // On scroll or resize, ONLY update spotlight coordinates via requestAnimationFrame — NEVER scroll!
  useEffect(() => {
    if (!active) return
    let rafId = null
    const onChange = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateRect)
    }
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [active, updateRect])

  // Finish tour and restore focus to launching element
  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1')
    setActive(false)
    if (onOpenTools) onOpenTools(false)
    if (onOpenServices) onOpenServices(false)
    if (onClose) onClose()

    // Restore focus
    if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
      setTimeout(() => {
        try {
          triggerElementRef.current.focus()
        } catch {
          // ignore focus failure
        }
      }, 50)
    }
  }, [onClose, onOpenTools, onOpenServices])

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) {
      finish()
    } else {
      setIndex((i) => i + 1)
    }
  }, [index, finish])

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Auto-focus Next button when step changes for keyboard convenience
  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => {
        nextBtnRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [active, index])

  // Keyboard navigation & Focus Trapping
  useEffect(() => {
    if (!active) return

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Tab') {
        // Focus trap inside tooltip card
        if (!cardRef.current) return
        const focusable = cardRef.current.querySelectorAll('button:not([disabled])')
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish, next, prev])

  if (!active || !step) return null

  const spot = rect
    ? {
        top: Math.max(8, rect.top - PAD),
        left: Math.max(8, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null

  const tooltip = computeTooltipPos(spot, step.placement)

  return (
    <div style={styles.root} aria-live="polite" role="dialog" aria-modal="true" data-tour-root="true">
      <style>{`
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(8,24,18,0.82), 0 0 0 2px #C87A1E, 0 0 16px 3px rgba(200,122,30,0.5); }
          50% { box-shadow: 0 0 0 9999px rgba(8,24,18,0.82), 0 0 0 3px #F8D18C, 0 0 26px 6px rgba(248,209,140,0.7); }
        }
        @keyframes tourCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tour-spotlight-box {
            animation: none !important;
            transition: none !important;
          }
          .tour-card-box {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* Dimmed backdrop with spotlight cutout */}
      {spot ? (
        <div
          className="tour-spotlight-box"
          style={{
            ...styles.spotlight,
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      ) : (
        <div style={styles.fullDim} />
      )}

      {/* Interactive Tooltip Card with focus trap ref */}
      <div
        ref={cardRef}
        className="tour-card-box"
        style={{ ...styles.tooltip, ...tooltip.style }}
        key={index}
      >
        <div style={styles.stepHeaderRow}>
          <div style={styles.stepCount}>
            {t('tourStep') || 'Step'} {index + 1} / {STEPS.length}
          </div>
          <button
            type="button"
            onClick={finish}
            style={styles.closeIconBtn}
            aria-label="Close tour"
            title="Close tour (Esc)"
          >
            ✕
          </button>
        </div>

        <div style={styles.tipTitle}>{t(step.titleKey)}</div>
        <div style={styles.tipDesc}>{t(step.descKey)}</div>

        {/* Progress indicator */}
        <div style={styles.dots} aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{ ...styles.dot, ...(i === index ? styles.dotActive : {}) }}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div style={styles.btnRow}>
          <button
            type="button"
            onClick={finish}
            style={styles.skipBtn}
            aria-label="Skip tour"
          >
            {t('tourSkip') || 'Skip'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {index > 0 && (
              <button
                type="button"
                onClick={prev}
                style={styles.prevBtn}
                aria-label="Previous step"
              >
                {t('tourPrev') || 'Back'}
              </button>
            )}
            <button
              ref={nextBtnRef}
              type="button"
              onClick={next}
              style={styles.nextBtn}
              aria-label={index >= STEPS.length - 1 ? 'Finish tour' : 'Next step'}
            >
              {index >= STEPS.length - 1 ? (t('tourFinish') || 'Got it!') : (t('tourNext') || 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function computeTooltipPos(spot, placement) {
  const W = Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 24 : 340)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  if (!spot) {
    return { style: { top: Math.max(20, vh / 2 - 110), left: Math.max(12, vw / 2 - W / 2), width: W } }
  }

  let top, left
  if (placement === 'right' && spot.left + spot.width + W + 20 < vw) {
    left = spot.left + spot.width + 16
    top = Math.max(16, Math.min(spot.top, vh - 240))
  } else {
    // bottom placement clamped
    top = spot.top + spot.height + 16
    left = Math.max(12, Math.min(spot.left, vw - W - 12))

    if (top + 220 > vh) {
      top = Math.max(12, spot.top - 230)
    }
  }

  return { style: { top, left, width: W } }
}

const styles = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 100000,
    pointerEvents: 'auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  spotlight: {
    position: 'fixed',
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(8, 24, 18, 0.82)',
    border: '2px solid #C87A1E',
    transition: 'top 0.3s cubic-bezier(0.4,0,0.2,1), left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s, height 0.3s',
    animation: 'tourPulse 2s ease-in-out infinite',
    pointerEvents: 'none',
  },
  fullDim: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 24, 18, 0.85)',
    backdropFilter: 'blur(3px)',
  },
  tooltip: {
    position: 'fixed',
    background: '#FFFFFF',
    borderRadius: 16,
    padding: '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.1)',
    border: '1.5px solid rgba(200, 122, 30, 0.5)',
    animation: 'tourCardIn 0.35s cubic-bezier(0.16,1,0.3,1)',
    zIndex: 100001,
  },
  stepHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stepCount: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#C87A1E',
  },
  closeIconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748B',
    fontSize: 14,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    lineHeight: 1,
  },
  tipTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#143D30',
    marginBottom: 8,
    lineHeight: 1.3,
  },
  tipDesc: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 1.55,
  },
  dots: {
    display: 'flex',
    gap: 5,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(20, 61, 48, 0.2)',
    transition: 'all 0.25s',
  },
  dotActive: {
    background: '#143D30',
    width: 18,
    borderRadius: 6,
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    gap: 8,
  },
  skipBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748B',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '6px 4px',
  },
  prevBtn: {
    background: '#FFFFFF',
    border: '1.5px solid rgba(20, 61, 48, 0.25)',
    color: '#143D30',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '7px 14px',
    borderRadius: 8,
  },
  nextBtn: {
    background: '#143D30',
    border: 'none',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '8px 18px',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(20, 61, 48, 0.3)',
  },
}
