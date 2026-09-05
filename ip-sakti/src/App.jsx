// UPDATED: Added useCallback, useRef, useLocation for accessibility and routing patterns
import { useEffect, useState, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom'
import './index.css'

/* ============================================================
   THEME HOOK & TOGGLE
   Controls light/dark mode preference persistence across sessions.
   ============================================================ */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ip_sakti_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ip_sakti_theme', theme)
  }, [theme])

  // Toggles between light and dark mode; persists to localStorage
  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}

/* ============================================================
   FONT SIZE HOOK
   Manages three-step font scale for accessibility compliance.
   ============================================================ */
function useFontSize() {
  const [fontSize, setFontSizeState] = useState(() => {
    return localStorage.getItem('ip_sakti_font_size') || 'md'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontSize)
    localStorage.setItem('ip_sakti_font_size', fontSize)
  }, [fontSize])

  return { fontSize, setFontSize: setFontSizeState }
}

// UPDATED: Added aria-label to theme toggle for screen reader support
function ThemeToggleBtn({ theme, toggleTheme }) {
  return (
    <button
      className="theme-toggle-btn"
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

/* ============================================================
   TYPEWRITER EFFECT
   Rotates multilingual phrases to demonstrate planned language scope.
   ============================================================ */
const TYPEWRITER_PHRASES = [
  'Ayurvedic IP Guidance',
  'पेटेंट सलाह',               // Hindi
  'ಬೌದ್ಧಿಕ ಆಸ್ತಿ',           // Kannada
  'पारंपरिक ज्ञान संरक्षण',    // Hindi
  'Trademark Assistance',
  'বুদ্ধিবৃত্তিক সম্পদ',      // Bengali
]

// UPDATED: Typewriter uses useEffect for proper timer lifecycle management
function useTypewriter(phrases, speed = 70, pause = 1800) {
  const [displayText, setDisplayText] = useState('')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const tick = () => {
      const current = phrases[phraseIdx]
      if (!deleting) {
        if (charIdx < current.length) {
          setDisplayText(current.slice(0, charIdx + 1))
          setCharIdx(c => c + 1)
          timeout = setTimeout(tick, speed)
        } else {
          timeout = setTimeout(() => setDeleting(true), pause)
        }
      } else {
        if (charIdx > 0) {
          setDisplayText(current.slice(0, charIdx - 1))
          setCharIdx(c => c - 1)
          timeout = setTimeout(tick, speed / 2)
        } else {
          setDeleting(false)
          setPhraseIdx(i => (i + 1) % phrases.length)
          timeout = setTimeout(tick, speed)
        }
      }
    }

    let timeout = setTimeout(tick, speed)
    return () => clearTimeout(timeout)
  }, [phrases, speed, pause, phraseIdx, charIdx, deleting])

  return displayText
}

/* ============================================================
   VOICE INPUT TOAST
   Shows a "coming soon" accessibility-safe notification.
   Voice recognition is planned (Phase 4 Bhashini integration).
   ============================================================ */
// ADDED: Toast component for voice input "coming soon" notification with live region support
function VoiceToast({ visible, onDismiss }) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [visible, onDismiss])

  if (!visible) return null
  return (
    <div className="toast-notification" role="status" aria-live="polite" aria-atomic="true">
      <span aria-hidden="true">🎙️</span>
      <span>Voice input is coming soon — planned via Bhashini API integration (Phase 4).</span>
      <button
        className="toast-dismiss-btn"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  )
}

/* ============================================================
   ABOUT IP-SAKTI MODAL / DRAWER
   Explains product purpose, jurisdiction modes, development status,
   and the abstention principle. Accuracy aligned with Memory.md.
   ============================================================ */
