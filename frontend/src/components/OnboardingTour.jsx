import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react'

/**
 * OnboardingTour — a game-style guided walkthrough (COD / Free-Fire onboarding feel).
 *
 * How it works (NOTHING hard-coded to pixels):
 *  - Steps are a data-driven list. Each step names a CSS SELECTOR for a real
 *    element on the page. At runtime the tour reads that element's live
 *    bounding box (getBoundingClientRect) and draws a "spotlight" cutout around
 *    it while the rest of the screen is dimmed + blurred.
 *  - A tooltip card animates in near the highlighted element with the feature's
 *    title + description + Prev / Next / Skip controls and progress dots.
 *  - Recomputes on resize / scroll so the spotlight always tracks the element.
 *  - If a step's element is missing (e.g. a dropdown is closed, or logged-out),
 *    the step is auto-skipped — so it degrades gracefully, never points at nothing.
 *
 * First-visit: auto-starts once (localStorage flag). Re-runnable from the
 * navbar "Tour" button via the `run`/`onClose` props.
 *
 * i18n: title/description come from t() keys, so they translate with the UI.
 */

const STORAGE_KEY = 'ip_sakti_tour_done_v10'

// English fallbacks so the tour is fully functional even before i18n keys exist.
const TOUR_FALLBACK = {
  tourStep: 'Step',
  tourSkip: 'Skip',
  tourPrev: 'Back',
  tourNext: 'Next',
  tourFinish: 'Got it!',
  tourWelcomeTitle: 'Welcome to IP-SAKTI Sahayak! 👋',
  tourWelcomeDesc: 'Your AI guide for Ayurveda IP, patents, TKDL and regulatory questions. Let us show you around in 30 seconds.',
  tourChatTitle: '💬 Ask RagVyn AI',
  tourChatDesc: 'Ask any Ayurveda IP question in your language and get a cited, trustworthy answer — the heart of the app.',
  tourToolsTitle: '🧰 IP Tools',
  tourToolsDesc: 'Open this menu for our smart tools that go beyond chat. Let us highlight each one next.',
  tourVerdictTitle: '⚖️ Patentability Assessment',
  tourVerdictDesc: 'Analyse prior art and Section 3(p)/3(d)/3(e) for your formulation — our evidence-based biopiracy shield.',
  tourRoadmapTitle: '🗺️ IP Journey Roadmap',
  tourRoadmapDesc: 'See your full patent journey — filing to grant to renewals — as a personalized, grounded timeline.',
  tourGuardianTitle: '🧭 Dual-Use Guardian',
  tourGuardianDesc: 'One view for ALL the compliance you need — patent + AYUSH licence + Biodiversity (ABS) + FSSAI.',
  tourFeeTitle: '💰 Fee Calculator',
  tourFeeDesc: 'Estimate your exact patent filing fees (Natural Person / Startup / Others) with all the extra-claim and page charges.',
  tourDeadlineTitle: '📅 Deadline Calculator',
  tourDeadlineDesc: 'Never miss a date — track RFE, FER, publication, renewals and PCT deadlines from your filing date.',
  tourAbsTitle: '🌿 ABS Checker',
  tourAbsDesc: 'Check if your biological resource needs NBA / ABS approval under the Biodiversity Act before you commercialise.',
  tourChecklistTitle: '✅ Filing Checklists',
  tourChecklistDesc: 'Step-by-step interactive checklists for Patent, Trademark, GI and ABS filings with docs, time and fees.',
  tourFtoTitle: '🔍 FTO Analysis',
  tourFtoDesc: 'Identify relevant existing patents and potential infringement risks before commercializing your Ayurvedic formulation.',
  tourServicesTitle: '💼 Services',
  tourServicesDesc: 'Open this menu for hands-on services — draft generation, your case workspace, document upload and expert help.',
  tourDraftsTitle: '📝 Draft Generator',
  tourDraftsDesc: 'Auto-fill official templates — patent Form-1, NBA Form III, and a Section 3(p) opposition petition.',
  tourWorkspaceTitle: '🗂️ Matter Workspace',
  tourWorkspaceDesc: 'Track all your IP cases in one place — statuses, notes and documents per matter (login required).',
  tourDocumentsTitle: '📎 Document Upload',
  tourDocumentsDesc: 'Upload your own PDFs and search them privately — kept separate from the public corpus (login required).',
  tourExpertsTitle: '👥 Expert Connect',
  tourExpertsDesc: 'Find verified IP experts by language and rating, request a consultation, and browse common IP FAQs.',
  tourSeeDemoTitle: '🎬 See Demo',
  tourSeeDemoDesc: 'Watch our 2-minute video walkthrough! See how RagVyn AI answers IP queries, calculates fees, checks ABS compliance and more — all in one quick demo.',
  tourSourcesTitle: '📚 Sources',
  tourSourcesDesc: 'See exactly which laws, acts and treaties power our answers — full transparency you can trust.',
  tourAboutTitle: 'ℹ️ About Us',
  tourAboutDesc: 'Meet Team AyuSync — learn our mission to democratize Ayurveda IP protection, see our tech stack, and discover why we built this platform for AYUSH innovators.',
  tourSidebarTitle: '📂 Chat History & Navigation',
  tourSidebarDesc: 'Your conversation hub on the left! View past chats, start fresh conversations, and quickly access all tools. This sidebar is available when you\'re on the Chat page.',
  tourFinishTitle: '🎉 You are all set!',
  tourFinishDesc: 'That is the whole toolkit. Jump into RagVyn AI to ask your first question — replay this tour anytime from the Tour button.',
}