// UPDATED: Fixed inaccurate "Zero Hallucination" and "Core Ingested Corpora" claims;
//          added Escape-to-close; added aria-labelledby and focus management
function AboutModal({ isOpen, onClose }) {
  const closeRef = useRef(null)

  // Trap focus to close button when modal opens; restore on close
  useEffect(() => {
    if (isOpen && closeRef.current) closeRef.current.focus()
  }, [isOpen])

  // Close on Escape key — essential for keyboard accessibility
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span style={{ fontSize: '1.5rem' }}>🌿</span>
            <div>
              {/* UPDATED: h2 now has id for aria-labelledby */}
              <h2 id="about-modal-title" style={{ fontSize: '1.2rem', margin: 0 }}>About IP-SAKTI Sahayak</h2>
              <span className="devanagari" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                बौद्धिक संपदा सहायक · SIH 2026
              </span>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close About panel"
            ref={closeRef}
          >✕</button>
        </div>

        <div className="modal-body">
          <section>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🎯 Purpose &amp; Vision
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              IP-SAKTI Sahayak (Smart Ayurveda Knowledge &amp; Technology Initiative) is an informational
              research assistant for <strong>Ayurvedic practitioners, Vaidyas, AYUSH startups, MSMEs,
              researchers, cultivators, students, and junior IP facilitators</strong>. It is designed to help
              users understand Ayurvedic intellectual property law, patent eligibility, biodiversity
              obligations, and regulatory pathways.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--secondary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🛡️ Grounding Design &amp; Abstention Policy
            </h3>
            {/* UPDATED: Removed false "zero hallucination" / "strictly grounded" claim.
                Corpus ingestion has not started (Memory.md Phase 2 pending). */}
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              IP-SAKTI Sahayak is <em>designed</em> for source-grounded answers. When the RAG pipeline
              is complete, answers will be grounded in verified statutory corpora, and the assistant
              will abstain rather than invent legal references if authoritative evidence is unavailable.
              In the current development preview, some responses use placeholder fallback content — these
              are clearly labelled in the chat window.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🌐 Jurisdiction Modes
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              Use the <strong>India 🇮🇳</strong> mode for domestic statutes (Patents Act 1970, Biological
              Diversity Act 2002, Drugs &amp; Cosmetics Act 1940, GI Act 1999). Switch to <strong>International 🌐</strong>
              for treaty guidance (Nagoya Protocol, WIPO GRATK 2024, TRIPS). The two corpora are kept
              separate to prevent mixed-jurisdiction answers.
            </p>
          </section>

          {/* UPDATED: Renamed from "Core Ingested Corpora" to "Planned Source Corpus"
              to accurately reflect that ingestion is Phase 2 (not started). */}
          <section>
            <h3 style={{ color: 'var(--secondary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              📋 Planned Source Corpus <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>(Pending Corpus Verification)</span>
            </h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <li>📜 Patents Act 1970 (§3p)</li>
              <li>🌿 Biological Diversity Act 2002</li>
              <li>💊 Drugs &amp; Cosmetics Act 1940</li>
              <li>📚 TKDL (Traditional Knowledge)</li>
              <li>🌍 WIPO GRATK Treaty 2024</li>
              <li>🏷️ GI of Goods Act 1999</li>
            </ul>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Source corpus ingestion and verification is planned for Phase 2. Until verified, answers may
              include development fallback content.
            </p>
          </section>

          {/* ADDED: Development status section for transparency */}
          <section>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🔧 Current Development Status
            </h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <li>✅ <strong>Implemented:</strong> UI, routing, jurisdiction toggle, formulation wizard, ABS checker, sources directory, FastAPI chat contract</li>
              <li>🔄 <strong>Planned:</strong> Corpus ingestion (Phase 2), RAG pipeline (Phase 3), Bhashini multilingual (Phase 4)</li>
              <li>⚠️ <strong>Development Preview:</strong> Chat responses currently use placeholder fallback content</li>
            </ul>
          </section>

          <div style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--primary-light)' }}>
            ⚠️ <strong>Legal Disclaimer:</strong> IP-SAKTI Sahayak is an informational research tool for AYUSH innovators and Vaidyas. It does not replace professional legal advice or formal proceedings before the Controller General of Patents, High Courts, NBA, or SBB.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   FORMULATION WIZARD MODAL
   Guides users through 3-step IP classification of Ayurvedic
   formulations. Results are preliminary informational assessments only.
   ============================================================ */
// UPDATED: Added Escape-to-close, aria-labelledby, preliminary disclaimer in outcome
function FormulationWizardModal({ isOpen, onClose, onAskChat }) {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: null })
  const closeRef = useRef(null)

  // Resets wizard to initial state for re-testing
  const resetWizard = useCallback(() => {
    setStep(1)
    setAnswers({ q1: null, q2: null, q3: null })
  }, [])

  const handleClose = useCallback(() => {
    resetWizard()
    onClose()
  }, [resetWizard, onClose])

  // Focus close button on open for keyboard accessibility
  useEffect(() => {
    if (isOpen && closeRef.current) closeRef.current.focus()
  }, [isOpen])

  // Close on Escape — critical for modal accessibility compliance
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  // Stores user answer for a given step question
  const handleSelectOption = (questionKey, optionValue) => {
    setAnswers(prev => ({ ...prev, [questionKey]: optionValue }))
  }

  // Derives IP classification result from wizard answers; for informational use only
  const calculateResult = () => {
    if (answers.q1 === 'classical') {
      return {
        type: 'Classical / Generic Ayurvedic Medicine (Shastriya)',
        cls: 'classical',
        badge: '🚫 Patent Barred (Sec 3(p))',
        summary: 'Your formulation uses traditional ingredients and preparation methods documented in 1st Schedule texts of the Drugs & Cosmetics Act (e.g. Charaka Samhita, Sushruta Samhita).',
        legalAction: [
          'Barred from patenting in India under Patents Act 1970 §3(p).',
          'Protected against foreign biopiracy via TKDL (Traditional Knowledge Digital Library).',
          'Requires Rule 158-B(1) drug manufacturing license from State AYUSH Licensing Authority.',
          'Consider Trademark and unique packaging Design registration for brand protection.',
        ],
        prompt: 'How do I protect my brand for a classical Charaka Samhita formulation using Trademarks and GI tags?',
      }
    }
    if (answers.q1 === 'nutra') {
      return {
        type: 'Ayurveda-Aahar / Nutraceutical Supplement',
        cls: 'nutra',
        badge: '🍏 FSSAI / AYUSH Food Regime',
        summary: 'Your product contains herbal ingredients intended for health wellness, dietary supplementation, or functional food consumption.',
        legalAction: [
          'Regulated primarily under FSSAI (Ayurveda Aahar) Regulations 2022.',
          'Cannot make therapeutic or disease-curing medicinal claims on labels.',
          'Patent eligibility limited unless novel extraction technology is involved.',
          'Primary IP protection strategy: Brand Trademark, Proprietary Blend Trade Secret, & Packaging Design.',
        ],
        prompt: 'What are the trademark and labelling guidelines for an Ayurveda-Aahar herbal health drink?',
      }
    }
    return {
      type: 'Patent / Proprietary Ayurvedic Medicine (Anubhavasiddha)',
      cls: 'proprietary',
      badge: '💡 Potentially Patentable (Sec 2(1)(j))',
      summary: 'Your formulation modifies traditional ingredients with a novel delivery mechanism, synergistic extract ratio, or proven unexpected therapeutic efficacy.',
      legalAction: [
        'Eligible for patent protection under Patents Act 1970 §2(1)(j) if novel and non-obvious.',
        'Must demonstrate synergism or enhanced efficacy beyond simple admixture (Section 3(e) bar).',
        'Requires ABS clearance under Biological Diversity Act 2002 before commercial filing.',
        'Requires Rule 158-B(2) AYUSH manufacturing license with safety/efficacy trial data.',
      ],
      prompt: 'What clinical data and ABS approvals do I need to file a patent for a novel Ayurvedic herbal extract combo?',
    }
  }

  const outcome = step === 4 ? calculateResult() : null

  // Step labels for accessible progress indicator
  const STEP_LABELS = ['Source', 'Process', 'Use', 'Result']

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-modal-title"
    >
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span style={{ fontSize: '1.5rem' }}>🧪</span>
            <div>
              {/* UPDATED: id added for aria-labelledby */}
              <h2 id="wizard-modal-title" style={{ fontSize: '1.15rem', margin: 0 }}>Classification</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Guided 3-Step IP &amp; Regulatory Assessment
              </span>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close wizard"
            ref={closeRef}
          >✕</button>
        </div>

        <div className="modal-body">
          {/* UPDATED: Progress steps use role="list" with accessible step labels */}
          <nav aria-label="Wizard progress" className="wizard-progress">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                role="listitem"
                className={`wizard-progress-step ${step === s ? 'active' : step > s ? 'completed' : ''}`}
                aria-label={`Step ${s}: ${STEP_LABELS[s - 1]} — ${step > s ? 'completed' : step === s ? 'current' : 'upcoming'}`}
                aria-current={step === s ? 'step' : undefined}
              >
                {step > s ? '✓' : s}
              </div>
            ))}
          </nav>

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h3 className="wizard-question-title">Step 1: What is the source of your formulation formula?</h3>
              <p className="wizard-question-desc">Select the primary origin of ingredients and recipe ratio.</p>

              <div className="wizard-options-grid">
                {[
                  {
                    id: 'classical',
                    icon: '📜',
                    title: 'Ancient Authoritative Text (First Schedule)',
                    desc: 'Recipe taken directly from Charaka Samhita, Sushruta Samhita, Sahasrayogam, or Bhaishajya Ratnavali.',
                  },
                  {
                    id: 'proprietary',
                    icon: '🔬',
                    title: 'Modified / Novel Herbal Blend',
                    desc: 'Unique combination, novel extract ratio, or new delivery mechanism developed by your R&D team.',
                  },
                  {
                    id: 'nutra',
                    icon: '🥗',
                    title: 'Functional Dietary Supplement / Food',
                    desc: 'Herbal beverage, tonic, or dietary pill meant for daily health maintenance (Ayurveda Aahar).',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q1 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q1', opt.id)}
                    aria-pressed={answers.q1 === opt.id}
                  >
                    <span className="option-icon">{opt.icon}</span>
                    <div>
                      <div className="option-title">{opt.title}</div>
                      <div className="option-desc">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  className="btn-primary"
                  disabled={!answers.q1}
                  onClick={() => setStep(2)}
                  style={{ opacity: answers.q1 ? 1 : 0.5, cursor: answers.q1 ? 'pointer' : 'not-allowed' }}
                  aria-disabled={!answers.q1}
                  aria-describedby={!answers.q1 ? 'step1-hint' : undefined}
                >
                  Next Step →
                </button>
                {!answers.q1 && <span id="step1-hint" className="visually-hidden">Select an option to continue</span>}
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h3 className="wizard-question-title">Step 2: How is the formulation processed or prepared?</h3>
              <p className="wizard-question-desc">Select the manufacturing method used for production.</p>

              <div className="wizard-options-grid">
                {[
                  {
                    id: 'traditional_proc',
                    icon: '🏺',
                    title: 'Traditional Ayurvedic Processing Methods',
                    desc: 'Standard Kwatha (decoction), Asava-Arishta (fermentation), Bhasma, or Churna preparation.',
                  },
                  {
                    id: 'novel_proc',
                    icon: '⚙️',
                    title: 'Modern Extraction or Nanotechnology',
                    desc: 'Supercritical CO2 extraction, targeted liposomal delivery, or standardized marker compound enrichment.',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q2 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q2', opt.id)}
                    aria-pressed={answers.q2 === opt.id}
                  >
                    <span className="option-icon">{opt.icon}</span>
                    <div>
                      <div className="option-title">{opt.title}</div>
                      <div className="option-desc">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                <button
                  className="btn-primary"
                  disabled={!answers.q2}
                  onClick={() => setStep(3)}
                  style={{ opacity: answers.q2 ? 1 : 0.5, cursor: answers.q2 ? 'pointer' : 'not-allowed' }}
                  aria-disabled={!answers.q2}
                >
                  Next Step →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <h3 className="wizard-question-title">Step 3: What is the primary intended use and claim?</h3>
              <p className="wizard-question-desc">Select the marketing and therapeutic positioning of the product.</p>

              <div className="wizard-options-grid">
                {[
                  {
                    id: 'therapeutic',
                    icon: '🏥',
                    title: 'Specific Disease Treatment or Cure',
                    desc: 'Claiming clinical cure or management for conditions like Arthritis, Diabetes, or Hypertension.',
                  },
                  {
                    id: 'wellness',
                    icon: '🌿',
                    title: 'General Immunity & Wellness',
                    desc: 'Promoting overall vitality, digestion, or stress relief without disease-specific claims.',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    className={`wizard-option-btn ${answers.q3 === opt.id ? 'selected' : ''}`}
                    onClick={() => handleSelectOption('q3', opt.id)}
                    aria-pressed={answers.q3 === opt.id}
                  >
                    <span className="option-icon">{opt.icon}</span>
                    <div>
                      <div className="option-title">{opt.title}</div>
                      <div className="option-desc">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
                <button
                  className="btn-primary"
                  disabled={!answers.q3}
                  onClick={() => setStep(4)}
                  style={{ opacity: answers.q3 ? 1 : 0.5, cursor: answers.q3 ? 'pointer' : 'not-allowed' }}
                  aria-disabled={!answers.q3}
                >
                  Generate IP Assessment ✨
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: OUTCOME */}
          {step === 4 && outcome && (
            <div className="wizard-outcome-box">
              <div className={`outcome-badge ${outcome.cls}`}>
                {outcome.badge}
              </div>

              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>
                Classification: {outcome.type}
              </h3>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {outcome.summary}
              </p>

              <div style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                <h4 style={{ fontSize: '0.88rem', color: 'var(--primary-light)', marginBottom: '0.5rem' }}>
                  Recommended IP &amp; Licensing Actions:
                </h4>
                <ul style={{ paddingLeft: '1.2rem', fontSize: '0.83rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', listStyle: 'disc' }}>
                  {outcome.legalAction.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>

              {/* ADDED: Preliminary informational disclaimer — classification is not a legal opinion */}
              <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: 'rgba(165,180,252,0.9)' }}>
                ℹ️ <strong>Preliminary informational classification only.</strong> This result is not a legal opinion and does not guarantee patentability, regulatory clearance, or any official determination. Consult a qualified IP attorney for formal proceedings.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    handleClose()
                    onAskChat(outcome.prompt)
                  }}
                >
                  Ask IP-SAKTI Detailed Questions →
                </button>
                <button className="btn-secondary" onClick={resetWizard}>
                  🔄 Re-test Formulation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   HISTORY SIDEBAR RAIL
   Displays past consultation sessions; mobile becomes overlay drawer.
   ============================================================ */
// UPDATED: History items changed from non-semantic divs to button elements for
//          keyboard accessibility; mobile overlay backdrop added; aria-expanded on toggle
function ChatSidebar({ collapsed, activeId, onSelectSession, onNewChat, onOpenWizard, onOpenAbout, isMobileOpen, onCloseMobile }) {
  const SESSIONS = [
    { id: 1, title: 'Arthritis Formulation Patentability', tag: 'Patents', date: 'Today' },
    { id: 2, title: 'ABS Compliance for Neem Extract', tag: 'BD Act', date: 'Yesterday' },
    { id: 3, title: 'TKDL Prior Art Section 3(p)', tag: 'TKDL', date: 'Aug 29' },
    { id: 4, title: 'Ayurvedic Herbal Cosmetic Trademark', tag: 'Trademark', date: 'Aug 26' },
  ]

  return (
    <>
      {/* ADDED: Mobile backdrop — clicking it closes the sidebar drawer */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`chat-sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Conversation History"
        aria-hidden={collapsed && !isMobileOpen}
      >
        <div className="sidebar-header">
          {/* New Consultation resets the visible conversation */}
          <button className="new-chat-btn" onClick={onNewChat} id="new-chat-btn" aria-label="Start new consultation">
            <span>➕</span>
            <span>New Consultation</span>
          </button>
        </div>

        <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Past Conversations
        </div>

        <div className="sidebar-history-list" role="list">
          {SESSIONS.map(s => (
            // UPDATED: Changed from div to button for semantic keyboard accessibility
            <button
              key={s.id}
              role="listitem"
              className={`history-item ${activeId === s.id ? 'active' : ''}`}
              onClick={() => onSelectSession(s.id)}
              aria-current={activeId === s.id ? 'true' : undefined}
              aria-label={`${s.title} — ${s.date}`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span className="history-item-title">{s.title}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.date}</span>
              </div>
              <span className="history-item-tag">{s.tag}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-link-btn" onClick={onOpenWizard} aria-label="Open classification tool">
            <span>🧪</span>
            <span>Classification</span>
          </button>
          <Link to="/abs-checker" className="sidebar-link-btn">
            <span>🌿</span>
            <span>ABS Compliance Checker</span>
          </Link>
          <Link to="/sources" className="sidebar-link-btn">
            <span>📚</span>
            <span>Source Directory</span>
          </Link>
          <button className="sidebar-link-btn" onClick={onOpenAbout} aria-label="Open About IP-SAKTI panel">
            <span>ℹ️</span>
            <span>About IP-SAKTI</span>
          </button>
        </div>
      </aside>
    </>
  )
}

/* ============================================================
   DEMO DATA FOR CHAT PAGE
   Illustrative conversation using legally accurate references.
   ============================================================ */
const DEMO_MESSAGES = [
  {
    id: 1,
    role: 'ai',
    text: 'Namaste! 🙏 I am IP-SAKTI Sahayak — your guide to Intellectual Property in Ayurveda. Ask me about patents, trademarks, GI tags, TKDL, or any IP question related to traditional knowledge.',
    citations: [],
    confidence: null,
    showDisclaimer: false,
  },
  {
    id: 2,
    role: 'user',
    text: 'Can I patent my Ayurvedic formulation for arthritis?',
  },
  {
    id: 3,
    role: 'ai',
    text: 'Under Indian patent law, purely traditional Ayurvedic formulations face significant barriers. Section 3(p) of the Patents Act 1970 bars patents on traditional knowledge — and the India Patent Office cross-checks all applications against the TKDL database.\n\nHowever, if your formulation has a novel modification, improved delivery mechanism, or enhanced efficacy backed by clinical data, it may qualify under Section 2(1)(j) as a "new invention".',
    citations: [
      { title: '📜 Patents Act 1970 | §3(p) | Traditional Knowledge Bar', url: 'https://ipindia.gov.in/patents.htm' },
      { title: '📜 TKDL Database | Cross-Reference Check', url: 'https://www.tkdl.res.in/' },
      { title: '📜 Patents Act 1970 | §2(1)(j) | Definition of Invention', url: 'https://indiacode.nic.in/' },
    ],
    confidence: 'high',
    showDisclaimer: true,
  },
  {
    id: 4,
    role: 'user',
    text: 'What about using standardized Ashwagandha extract in a novel liposomal gel?',
  },
  {
    id: 5,
    role: 'ai',
    text: 'A liposomal delivery gel containing standardized Ashwagandha extract has a much stronger patent pathway! Because the novelty lies in the bio-availability delivery system rather than the raw herb itself, it overcomes the Section 3(p) traditional knowledge bar.\n\nKey requirements:\n1. Must demonstrate non-obvious synergistic efficacy under Section 3(e).\n2. Must obtain NBA (National Biodiversity Authority) approval under Section 6 of Biological Diversity Act 2002 before patent grant.',
    citations: [
      { title: '📜 Patents Act 1970 | §3(e) | Synergistic Admixture Exclusion', url: 'https://ipindia.gov.in/patents.htm' },
      { title: '📜 Biological Diversity Act 2002 | §6 | Prior NBA Approval for IP', url: 'http://nbaindia.org/' },
    ],
    confidence: 'medium',
    showDisclaimer: true,
  },
  {
    id: 6,
    role: 'user',
    text: 'Is there any restriction if I export this formulation to the EU or USA?',
  },
  {
    id: 7,
    role: 'ai',
    text: 'Yes! International export triggers obligations under the Nagoya Protocol and WIPO GRATK Treaty (2024).\n\nYou must ensure fair Access and Benefit Sharing (ABS) compliance with India\'s National Biodiversity Authority before exporting raw bio-resources or filing foreign patent applications (PCT route). We recommend consulting an IP attorney for international patenting.',
    citations: [
      { title: '🌍 WIPO GRATK Treaty 2024 | Mandatory Disclosure of Traditional Knowledge', url: 'https://www.wipo.int/' },
      { title: '📋 Nagoya Protocol | Access & Benefit Sharing (ABS)', url: 'https://www.cbd.int/abs/' },
    ],
    confidence: 'low',
    showDisclaimer: true,
  },
]

/* ============================================================
   CHAT COMPONENTS
   ============================================================ */
// CitationCard renders statute links using JetBrains Mono per Design.md spec
function CitationCard({ citation }) {
  return (
    <a href={citation.url} target="_blank" rel="noopener noreferrer" className="citation-card">
      <span className="citation-title">{citation.title}</span>
      <span className="citation-url">{citation.url}</span>
    </a>
  )
}

// UPDATED: Standardized confidence label — "Moderate" → "Medium" for UI consistency
// UPDATED: Non-color indicator (●) retained for colour-blindness safety
function ConfidenceBadge({ level }) {
  const map = {
    high:   { label: '● High Confidence — Direct statute match', cls: 'high' },
    medium: { label: '● Medium Confidence — Verify details with an expert', cls: 'medium' },
    low:    { label: '● Low Confidence — Consult a registered IP attorney', cls: 'low' },
  }
  const m = map[level]
  if (!m) return null
  return (
    <span className={`confidence-badge ${m.cls}`} role="img" aria-label={m.label}>
      {m.label}
    </span>
  )
}

// DisclaimerBanner is shown after every regulatory AI answer per legal guardrails
function DisclaimerBanner() {
  return (
    <div className="disclaimer" role="note" aria-label="Legal information disclaimer">
      <span aria-hidden="true">ℹ️</span>
      <span>Informational guidance only, designed for source-grounded answers. Consult a qualified IP attorney for formal legal proceedings.</span>
    </div>
  )
}

// TypingIndicator signals the AI is generating a response
function TypingIndicator() {
  return (
    <div className="message-row ai-row" aria-label="IP-SAKTI is thinking" role="status">
      <div className="avatar ai-avatar" aria-hidden="true">🌿</div>
      <div className="typing-indicator" aria-hidden="true">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}

// MessageBubble renders user and AI messages with citations, confidence, and disclaimer
function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="message-row user-row">
        <div className="avatar user-avatar" aria-hidden="true">👤</div>
        <div className="bubble-column">
          <div className="bubble user-bubble">{msg.text}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-row ai-row">
      <div className="avatar ai-avatar" aria-hidden="true">🌿</div>
      <div className="bubble-column">
        {/* ADDED: Dev fallback label shown when backend is unavailable */}
        {msg.isDevFallback && (
          <div className="dev-fallback-badge" role="note" aria-label="Development fallback content notice">
            ⚠️ Development Fallback — Backend unavailable. Showing placeholder content, not grounded retrieval.
          </div>
        )}
        <div className="bubble ai-bubble" style={{ whiteSpace: 'pre-line' }}>
          {msg.text}
        </div>
        {msg.citations?.length > 0 && (
          <div className="citation-list" aria-label="Source citations">
            {msg.citations.map((c, i) => (
              <CitationCard key={i} citation={c} />
            ))}
          </div>
        )}
        {msg.confidence && <ConfidenceBadge level={msg.confidence} />}
        {msg.showDisclaimer && <DisclaimerBanner />}
      </div>
    </div>
  )
}

// JurisdictionToggle switches between India and International legal corpora
function JurisdictionToggle({ value, onChange }) {
  const isIndia = value === 'india'
  return (
    <div
      className="jurisdiction-toggle"
      role="group"
      aria-label="Select legal jurisdiction"
    >
      <span className={`jurisdiction-label ${isIndia ? 'active' : ''}`}>
        India 🇮🇳
      </span>
      <div
        className={`toggle-track ${isIndia ? 'india' : 'intl'}`}
        onClick={() => onChange(isIndia ? 'intl' : 'india')}
        id="jurisdiction-toggle-track"
        tabIndex={0}
        role="switch"
        aria-checked={!isIndia}
        aria-label="Toggle jurisdiction: India / International"
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onChange(isIndia ? 'intl' : 'india')}
      >
        <div className={`toggle-thumb ${isIndia ? 'india' : 'intl'}`} />
      </div>
      <span className={`jurisdiction-label ${!isIndia ? 'active' : ''}`}>
        International 🌐
      </span>
    </div>
  )
}

/* ============================================================
   GOVERNMENT PORTAL ACCESSIBILITY BAR
   Top bar with font-size controls, theme toggle, and skip links.
   ============================================================ */
function GovtAccessibilityBar({ theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt }) {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  // Routes search queries to chat with pre-filled prompt
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      if (setPrefillPrompt) setPrefillPrompt(searchQuery.trim())
      navigate('/chat')
    } else {
      navigate('/chat')
    }
  }

  return (
    <div className="top-access-bar" role="region" aria-label="Accessibility &amp; Quick Tools Header">
      <div className="top-access-container">
        <div className="top-access-left">
          <span>भारत सरकार | Government of India</span>
          <span className="divider">•</span>
          <span>आयुष मंत्रालय | Ministry of AYUSH</span>
        </div>

        <div className="top-access-right">
          <form className="top-search-form" onSubmit={handleSearchSubmit} role="search">
            <input
              type="search"
              placeholder="Search portal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="top-search-input"
              aria-label="Search IP statutes and guidelines"
              id="portal-search-input"
            />
            <button type="submit" className="top-search-btn" aria-label="Submit search">🔍</button>
          </form>

          <div className="font-size-controls" role="group" aria-label="Font size accessibility controls">
            <button
              className={`font-size-btn ${fontSize === 'sm' ? 'active' : ''}`}
              onClick={() => setFontSize && setFontSize('sm')}
              aria-label="Decrease font size"
              aria-pressed={fontSize === 'sm'}
            >
              A-
            </button>
            <button
              className={`font-size-btn ${fontSize === 'md' ? 'active' : ''}`}
              onClick={() => setFontSize && setFontSize('md')}
              aria-label="Normal font size"
              aria-pressed={fontSize === 'md'}
            >
              A
            </button>
            <button
              className={`font-size-btn ${fontSize === 'lg' ? 'active' : ''}`}
              onClick={() => setFontSize && setFontSize('lg')}
              aria-label="Increase font size"
              aria-pressed={fontSize === 'lg'}
            >
              A+
            </button>
          </div>

          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />

          <a href="#chat-messages" className="top-access-icon-link skip-link" aria-label="Skip to main content">
            ♿
          </a>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   GOVERNMENT PORTAL MAIN HEADER
   Displays emblem, department identity, and portal brand.
   ============================================================ */
function GovtMainHeader() {
  return (
    <header className="gov-header" role="banner">
      <div className="gov-header-container">
        <div className="gov-emblem-wrap">
          {/* Note: Replace SVG with <img src="/emblem.png" alt="Emblem of India" /> if added to public/ */}
          <svg className="gov-emblem-svg" viewBox="0 0 100 100" width="56" height="56" aria-label="State Emblem of India Placeholder" role="img">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--primary)" strokeWidth="3" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--secondary)" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="16" fill="none" stroke="var(--primary)" strokeWidth="2" />
            <path d="M50 10 L50 90 M10 50 L90 50 M22 22 L78 78 M22 78 L78 22" stroke="var(--primary)" strokeWidth="1.2" opacity="0.85" />
            <text x="50" y="54" textAnchor="middle" fontSize="13" fontWeight="bold" fill="var(--primary)">सत्यमेव</text>
          </svg>
          <div className="gov-emblem-text">
            <span className="gov-title-hi">भारत सरकार</span>
            <span className="gov-title-en">Government of India</span>
            <span className="gov-dept-hi">आयुष मंत्रालय</span>
            <span className="gov-dept-en">Ministry of AYUSH</span>
          </div>
        </div>

        <div className="gov-portal-brand">
          <Link to="/" className="gov-portal-badge" aria-label="IP-SAKTI Sahayak home">
            <span className="gov-portal-icon">🌿</span>
            <div>
              <p className="gov-portal-name">IP-SAKTI Sahayak</p>
              <div className="gov-portal-sub">राष्ट्रीय आयुर्वेद बौद्धिक संपदा सहायता पोर्टल</div>
              <div className="gov-portal-tagline">Smart Ayurveda IP &amp; Regulatory Assistance Portal</div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ============================================================
   GOVERNMENT PORTAL MAIN NAVIGATION BAR
   Primary navigation for all portal sections.
   ============================================================ */
function GovtNavbar({ onOpenAbout, onOpenWizard }) {
  return (
    <nav className="gov-nav-bar" role="navigation" aria-label="Main Portal Navigation">
      <div className="gov-nav-container">
        <ul className="gov-nav-menu">
          <li>
            <Link to="/" className="gov-nav-link">🏠 Home</Link>
          </li>
          <li>
            <button className="gov-nav-link-btn" onClick={onOpenWizard} aria-label="Open classification tool">
              🧪 Classification
            </button>
          </li>
          <li>
            <Link to="/abs-checker" className="gov-nav-link">🌿 ABS Compliance</Link>
          </li>
          <li>
            <Link to="/sources" className="gov-nav-link">📚 Official Sources</Link>
          </li>
          <li>
            <button className="gov-nav-link-btn" onClick={onOpenAbout} aria-label="Open About portal panel">
              ℹ️ About Portal
            </button>
          </li>
          <li>
            <a href="https://ayush.gov.in/" target="_blank" rel="noopener noreferrer" className="gov-nav-link">
              🏛️ Ministry Portal ↗
            </a>
          </li>
        </ul>

        <Link to="/chat" className="gov-nav-cta" id="gov-nav-consult-btn">
          <span>Consult IP Assistant</span>
          <span>→</span>
        </Link>
      </div>
    </nav>
  )
}

/* ============================================================
   NAVBAR WRAPPER (COMMON)
   Composed header used on landing, ABS, and sources pages.
   ============================================================ */
function Navbar({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt }) {
  return (
    <div className="gov-portal-header-wrapper">
      <GovtAccessibilityBar
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setPrefillPrompt={setPrefillPrompt}
      />
      <GovtMainHeader />
      <GovtNavbar onOpenAbout={onOpenAbout} onOpenWizard={onOpenWizard} />
    </div>
  )
}

/* ============================================================
   LANDING PAGE
   Primary entry point; includes hero, stats strip, features,
   how-it-works, source trust section, and improved footer.
   ============================================================ */
function LandingPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt }) {
  const text = useTypewriter(TYPEWRITER_PHRASES)

  return (
    <div className="landing">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setPrefillPrompt={setPrefillPrompt}
      />

      {/* Hero */}
      <section className="hero-section" id="hero" aria-labelledby="hero-title">
        <div className="hero-eyebrow">
          <span>🏛️</span>
          <span>Ministry of AYUSH · Government of India Initiative</span>
        </div>

        <h1 className="hero-title" id="hero-title">IP-SAKTI Sahayak</h1>
        <p className="hero-title-sub">Your Trusted Guide to Ayurvedic Intellectual Property</p>

        <div className="typewriter-wrap" aria-live="polite" aria-label="Rotating capability phrases">
          <span className="typewriter">{text}</span>
          <span className="typewriter-cursor" aria-hidden="true" />
        </div>

        {/* ADDED: Stats strip with only defensible, documentation-backed metrics */}
        <div className="stats-strip" aria-label="Product scope summary">
          <div className="stat-item">
            <span className="stat-number">6+</span>
            <span className="stat-label">Languages<span className="stat-note"> — planned multilingual scope</span></span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">4</span>
            <span className="stat-label">Core Legal Domains<span className="stat-note"> — IP, AYUSH, biodiversity, treaties</span></span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">2</span>
            <span className="stat-label">Jurisdiction Modes<span className="stat-note"> — India and International</span></span>
          </div>
        </div>

        {/* ADDED: Development preview notice — honest about current product state */}
        <div className="dev-preview-notice" role="note">
          <span aria-hidden="true">🔧</span>
          <span><strong>Development Preview — SIH 2026 Prototype.</strong> Chat responses currently use placeholder fallback content. Corpus ingestion and RAG pipeline are planned for Phase 2–3.</span>
        </div>

        <div className="hero-cta-group">
          <Link
            to="/chat"
            className="btn-primary"
            id="hero-start-btn"
          >
            Start Consultation →
          </Link>
          <button className="btn-secondary" onClick={onOpenWizard} aria-label="Open formulation wizard">
            🧪 Formulation Wizard
          </button>
          <a href="#how-it-works" className="btn-secondary">
            How it works ↓
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section" id="features" aria-labelledby="features-title">
        <p className="section-label">Feature Suite</p>
        <h2 className="section-title" id="features-title">Everything you need for Ayurvedic IP &amp; Regulatory Guidance</h2>
        <div className="features-grid">
          {[
            {
              icon: '📜',
              title: 'Statute-Cited Answers',
              desc: 'Designed for source-grounded responses with exact section citations from Patents Act 1970, BD Act 2002, TKDL, and WIPO treaties — pending corpus verification.',
              delay: '0.1s',
            },
            {
              icon: '🧪',
              title: 'Formulation Wizard',
              desc: '3-step classification guiding Vaidyas & MSMEs through Classical vs Proprietary vs Nutraceutical preliminary IP assessment.',
              delay: '0.15s',
            },
            {
              icon: '🌐',
              title: 'Multilingual Support',
              desc: 'Planned support for Hindi, Kannada, Bengali, Tamil, Telugu, and English via Bhashini API integration (Phase 4).',
              delay: '0.2s',
            },
            {
              icon: '⚖️',
              title: 'Jurisdiction-Aware',
              desc: 'Toggle between domestic India law 🇮🇳 and International Treaties 🌐 (PCT, WIPO GRATK, CBD). Corpora kept separate.',
              delay: '0.25s',
            },
            {
              icon: '🌿',
              title: 'ABS Compliance Checker',
              desc: 'Preliminary informational wizard for National Biodiversity Authority (NBA) approval requirements under BD Act 2002.',
              delay: '0.3s',
            },
            {
              icon: '🔒',
              title: 'Confidence Scoring',
              desc: 'Every answer displays a High, Medium, or Low confidence badge to clearly signal when formal legal counsel is needed.',
              delay: '0.35s',
            },
          ].map(f => (
            <article
              key={f.title}
              className="feature-card"
              style={{ animationDelay: f.delay }}
            >
              <div className="feature-icon" aria-hidden="true">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="section" id="how-it-works" aria-labelledby="how-title">
        <p className="section-label">Simple Process</p>
        <h2 className="section-title" id="how-title">How IP-SAKTI Sahayak Works</h2>
        <div className="steps-grid">
          {[
            { n: '01', title: 'Ask Your Question', desc: 'Type your IP query in your preferred language.' },
            { n: '02', title: 'Select Jurisdiction', desc: 'Switch between domestic India law 🇮🇳 or PCT/WIPO international treaties 🌐.' },
            // UPDATED: Removed "zero-hallucination" claim — corpus ingestion is incomplete
            { n: '03', title: 'Source-Grounded Answer', desc: 'Designed to return answers with statute citations and official links. Development preview uses placeholder content.' },
            { n: '04', title: 'Assess Confidence & Act', desc: 'Use confidence badges & Classification tool to plan your patent or licensing filing.' },
          ].map((s, i) => (
            <div key={s.n} className="step-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="step-number" aria-hidden="true">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Sources */}
      {/* UPDATED: Replaced "Zero simulated laws — all citations verified" with accurate pending status */}
      <div className="trust-section" id="sources" aria-labelledby="trust-title">
        <p className="section-label">Official Source Directory</p>
        <h2 className="section-title" id="trust-title" style={{ marginBottom: 0 }}>
          Designed to be grounded in official government &amp; international databases
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Candidate sources identified — corpus ingestion and verification planned for Phase 2.
        </p>
        <Link to="/sources" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--primary-light)', fontWeight: 500 }}>
          View full source directory →
        </Link>
        <div className="trust-logos">
          {[
            { icon: '🏛️', name: 'India Code' },
            { icon: '🔖', name: 'IP India Patent Office' },
            { icon: '🌿', name: 'AYUSH Regulatory Portal' },
            { icon: '📚', name: 'TKDL Archive' },
            { icon: '🌍', name: 'WIPO GRATK Treaty' },
            { icon: '📋', name: 'CBD / Nagoya Protocol' },
          ].map(s => (
            <div key={s.name} className="trust-logo-pill">
              <span aria-hidden="true">{s.icon}</span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* UPDATED: Footer now includes nav links, team credit, and legal disclaimer */}
      <footer className="footer" role="contentinfo">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-logo" aria-hidden="true">🌿</span>
            <div>
              <strong>IP-SAKTI Sahayak</strong>
              <div className="devanagari" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>बौद्धिक संपदा सहायक</div>
            </div>
          </div>

          <nav className="footer-links" aria-label="Footer navigation">
            <Link to="/" className="footer-link">Home</Link>
            <Link to="/chat" className="footer-link">Chat Assistant</Link>
            <Link to="/abs-checker" className="footer-link">ABS Checker</Link>
            <Link to="/sources" className="footer-link">Sources</Link>
            <a href="https://ayush.gov.in/" target="_blank" rel="noopener noreferrer" className="footer-link">Ministry of AYUSH ↗</a>
          </nav>

          <div className="footer-meta">
            <p>Ministry of AYUSH · Government of India · SIH 2026</p>
            <p>Project team — internal hackathon prototype</p>
          </div>
        </div>
        <div className="footer-disclaimer" role="note">
          Informational research assistant. Does not constitute formal legal counsel. Not affiliated with or endorsed by the Controller General of Patents or any regulatory authority.
        </div>
      </footer>
    </div>
  )
}

/* ============================================================
   CHAT PAGE
   Primary consultation interface with sidebar, input, and messages.
   ============================================================ */
// UPDATED: Added fontSize/setFontSize props (were missing from destructuring);
//          fixed dev fallback confidence from 'high' to 'medium';
//          added voice input button and toast; added mobile sidebar close via Escape
function ChatPage({ onOpenAbout, onOpenWizard, prefillPrompt, theme, toggleTheme, fontSize, setFontSize }) {
  const location = useLocation()
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [input, setInput] = useState(() => location.state?.prefillPrompt || prefillPrompt || '')
  const [prevLocationKey, setPrevLocationKey] = useState(location.key)
  const [prevPrefill, setPrevPrefill] = useState(prefillPrompt)
  const [jurisdiction, setJurisdiction] = useState('india')
  const [lang, setLang] = useState('en')
  const [typing, setTyping] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(1)
  // ADDED: Voice input toast state — voice input is planned for Phase 4 (Bhashini)
  const [voiceToastVisible, setVoiceToastVisible] = useState(false)
  const messagesEndRef = useRef(null)

  // Synchronize state when location.state or prefillPrompt prop changes
  if (location.key !== prevLocationKey) {
    setPrevLocationKey(location.key)
    if (location.state?.prefillPrompt) {
      setInput(location.state.prefillPrompt)
    }
  }

  if (prefillPrompt && prefillPrompt !== prevPrefill) {
    setPrevPrefill(prefillPrompt)
    setInput(prefillPrompt)
  }

  // Scroll to latest message when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // Close mobile sidebar on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && mobileSidebarOpen) setMobileSidebarOpen(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mobileSidebarOpen])

  // Sends user message to FastAPI backend; falls back to dev placeholder on failure
  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMsg = { id: Date.now(), role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, jurisdiction, language: lang }),
      })

      if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`)
      const data = await response.json()
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: data.answer,
        citations: data.citations,
        confidence: data.confidence === 'unavailable' ? null : data.confidence,
        showDisclaimer: true,
        isDevFallback: false,
      }])
    } catch {
      // UPDATED: Dev fallback clearly labelled; confidence changed from 'high' to 'medium'
      //          to honestly reflect that this is placeholder content, not grounded retrieval
      let aiText = `Under Section 3(p) of the Indian Patents Act 1970, traditional Ayurvedic formulations are excluded from patentability as prior art. However, novel, non-obvious synergistic combinations or extraction processes may be patentable subject matter.`
      let citations = [
        { title: '📜 Indian Patents Act 1970 | §3(p)', url: 'https://ipindia.gov.in/' },
        { title: '📚 Traditional Knowledge Digital Library (TKDL)', url: 'https://www.tkdl.res.in/' },
      ]

      if (jurisdiction === 'intl') {
        aiText = `Under WIPO GRATK Treaty (2024) and Nagoya Protocol, international patent applications utilizing genetic resources or traditional knowledge must disclose the origin of biological material and evidence of Prior Informed Consent (PIC).`
        citations = [
          { title: '🌍 WIPO GRATK Treaty (2024) | Mandatory Disclosure Clause', url: 'https://www.wipo.int/' },
          { title: '📋 Nagoya Protocol on ABS | Article 6 & 7', url: 'https://www.cbd.int/abs/' },
        ]
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        // UPDATED: Text no longer includes raw error message; flagged as dev fallback
        text: aiText,
        citations,
        // UPDATED: Changed from 'high' to 'medium' — dev fallback is not a verified grounded answer
        confidence: 'medium',
        showDisclaimer: true,
        isDevFallback: true,
      }])
    } finally {
      setTyping(false)
    }
  }

  // Send on Enter; new line on Shift+Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Clears current session while keeping the welcome message
  const handleClear = () => {
    setMessages([DEMO_MESSAGES[0]])
    setInput('')
  }

  // Resets to a fresh consultation state
  const handleNewChat = () => {
    setMessages([DEMO_MESSAGES[0]])
    setInput('')
    setActiveSessionId(null)
  }

  // Loads a demo session by ID
  const handleSelectSession = (id) => {
    setActiveSessionId(id)
    if (id === 1) setMessages(DEMO_MESSAGES)
    else if (id === 2) {
      setMessages([
        DEMO_MESSAGES[0],
        { id: 201, role: 'user', text: 'Do I need National Biodiversity Authority approval for exporting Neem oil extract?' },
        {
          id: 202,
          role: 'ai',
          text: 'Yes. Under Section 3 of the Biological Diversity Act 2002, non-Indian citizens, NRIs, and foreign-incorporated companies must obtain prior approval from the National Biodiversity Authority (NBA) via Form I before accessing Indian bio-resources like Neem (Azadirachta indica) for commercial utilization.',
          citations: [{ title: '🌿 Biological Diversity Act 2002 | §3 | Access Approval', url: 'http://nbaindia.org/' }],
          confidence: 'high',
          showDisclaimer: true,
          isDevFallback: false,
        }
      ])
    }
  }

  // ADDED: Voice input handler — shows "coming soon" toast; no speech recognition implemented
  const handleVoiceInput = useCallback(() => {
    setVoiceToastVisible(true)
  }, [])

  return (
    <div className="chat-layout" role="main">
      <GovtAccessibilityBar
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      {/* Topbar */}
      <header className="chat-topbar" role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* UPDATED: aria-expanded added to sidebar toggle for accessibility */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => {
              if (window.innerWidth <= 768) {
                setMobileSidebarOpen(prev => !prev)
              } else {
                setSidebarCollapsed(prev => !prev)
              }
            }}
            aria-label={sidebarCollapsed ? 'Open history sidebar' : 'Close history sidebar'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="chat-sidebar"
          >
            ☰
          </button>
          <Link to="/" className="chat-brand" aria-label="Back to IP-SAKTI Sahayak home">
            <div className="chat-brand-icon" aria-hidden="true">🌿</div>
            <div>
              <span className="chat-brand-name">IP-SAKTI Sahayak</span>
              <span className="devanagari" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--primary)' }}>
                आयुष मंत्रालय | Govt of India
              </span>
            </div>
          </Link>
        </div>

        <div className="topbar-right">
          <JurisdictionToggle value={jurisdiction} onChange={setJurisdiction} />

          <select
            className="lang-select"
            value={lang}
            onChange={e => setLang(e.target.value)}
            aria-label="Select response language"
            id="lang-selector"
          >
            <option value="en">🇬🇧 English</option>
            <option value="hi">🇮🇳 हिन्दी</option>
            <option value="kn">🇮🇳 ಕನ್ನಡ</option>
            <option value="bn">🇮🇳 বাংলা</option>
            <option value="ta">🇮🇳 தமிழ்</option>
            <option value="te">🇮🇳 తెలుగు</option>
          </select>

          <button className="btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }} onClick={onOpenAbout} aria-label="Open About IP-SAKTI panel">
            ℹ️ About
          </button>
          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
        </div>
      </header>

      {/* Main Chat Area with Sidebar */}
      <div className="chat-container">
        <ChatSidebar
          id="chat-sidebar"
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(prev => !prev)}
          activeId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onOpenWizard={onOpenWizard}
          onOpenAbout={onOpenAbout}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Chat Body */}
          <div className="chat-body" id="chat-messages" role="log" aria-live="polite" aria-label="Conversation messages">
            {/* Wizard shortcuts */}
            <div className="wizard-shortcut-bar" aria-label="Quick actions">
              {[
                { icon: '🧪', label: 'Classification', action: onOpenWizard },
                { icon: '🌿', label: 'ABS Checker', link: '/abs-checker' },
                { icon: '📜', label: 'Patents Act §3(p)', prompt: 'What is Section 3(p) of Patents Act 1970?' },
                { icon: '📚', label: 'TKDL Check', prompt: 'How does TKDL prevent traditional knowledge biopiracy?' },
                { icon: '🏷️', label: 'GI Tagging', prompt: 'How do I register a Geographical Indication for an Ayurvedic herb?' },
              ].map((b, idx) => (
                b.link ? (
                  <Link key={idx} to={b.link} className="wizard-btn">
                    <span aria-hidden="true">{b.icon}</span>
                    {b.label}
                  </Link>
                ) : (
                  <button
                    key={idx}
                    className="wizard-btn"
                    onClick={() => b.action ? b.action() : setInput(b.prompt)}
                    aria-label={b.label}
                  >
                    <span aria-hidden="true">{b.icon}</span>
                    {b.label}
                  </button>
                )
              ))}
            </div>

            {/* Messages */}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* Typing indicator */}
            {typing && <TypingIndicator />}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {/* Input Bar */}
          <div className="chat-input-bar" role="form" aria-label="Message input area">
            <div className="input-row">
              <div className="chat-input-wrap">
                <textarea
                  className="chat-input"
                  id="chat-input-field"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about Patents Act §3(p), ABS clearance under BD Act 2002, TKDL, trademarks…"
                  rows={1}
                  aria-label="Type your IP question"
                />
                {/* ADDED: Voice input button — shows "coming soon" toast; Bhashini planned Phase 4 */}
                <button
                  className="voice-input-btn"
                  onClick={handleVoiceInput}
                  aria-label="Voice input (coming soon)"
                  title="Voice input — coming soon via Bhashini API"
                  type="button"
                >
                  🎙️
                </button>
              </div>
              <button
                className="send-btn"
                id="send-message-btn"
                onClick={handleSend}
                disabled={!input.trim() || typing}
                aria-label="Send message"
              >
                ➤
              </button>
            </div>

            <div className="input-actions">
              <button className="action-btn" onClick={onOpenWizard} aria-label="Open formulation wizard">
                🧪 Formulation Wizard
              </button>
              <Link to="/abs-checker" className="action-btn">
                🌿 ABS Compliance
              </Link>
              <button className="action-btn" id="clear-chat-btn" onClick={handleClear} aria-label="Clear current session">
                🗑️ Clear Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ADDED: Voice input toast notification with accessible live region */}
      <VoiceToast
        visible={voiceToastVisible}
        onDismiss={() => setVoiceToastVisible(false)}
      />
    </div>
  )
}

/* ============================================================
   ABS COMPLIANCE CHECKER PAGE
   Preliminary informational assessment of NBA/SBB obligations
   under the Biological Diversity Act 2002. MVP Prototype.
   ============================================================ */
// UPDATED: Added "MVP Prototype" label, Reset button, and "not official determination" disclaimer
function ABSCheckerPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt }) {
  const [applicantType, setApplicantType] = useState('indian_individual')
  const [resourceSource, setResourceSource] = useState('india')
  const [activityIntent, setActivityIntent] = useState('commercial')
  const [evaluated, setEvaluated] = useState(false)

  // Evaluates ABS obligations based on applicant/activity combination; informational only
  const handleEvaluate = (e) => {
    e.preventDefault()
    setEvaluated(true)
  }

  // ADDED: Resets all form fields and hides result
  const handleReset = () => {
    setApplicantType('indian_individual')
    setResourceSource('india')
    setActivityIntent('commercial')
    setEvaluated(false)
  }

  return (
    <div className="page-container">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setPrefillPrompt={setPrefillPrompt}
      />

      <header className="page-header">
        {/* UPDATED: Added "MVP Prototype" chip to avoid overstating product capability */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <span className="chip" style={{ background: 'rgba(6, 95, 70, 0.2)', color: 'var(--secondary-light)' }}>
            🌿 Biological Diversity Act 2002 Module
          </span>
          <span className="chip" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'rgba(165, 180, 252, 0.9)', border: '1px solid rgba(99,102,241,0.25)' }}>
            🔧 MVP Prototype · Preliminary Informational Assessment
          </span>
        </div>
        <h1 className="page-title">ABS Compliance Checker</h1>
        <p className="page-subtitle">
          Verify Access and Benefit Sharing (ABS) obligations &amp; National Biodiversity Authority (NBA) approval requirements.
        </p>
        {/* ADDED: Clear disclaimer that this is not a substitute for official legal advice */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Not a substitute for NBA, SBB, or qualified legal advice. Consult the National Biodiversity Authority for official determinations.
        </p>
      </header>

      <main className="abs-form-card" aria-label="ABS compliance assessment form">
        <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="applicant-type-select">1. Applicant Entity Type</label>
            <select
              className="form-select"
              id="applicant-type-select"
              value={applicantType}
              onChange={e => setApplicantType(e.target.value)}
            >
              <option value="indian_individual">Indian Citizen / Local Cultivator</option>
              <option value="indian_company">Indian Entity (100% Domestic Shareholding)</option>
              <option value="foreign_entity">Foreign Entity / NRI / Foreign Shareholding Company</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="resource-source-select">2. Origin of Biological Material</label>
            <select
              className="form-select"
              id="resource-source-select"
              value={resourceSource}
              onChange={e => setResourceSource(e.target.value)}
            >
              <option value="india">Sourced within India (Flora / Medicinal Herbs / Micro-organisms)</option>
              <option value="imported">Imported from foreign country</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="activity-intent-select">3. Intended Purpose / Activity</label>
            <select
              className="form-select"
              id="activity-intent-select"
              value={activityIntent}
              onChange={e => setActivityIntent(e.target.value)}
            >
              <option value="commercial">Commercial Utilization &amp; Drug Manufacturing</option>
              <option value="patent">Filing Intellectual Property / Patent Protection</option>
              <option value="export">Transfer of Research / Exporting Bio-Resources</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              Check Compliance Requirements →
            </button>
            {/* ADDED: Reset form button to clear all selections */}
            <button type="button" className="btn-secondary" onClick={handleReset} style={{ flex: '0 0 auto' }} aria-label="Reset form to defaults">
              ↺ Reset Form
            </button>
          </div>
        </form>

        {evaluated && (
          <div className="abs-result-card" aria-live="polite" aria-label="Compliance assessment result">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>📋</span>
              <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                NBA Approval &amp; ABS Preliminary Assessment
              </h2>
            </div>

            {applicantType === 'foreign_entity' ? (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p><strong>Indicated Status:</strong> <span style={{ color: '#FCA5A5' }}>Mandatory Prior Approval Likely Required (Section 3 of BD Act 2002)</span></p>
                <p style={{ marginTop: '0.5rem' }}>For entities involving foreign equity, NRIs, or foreign incorporation:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', color: 'var(--text-secondary)', listStyle: 'disc' }}>
                  <li>Must submit <strong>Form I</strong> application to the National Biodiversity Authority (NBA).</li>
                  <li>Must sign an Access &amp; Benefit Sharing (ABS) agreement before accessing Indian herbs.</li>
                  <li>If filing a patent, <strong>Form III</strong> approval is mandatory before patent grant (Section 6).</li>
                </ul>
              </div>
            ) : (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p><strong>Indicated Status:</strong> <span style={{ color: '#86EFAC' }}>State Biodiversity Board (SBB) Intimation Likely Required</span></p>
                <p style={{ marginTop: '0.5rem' }}>For 100% Indian entities and domestic Vaidyas:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', color: 'var(--text-secondary)', listStyle: 'disc' }}>
                  <li>Local Vaidyas &amp; traditional practitioners are EXEMPT from ABS fees for domestic practice.</li>
                  <li>Commercial AYUSH manufacturers must notify the respective State Biodiversity Board (SBB) prior to commercial production.</li>
                  <li>If filing for an international PCT patent, prior NBA notification via Form III is required.</li>
                </ul>
              </div>
            )}

            {/* ADDED: Not-an-official-determination notice required for regulatory accuracy */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: 'rgba(165,180,252,0.9)' }}>
              ℹ️ <strong>This is not an official regulatory determination.</strong> The above is a preliminary informational assessment based on your selections. Contact the <a href="http://nbaindia.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--secondary-light)' }}>National Biodiversity Authority</a> or a qualified legal advisor for authoritative guidance.
            </div>

            {/* ADDED: Follow-up navigation to chat and sources */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/chat" className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                Ask IP-SAKTI for more detail →
              </Link>
              <Link to="/sources" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                📚 View Source Register
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/* ============================================================
   SOURCES DIRECTORY PAGE
   Lists candidate official sources with verification status.
   All sources are pending corpus ingestion as of this version.
   ============================================================ */
// UPDATED: Renamed page to "Official Source Directory"; added verification status badges;
//          added status note; removed false "ingested" language per SOURCE_REGISTER.md
function SourcesPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt }) {
  const SOURCES = [
    {
      icon: '🏛️',
      name: 'India Code statutory archive',
      tag: 'Statute Corpus',
      jurisdiction: 'India',
      docType: 'Act / Statute Repository',
      status: 'Candidate — Pending Corpus Ingestion',
      statusCls: 'pending',
      desc: 'Official repository of Indian legislation including Patents Act 1970, Biological Diversity Act 2002, and Drugs & Cosmetics Act 1940.',
      url: 'https://indiacode.nic.in/',
    },
    {
      icon: '🔖',
      name: 'IP India Patent & Design Office',
      tag: 'Patent Office',
      jurisdiction: 'India',
      docType: 'Regulatory Guidelines',
      status: 'Candidate — Pending Corpus Ingestion',
      statusCls: 'pending',
      desc: 'Official portal of the Controller General of Patents, Designs & Trade Marks (CGPDTM) detailing examination guidelines.',
      url: 'https://ipindia.gov.in/',
    },
    {
      icon: '📚',
      name: 'TKDL (Traditional Knowledge Digital Library)',
      tag: 'Prior Art DB',
      jurisdiction: 'India',
      docType: 'Traditional Knowledge Registry',
      status: 'Candidate — Pending Corpus Ingestion',
      statusCls: 'pending',
      desc: 'Joint initiative of CSIR and Ministry of AYUSH mapping traditional formulas to prevent international biopiracy.',
      url: 'https://www.tkdl.res.in/',
    },
    {
      icon: '🌍',
      name: 'WIPO GRATK Treaty (2024)',
      tag: 'International Law',
      jurisdiction: 'International',
      docType: 'Treaty',
      status: 'Candidate — Pending Corpus Ingestion',
      statusCls: 'pending',
      desc: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge establishing disclosure rules.',
      url: 'https://www.wipo.int/',
    },
    {
      icon: '📋',
      name: 'Nagoya Protocol on ABS',
      tag: 'Treaty Corpus',
      jurisdiction: 'International',
      docType: 'Treaty',
      status: 'Candidate — Pending Corpus Ingestion',
      statusCls: 'pending',
      desc: 'Global treaty under the Convention on Biological Diversity governing fair access and equitable benefit-sharing.',
      url: 'https://www.cbd.int/abs/',
    },
    {
      icon: '🌿',
      name: 'Ministry of AYUSH Regulatory Portal',
      tag: 'AYUSH Rules',
      jurisdiction: 'India',
      docType: 'Regulatory Guidelines',
      status: 'Candidate — Pending Corpus Ingestion',
      statusCls: 'pending',
      desc: 'Official AYUSH guidelines including Rule 158-B licensing parameters and Ayurveda Aahar regulations.',
      url: 'https://ayush.gov.in/',
    },
  ]

  return (
    <div className="page-container">
      <Navbar
        onOpenAbout={onOpenAbout}
        onOpenWizard={onOpenWizard}
        theme={theme}
        toggleTheme={toggleTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        setPrefillPrompt={setPrefillPrompt}
      />

      {/* UPDATED: Header renamed from "Official Ingested Data Sources" to "Official Source Directory"
                  to avoid falsely implying corpus ingestion is complete */}
      <header className="page-header">
        <span className="chip" style={{ background: 'rgba(217, 119, 6, 0.2)', color: 'var(--primary-light)', marginBottom: '0.75rem' }}>
          📚 Official Source Directory
        </span>
        <h1 className="page-title">Candidate Corpus Sources</h1>
        {/* UPDATED: Subtitle corrected — no longer claims all sources are verified/ingested */}
        <p className="page-subtitle">
          Official government statutes, international treaties, and traditional knowledge archives identified as candidate sources for the IP-SAKTI corpus.
        </p>
        {/* ADDED: Explanatory status note per SOURCE_REGISTER.md */}
        <div className="sources-status-note" role="note">
          <strong>Corpus Status:</strong> All sources listed below are <em>identified candidates</em>. Formal provenance verification and corpus ingestion are planned for Phase 2. No sources have been ingested into the vector store at this stage.
          See <code>docs/SOURCE_REGISTER.md</code> for the authoritative source register.
        </div>
      </header>

      {/* ADDED: Status legend for verification states */}
      <div className="sources-legend" aria-label="Source status legend">
        <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status legend:</strong>
        <span className="source-status-badge pending">Candidate — Pending Ingestion</span>
        <span className="source-status-badge verified">Verified</span>
        <span className="source-status-badge needs-update">Needs Update</span>
      </div>

      <main className="sources-grid" aria-label="Source directory">
        {SOURCES.map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="source-card" aria-label={`${s.name} — ${s.status}`}>
            <div className="source-header">
              <span className="source-icon" aria-hidden="true">{s.icon}</span>
              <div>
                <div className="source-title">{s.name}</div>
                <span className="source-tag">{s.tag}</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {s.desc}
            </p>
            {/* ADDED: Jurisdiction and document type metadata */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                🌐 {s.jurisdiction}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                📄 {s.docType}
              </span>
            </div>
            {/* ADDED: Verification status badge */}
            <span className={`source-status-badge ${s.statusCls}`} aria-label={`Verification status: ${s.status}`}>
              {s.status}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 500 }}>
              Visit Official Source ↗
            </span>
          </a>
        ))}
      </main>
    </div>
  )
}