// Data-driven step list. `selector` is resolved live from the DOM.
// `openTools` tells the tour to open the IP Tools dropdown first (so its
// items exist to be highlighted). titleKey/descKey are i18n keys.
// `optional: true` means skip gracefully if element not found (for sidebar steps).
// `openSidebar: true` tells the tour to dispatch event to open sidebar.
// UPDATED 2026-09-27: Fixed placements - dropdown items use 'left' (tooltip on left of item)
const STEPS = [
  {
    selector: '.gov-brand-wrap',
    titleKey: 'tourWelcomeTitle',
    descKey: 'tourWelcomeDesc',
    placement: 'bottom',
  },
  {
    selector: '.gov-nav-cta',
    titleKey: 'tourChatTitle',
    descKey: 'tourChatDesc',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="ip-tools"]',
    titleKey: 'tourToolsTitle',
    descKey: 'tourToolsDesc',
    placement: 'bottom',
  },
  // ---- IP Tools dropdown items (tooltip BESIDE dropdown - right side) ----
  {
    selector: '.gov-nav-dropdown-menu a[href="/patentability"]',
    titleKey: 'tourVerdictTitle',
    descKey: 'tourVerdictDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/roadmap"]',
    titleKey: 'tourRoadmapTitle',
    descKey: 'tourRoadmapDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/guardian"]',
    titleKey: 'tourGuardianTitle',
    descKey: 'tourGuardianDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/ip-calculator"]',
    titleKey: 'tourFeeTitle',
    descKey: 'tourFeeDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/deadline-calculator"]',
    titleKey: 'tourDeadlineTitle',
    descKey: 'tourDeadlineDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/abs-checker"]',
    titleKey: 'tourAbsTitle',
    descKey: 'tourAbsDesc',
    placement: 'right',
    openTools: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/checklists"]',
    titleKey: 'tourChecklistTitle',
    descKey: 'tourChecklistDesc',
    placement: 'right',
    openTools: true,
  },
  // ---- FTO (standalone nav item) ----
  {
    selector: '[data-tour="fto"]',
    titleKey: 'tourFtoTitle',
    descKey: 'tourFtoDesc',
    placement: 'bottom',
  },
  // ---- Services dropdown ----
  {
    selector: '[data-tour="services"]',
    titleKey: 'tourServicesTitle',
    descKey: 'tourServicesDesc',
    placement: 'bottom',
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/drafts"]',
    titleKey: 'tourDraftsTitle',
    descKey: 'tourDraftsDesc',
    placement: 'right',
    openServices: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/workspace"]',
    titleKey: 'tourWorkspaceTitle',
    descKey: 'tourWorkspaceDesc',
    placement: 'right',
    openServices: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/documents"]',
    titleKey: 'tourDocumentsTitle',
    descKey: 'tourDocumentsDesc',
    placement: 'right',
    openServices: true,
  },
  {
    selector: '.gov-nav-dropdown-menu a[href="/experts"]',
    titleKey: 'tourExpertsTitle',
    descKey: 'tourExpertsDesc',
    placement: 'right',
    openServices: true,
  },
  // ---- Direct navbar links ----
  {
    selector: '[data-tour="see-demo"]',
    titleKey: 'tourSeeDemoTitle',
    descKey: 'tourSeeDemoDesc',
    placement: 'bottom',
  },
  {
    selector: '.gov-nav-link[href="/sources"]',
    titleKey: 'tourSourcesTitle',
    descKey: 'tourSourcesDesc',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="about"]',
    titleKey: 'tourAboutTitle',
    descKey: 'tourAboutDesc',
    placement: 'bottom',
  },
  // ---- Sidebar step - opens sidebar if closed, then highlights it ----
  {
    selector: '.ragvyn-sidebar, .ragvyn-sidebar-mobile-trigger',
    titleKey: 'tourSidebarTitle',
    descKey: 'tourSidebarDesc',
    placement: 'bottom', // Place tooltip below sidebar header
    optional: true, // Skip gracefully if not on /chat page
    openSidebar: true, // Dispatch event to open sidebar before highlighting
  },
  // ---- Finish step ----
  {
    selector: '.gov-nav-cta',
    titleKey: 'tourFinishTitle',
    descKey: 'tourFinishDesc',
    placement: 'bottom',
  },
]