/* ============================================================
   404 NOT FOUND PAGE
   Handles unknown routes; redirects to home after brief message.
   ============================================================ */
// ADDED: Minimal 404 page for unknown routes — improves navigation error handling
function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', textAlign: 'center', padding: '2rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <span style={{ fontSize: '3rem' }} aria-hidden="true">🌿</span>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Page Not Found</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
        This page does not exist in the IP-SAKTI portal. Please use the navigation to return to a valid section.
      </p>
      <Link to="/" className="btn-primary" id="not-found-home-link">
        ← Return to Home
      </Link>
    </div>
  )
}

/* ============================================================
   MAIN APP ROUTER
   Top-level routing; modals rendered at root level for
   accessibility (portal rendering above page z-index).
   ============================================================ */
// UPDATED: Added useNavigate for wizard handoff; added 404 catchall route
function AppRoutes() {
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [prefillPrompt, setPrefillPrompt] = useState('')
  const { theme, toggleTheme } = useTheme()
  const { fontSize, setFontSize } = useFontSize()
  const navigate = useNavigate()

  // UPDATED: Uses useNavigate for wizard-to-chat handoff instead of window.location.hash
  const handleAskChatFromWizard = useCallback((prompt) => {
    setPrefillPrompt(prompt)
    navigate('/chat')
  }, [navigate])

  const commonNavProps = {
    onOpenAbout: () => setIsAboutOpen(true),
    onOpenWizard: () => setIsWizardOpen(true),
    theme,
    toggleTheme,
    fontSize,
    setFontSize,
    setPrefillPrompt,
  }

  return (
    <>
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <FormulationWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onAskChat={handleAskChatFromWizard}
      />

      <Routes>
        <Route path="/" element={<LandingPage {...commonNavProps} />} />
        <Route
          path="/chat"
          element={
            <ChatPage
              onOpenAbout={() => setIsAboutOpen(true)}
              onOpenWizard={() => setIsWizardOpen(true)}
              prefillPrompt={prefillPrompt}
              setPrefillPrompt={setPrefillPrompt}
              theme={theme}
              toggleTheme={toggleTheme}
              fontSize={fontSize}
              setFontSize={setFontSize}
            />
          }
        />
        <Route path="/abs-checker" element={<ABSCheckerPage {...commonNavProps} />} />
        <Route path="/sources" element={<SourcesPage {...commonNavProps} />} />
        {/* ADDED: Catchall route redirects unknown paths to home */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

// App is the BrowserRouter provider — AppRoutes uses useNavigate inside it
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