const PAD = 8 // spotlight padding around the target

export default function OnboardingTour({ run, onClose, onOpenTools, onOpenServices, t: tProp }) {
  // t comes from the parent (App's LanguageContext). If parent's t returns the key unchanged
  // (meaning no translation found), fall back to TOUR_FALLBACK.
  const t = (k) => {
    if (tProp) {
      const result = tProp(k)
      // If tProp returns the key itself (no translation), use fallback
      return result === k ? (TOUR_FALLBACK[k] || k) : result
    }
    return TOUR_FALLBACK[k] || k
  }
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)

  // Auto-start on first visit, or when parent sets run=true.
  useEffect(() => {
    if (run) {
      setIndex(0)
      setActive(true)
      return
    }
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      const timer = setTimeout(() => {
        setIndex(0)
        setActive(true)
      }, 1200) // let the page settle first
      return () => clearTimeout(timer)
    }
  }, [run])

  const step = STEPS[index] || null

  // Open whichever dropdown this step needs (and close the other) so its
  // items exist to be highlighted. Also handle sidebar opening.
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
    // Open sidebar when sidebar step is active
    if (step.openSidebar) {
      window.dispatchEvent(new CustomEvent('ragvyn_sidebar_toggled', { detail: { hidden: false } }))
    }
  }, [active, index, step, onOpenTools, onOpenServices])

  // Measure the current target element's live position.
  const measure = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.selector)
    if (!el) {
      setRect(null)
      return
    }
    // Don't scroll for dropdown items - they're already visible in the dropdown
    // scrollIntoView causes positioning issues for absolute/fixed positioned elements
    if (!step.openTools && !step.openServices && !step.openSidebar) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [step])

  useLayoutEffect(() => {
    if (!active) return
    // small delay so a just-opened dropdown has rendered
    const id = setTimeout(measure, (step?.openTools || step?.openServices) ? 240 : 40)
    return () => clearTimeout(id)
  }, [active, index, measure, step])

  useEffect(() => {
    if (!active) return
    const onChange = () => measure()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [active, measure])

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1')
    setActive(false)
    if (onOpenTools) onOpenTools(false)
    if (onOpenServices) onOpenServices(false)
    if (onClose) onClose()
  }, [onClose, onOpenTools, onOpenServices])

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) {
      finish()
    } else {
      // Find next step that has a visible element (skip optional steps if element missing)
      let nextIndex = index + 1
      while (nextIndex < STEPS.length - 1) {
        const nextStep = STEPS[nextIndex]
        const el = document.querySelector(nextStep.selector)
        if (el || !nextStep.optional) break // Found element OR step is required
        nextIndex++ // Skip this optional step
      }
      setIndex(nextIndex)
    }
  }, [index, finish])

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Keyboard: Esc = skip, Right/Enter = next, Left = prev
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish, next, prev])

  if (!active || !step) return null

  // Spotlight box (falls back to a centered box if the element is missing).
  const spot = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null

  // Tooltip position: below or beside the spotlight, clamped to viewport.
  const tooltip = computeTooltipPos(spot, step)

  return (
    <div style={styles.root} aria-live="polite" role="dialog">
      <style>{`
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(8,24,18,0.78), 0 0 0 2px #D4AF37, 0 0 18px 4px rgba(212,175,55,0.5); }
          50% { box-shadow: 0 0 0 9999px rgba(8,24,18,0.78), 0 0 0 3px #D4AF37, 0 0 28px 8px rgba(212,175,55,0.75); }
        }
        @keyframes tourCardIn {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {/* Blurred / dimmed backdrop with a spotlight cutout using box-shadow */}
      {spot ? (
        <div
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

      {/* Tooltip card */}
      <div style={{ ...styles.tooltip, ...tooltip.style }} key={index}>
        <div style={styles.stepCount}>
          {t('tourStep') || 'Step'} {index + 1} / {STEPS.length}
        </div>
        <div style={styles.tipTitle}>{t(step.titleKey)}</div>
        <div style={styles.tipDesc}>{t(step.descKey)}</div>

        {/* progress dots */}
        <div style={styles.dots}>
          {STEPS.map((_, i) => (
            <span key={i} style={{ ...styles.dot, ...(i === index ? styles.dotActive : {}) }} />
          ))}
        </div>

        <div style={styles.btnRow}>
          <button type="button" onClick={finish} style={styles.skipBtn}>
            {t('tourSkip') || 'Skip'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {index > 0 && (
              <button type="button" onClick={prev} style={styles.prevBtn}>
                {t('tourPrev') || 'Back'}
              </button>
            )}
            <button type="button" onClick={next} style={styles.nextBtn}>
              {index >= STEPS.length - 1 ? (t('tourFinish') || 'Got it!') : (t('tourNext') || 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function computeTooltipPos(spot, step) {
  const placement = step?.placement || 'bottom'
  const forceLeftOffset = step?.forceLeftOffset || 0
  const W = 320
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  if (!spot) {
    return { style: { top: vh / 2 - 90, left: vw / 2 - W / 2, width: W } }
  }
  let top, left
  
  // For 'auto' or dropdown items: detect which side has more room
  if (placement === 'auto' || placement === 'right' || placement === 'left') {
    // If forceLeftOffset is set (e.g., sidebar step), use that as minimum left position
    const minLeft = forceLeftOffset || 0
    const spaceOnRight = vw - (spot.left + spot.width)
    const spaceOnLeft = spot.left
    
    if (forceLeftOffset > 0) {
      // Force tooltip to start at the specified left offset (after sidebar)
      left = forceLeftOffset
      top = spot.top
    } else if (spaceOnRight >= W + 20) {
      // Enough room on right
      left = spot.left + spot.width + 16
      top = spot.top
    } else if (spaceOnLeft >= W + 20) {
      // Enough room on left  
      left = spot.left - W - 16
      top = spot.top
    } else {
      // Not enough room on either side -> put below
      left = Math.max(12, Math.min(spot.left, vw - W - 12))
      top = spot.top + spot.height + 16
    }
    
    // Clamp vertical position
    if (top + 200 > vh) top = Math.max(12, spot.top - 200)
  } else {
    // bottom (default)
    top = spot.top + spot.height + 16
    left = spot.left
    if (left + W > vw - 12) left = vw - W - 12
    if (left < 12) left = 12
    if (top + 200 > vh) top = Math.max(12, spot.top - 200) // flip above
  }
  return { style: { top, left, width: W } }
}

const styles = {
  root: { position: 'fixed', inset: 0, zIndex: 100000, pointerEvents: 'auto' },
  // The spotlight: a transparent box whose HUGE box-shadow dims everything else.
  spotlight: {
    position: 'fixed',
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(8, 24, 18, 0.78)',
    border: '2px solid #D4AF37',
    transition: 'top 0.35s cubic-bezier(0.4,0,0.2,1), left 0.35s cubic-bezier(0.4,0,0.2,1), width 0.35s, height 0.35s',
    animation: 'tourPulse 1.8s ease-in-out infinite',
    pointerEvents: 'none',
  },
  fullDim: { position: 'fixed', inset: 0, background: 'rgba(8,24,18,0.82)', backdropFilter: 'blur(3px)' },
  tooltip: {
    position: 'fixed',
    background: '#fff',
    borderRadius: 16,
    padding: '20px 22px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    border: '1px solid rgba(212,175,55,0.4)',
    animation: 'tourCardIn 0.4s cubic-bezier(0.16,1,0.3,1)',
    transition: 'top 0.35s ease, left 0.35s ease',
  },
  stepCount: { fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#D4AF37', marginBottom: 6 },
  tipTitle: { fontSize: 19, fontWeight: 800, color: '#143D30', marginBottom: 8, lineHeight: 1.3 },
  tipDesc: { fontSize: 14.5, color: '#3A4A3A', lineHeight: 1.6 },
  dots: { display: 'flex', gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: 'rgba(20,61,48,0.2)', transition: 'all 0.3s' },
  dotActive: { background: '#1E8449', width: 22, borderRadius: 6 },
  btnRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 10 },
  skipBtn: { background: 'transparent', border: 'none', color: '#7A8A7A', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: '8px 4px' },
  prevBtn: { background: '#fff', border: '2px solid rgba(20,61,48,0.2)', color: '#143D30', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', borderRadius: 10 },
  nextBtn: { background: 'linear-gradient(135deg,#143D30,#1E8449)', border: 'none', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', padding: '9px 20px', borderRadius: 10 },
}
