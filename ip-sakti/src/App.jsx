import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom'
import './index.css'

/* ============================================================
   THEME HOOK & TOGGLE
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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}

/* ============================================================
   FONT SIZE HOOK
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
   ============================================================ */
const TYPEWRITER_PHRASES = [
  'Ayurvedic IP Guidance',
  'पेटेंट सलाह',               // Hindi
  'ಬೌದ್ಧಿಕ ಆಸ್ತಿ',           // Kannada
  'पारंपरिक ज्ञान संरक्षण',    // Hindi
  'Trademark Assistance',
  'বুদ্ধিবৃত্তিক সম্পদ',      // Bengali
]

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
   ABOUT IP-SAKTI MODAL / DRAWER
   ============================================================ */
function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span style={{ fontSize: '1.5rem' }}>🌿</span>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>About IP-SAKTI Sahayak</h2>
              <span className="devanagari" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                बौद्धिक संपदा सहायक · SIH 2026
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-body">
          <section>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🎯 Purpose & Vision
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              IP-SAKTI Sahayak (Smart Ayurveda Knowledge & Technology Initiative) is an AI-powered legal and regulatory assistant created for the <strong>Ministry of AYUSH</strong>. It bridges the gap between complex Indian Intellectual Property laws, Traditional Knowledge preservation, and biological diversity compliance.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--secondary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              🛡️ Grounding Policy & Zero Hallucination
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              Every response is strictly grounded in official statutory corpora. If relevant legal context is missing, the assistant abstains rather than inventing legal advice. All answers include section citations, database links, and confidence ratings.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--primary-light)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              📚 Core Ingested Corpora
            </h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <li>📜 Patents Act 1970 (Sec 3p)</li>
              <li>🌿 Biological Diversity Act 2002</li>
              <li>💊 Drugs & Cosmetics Act 1940</li>
              <li>📚 TKDL (Traditional Knowledge)</li>
              <li>🌍 WIPO GRATK Treaty 2024</li>
              <li>🏷️ GI of Goods Act 1999</li>
            </ul>
          </section>

          <div style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--primary-light)' }}>
            ⚠️ <strong>Disclaimer:</strong> IP-SAKTI Sahayak is an informational research tool for AYUSH innovators and Vaidyas. It does not replace professional legal representation before the Controller General of Patents or High Courts.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   FORMULATION WIZARD MODAL
   ============================================================ */
function FormulationWizardModal({ isOpen, onClose, onAskChat }) {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: null })

  if (!isOpen) return null

  const resetWizard = () => {
    setStep(1)
    setAnswers({ q1: null, q2: null, q3: null })
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const handleSelectOption = (questionKey, optionValue) => {
    setAnswers(prev => ({ ...prev, [questionKey]: optionValue }))
  }

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

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span style={{ fontSize: '1.5rem' }}>🧪</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Ayurvedic Formulation Classifier</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Guided 3-Step IP & Regulatory Assessment
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={handleClose} aria-label="Close wizard">✕</button>
        </div>

        <div className="modal-body">
          {/* Progress Bar */}
          <div className="wizard-progress">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`wizard-progress-step ${step === s ? 'active' : step > s ? 'completed' : ''}`}
              >
                {step > s ? '✓' : s}
              </div>
            ))}
          </div>

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
                >
                  Next Step →
                </button>
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
                  Recommended IP & Licensing Actions:
                </h4>
                <ul style={{ paddingLeft: '1.2rem', fontSize: '0.83rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {outcome.legalAction.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
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
   ============================================================ */
function ChatSidebar({ collapsed, onToggle, activeId, onSelectSession, onNewChat, onOpenWizard, onOpenAbout }) {
  const SESSIONS = [
    { id: 1, title: 'Arthritis Formulation Patentability', tag: 'Patents', date: 'Today' },
    { id: 2, title: 'ABS Compliance for Neem Extract', tag: 'BD Act', date: 'Yesterday' },
    { id: 3, title: 'TKDL Prior Art Section 3(p)', tag: 'TKDL', date: 'Aug 29' },
    { id: 4, title: 'Ayurvedic Herbal Cosmetic Trademark', tag: 'Trademark', date: 'Aug 26' },
  ]

  return (
    <aside className={`chat-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Conversation History">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNewChat} id="new-chat-btn">
          <span>➕</span>
          <span>New Consultation</span>
        </button>
      </div>

      <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        Past Conversations
      </div>

      <div className="sidebar-history-list">
        {SESSIONS.map(s => (
          <div
            key={s.id}
            className={`history-item ${activeId === s.id ? 'active' : ''}`}
            onClick={() => onSelectSession(s.id)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="history-item-title">{s.title}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.date}</span>
            </div>
            <span className="history-item-tag">{s.tag}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-link-btn" onClick={onOpenWizard}>
          <span>🧪</span>
          <span>Formulation Wizard</span>
        </button>
        <Link to="/abs-checker" className="sidebar-link-btn">
          <span>🌿</span>
          <span>ABS Compliance Checker</span>
        </Link>
        <Link to="/sources" className="sidebar-link-btn">
          <span>📚</span>
          <span>Official Data Corpora</span>
        </Link>
        <button className="sidebar-link-btn" onClick={onOpenAbout}>
          <span>ℹ️</span>
          <span>About IP-SAKTI</span>
        </button>
      </div>
    </aside>
  )
}

/* ============================================================
   DEMO DATA FOR CHAT PAGE
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
    text: 'Yes! International export triggers obligations under the Nagoya Protocol and WIPO GRATK Treaty (2024).\n\nYou must ensure fair Access and Benefit Sharing (ABS) compliance with India’s National Biodiversity Authority before exporting raw bio-resources or filing foreign patent applications (PCT route). We recommend consulting an IP attorney for international patenting.',
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
function CitationCard({ citation }) {
  return (
    <a href={citation.url} target="_blank" rel="noopener noreferrer" className="citation-card">
      <span className="citation-title">{citation.title}</span>
      <span className="citation-url">{citation.url}</span>
    </a>
  )
}

function ConfidenceBadge({ level }) {
  const map = {
    high:   { label: '● High Confidence (Direct Statute Match)', cls: 'high' },
    medium: { label: '● Moderate Confidence — Verify details with expert', cls: 'medium' },
    low:    { label: '● Low Confidence — Consult a registered IP attorney', cls: 'low' },
  }
  const m = map[level]
  if (!m) return null
  return (
    <span className={`confidence-badge ${m.cls}`} role="status" aria-label={m.label}>
      {m.label}
    </span>
  )
}

function DisclaimerBanner() {
  return (
    <div className="disclaimer" role="note">
      <span aria-hidden="true">ℹ️</span>
      <span>This is information only, grounded in retrieved statutes. Consult a qualified IP attorney for formal legal proceedings.</span>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="message-row ai-row" aria-label="IP-SAKTI is thinking">
      <div className="avatar ai-avatar" aria-hidden="true">🌿</div>
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}

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
        <div className="bubble ai-bubble" style={{ whiteSpace: 'pre-line' }}>
          {msg.text}
        </div>
        {msg.citations?.length > 0 && (
          <div className="citation-list">
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

function JurisdictionToggle({ value, onChange }) {
  const isIndia = value === 'india'
  return (
    <div
      className="jurisdiction-toggle"
      role="switch"
      aria-checked={!isIndia}
      aria-label="Toggle between India and International jurisdiction"
    >
      <span className={`jurisdiction-label ${isIndia ? 'active' : ''}`}>
        India 🇮🇳
      </span>
      <div
        className={`toggle-track ${isIndia ? 'india' : 'intl'}`}
        onClick={() => onChange(isIndia ? 'intl' : 'india')}
        id="jurisdiction-toggle-track"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onChange(isIndia ? 'intl' : 'india')}
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
   ============================================================ */
function GovtAccessibilityBar({ theme, toggleTheme, fontSize, setFontSize, setPrefillPrompt }) {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

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
    <div className="top-access-bar" role="region" aria-label="Accessibility & Quick Tools Header">
      <div className="top-access-container">
        <div className="top-access-left">
          <span>भारत सरकार | Government of India</span>
          <span className="divider">•</span>
          <span>आयुष मंत्रालय | Ministry of AYUSH</span>
        </div>

        <div className="top-access-right">
          <form className="top-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search portal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="top-search-input"
              aria-label="Search IP Statutes and Guidelines"
            />
            <button type="submit" className="top-search-btn" title="Search Portal">🔍</button>
          </form>

          <div className="font-size-controls" aria-label="Font Size Accessibility Controls">
            <button
              className={`font-size-btn ${fontSize === 'sm' ? 'active' : ''}`}
              onClick={() => setFontSize('sm')}
              title="Decrease Font Size (A-)"
            >
              A-
            </button>
            <button
              className={`font-size-btn ${fontSize === 'md' ? 'active' : ''}`}
              onClick={() => setFontSize('md')}
              title="Normal Font Size (A)"
            >
              A
            </button>
            <button
              className={`font-size-btn ${fontSize === 'lg' ? 'active' : ''}`}
              onClick={() => setFontSize('lg')}
              title="Increase Font Size (A+)"
            >
              A+
            </button>
          </div>

          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />

          <a href="#chat-messages" className="top-access-icon-link" title="Screen Reader Accessibility Access" aria-label="Screen Reader Access">
            ♿
          </a>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   GOVERNMENT PORTAL MAIN HEADER
   ============================================================ */
function GovtMainHeader() {
  return (
    <header className="gov-header" role="banner">
      <div className="gov-header-container">
        <div className="gov-emblem-wrap">
          {/* Note for User: Replace SVG below with <img src="/emblem.png" alt="Emblem of India" /> if emblem image is added to public/ */}
          <svg className="gov-emblem-svg" viewBox="0 0 100 100" width="56" height="56" aria-label="State Emblem of India Placeholder">
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
          <Link to="/" className="gov-portal-badge">
            <span className="gov-portal-icon">🌿</span>
            <div>
              <h1 className="gov-portal-name">IP-SAKTI Sahayak</h1>
              <div className="gov-portal-sub">राष्ट्रीय आयुर्वेद बौद्धिक संपदा सहायता पोर्टल</div>
              <div className="gov-portal-tagline">Smart Ayurveda IP & Regulatory Assistance Portal</div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ============================================================
   GOVERNMENT PORTAL MAIN NAVIGATION BAR
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
            <button className="gov-nav-link-btn" onClick={onOpenWizard}>
              🧪 Formulation Wizard
            </button>
          </li>
          <li>
            <Link to="/abs-checker" className="gov-nav-link">🌿 ABS Compliance</Link>
          </li>
          <li>
            <Link to="/sources" className="gov-nav-link">📚 Official Sources</Link>
          </li>
          <li>
            <button className="gov-nav-link-btn" onClick={onOpenAbout}>
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

        <div className="typewriter-wrap" aria-live="polite" aria-label="Rotating phrases">
          <span className="typewriter">{text}</span>
          <span className="typewriter-cursor" aria-hidden="true" />
        </div>

        <div className="hero-cta-group">
          <Link
            to="/chat"
            className="btn-primary"
            id="hero-start-btn"
          >
            Start Consultation →
          </Link>
          <button className="btn-secondary" onClick={onOpenWizard}>
            🧪 Formulation Wizard
          </button>
          <a href="#how-it-works" className="btn-secondary">
            How it works ↓
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section" id="features" aria-labelledby="features-title">
        <p className="section-label">Complete Feature Suite</p>
        <h2 className="section-title" id="features-title">Everything you need for Ayurvedic IP & Regulatory Protection</h2>
        <div className="features-grid">
          {[
            {
              icon: '📜',
              title: 'Statute-Cited Answers',
              desc: 'Every response backed by exact section citations from Patents Act 1970, BD Act 2002, TKDL, and WIPO treaties.',
              delay: '0.1s',
            },
            {
              icon: '🧪',
              title: 'Formulation Wizard',
              desc: '3-step classification flow guiding Vaidyas & MSMEs through Classical vs Proprietary vs Nutraceutical patentability.',
              delay: '0.15s',
            },
            {
              icon: '🌐',
              title: 'Multilingual Support',
              desc: 'Ask in Hindi, Kannada, Bengali, Tamil, Telugu, or English with accurate legal terminology mapping.',
              delay: '0.2s',
            },
            {
              icon: '⚖️',
              title: 'Jurisdiction-Aware',
              desc: 'Toggle seamlessly between domestic Indian Law 🇮🇳 and International Treaties 🌐 (PCT, WIPO GRATK, CBD).',
              delay: '0.25s',
            },
            {
              icon: '🌿',
              title: 'ABS Compliance Checker',
              desc: 'Interactive compliance wizard calculating National Biodiversity Authority (NBA) approval requirements under BD Act 2002.',
              delay: '0.3s',
            },
            {
              icon: '🔒',
              title: 'Confidence Scoring',
              desc: 'Every answer displays a High, Moderate, or Low confidence badge to clearly signal when formal legal counsel is needed.',
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
            { n: '01', title: 'Ask Your Question', desc: 'Type or speak your IP query in your preferred language.' },
            { n: '02', title: 'Select Jurisdiction', desc: 'Switch between domestic India law 🇮🇳 or PCT/WIPO international treaties 🌐.' },
            { n: '03', title: 'Statute-Grounded Answer', desc: 'Receive zero-hallucination answers with section citations and official links.' },
            { n: '04', title: 'Assess Confidence & Act', desc: 'Use confidence badges & Formulation Wizard to plan your patent or licensing filing.' },
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
      <div className="trust-section" id="sources" aria-labelledby="trust-title">
        <p className="section-label">Authoritative Ingestion Corpus</p>
        <h2 className="section-title" id="trust-title" style={{ marginBottom: 0 }}>
          Grounded in official government & international databases
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Zero simulated laws — all citations verified against statutory archives
        </p>
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

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        <p>
          🌿 IP-SAKTI Sahayak · SIH 2026 · Ministry of AYUSH ·{' '}
          <span className="devanagari">बौद्धिक संपदा सहायक</span>
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          Informational research assistant. Does not constitute formal legal counsel.
        </p>
      </footer>
    </div>
  )
}

/* ============================================================
   CHAT PAGE
   ============================================================ */
function ChatPage({ onOpenAbout, onOpenWizard, prefillPrompt, setPrefillPrompt, theme, toggleTheme }) {
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [input, setInput] = useState('')
  const [jurisdiction, setJurisdiction] = useState('india')
  const [lang, setLang] = useState('en')
  const [typing, setTyping] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(1)

  useEffect(() => {
    if (prefillPrompt) {
      setInput(prefillPrompt)
      setPrefillPrompt('')
    }
  }, [prefillPrompt, setPrefillPrompt])

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
      }])
    } catch (error) {
      let aiText = `Under Section 3(p) of the Indian Patents Act 1970, traditional Ayurvedic formulations are excluded from patentability as prior art. However, novel, non-obvious synergistic combinations or extraction processes may be patentable subject matter.`
      let citations = [
        { title: '📜 Indian Patents Act 1970 | §3(p)', url: 'https://ipindia.gov.in/' },
        { title: '📚 Traditional Knowledge Digital Library (TKDL)', url: 'https://www.tkdl.res.in/' },
      ]

      if (jurisdiction === 'international') {
        aiText = `Under WIPO GRATK Treaty (2024) and Nagoya Protocol, international patent applications utilizing genetic resources or traditional knowledge must disclose the origin of biological material and evidence of Prior Informed Consent (PIC).`
        citations = [
          { title: '🌍 WIPO GRATK Treaty (2024) | Mandatory Disclosure Clause', url: 'https://www.wipo.int/' },
          { title: '📋 Nagoya Protocol on ABS | Article 6 & 7', url: 'https://www.cbd.int/abs/' },
        ]
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: `Development Mode Fallback:\n\nBackend connection note: ${error.message}\n\n${aiText}`,
        citations,
        confidence: 'high',
        showDisclaimer: true,
      }])
    } finally {
      setTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([DEMO_MESSAGES[0]])
    setInput('')
  }

  const handleNewChat = () => {
    setMessages([DEMO_MESSAGES[0]])
    setInput('')
    setActiveSessionId(null)
  }

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
          showDisclaimer: true
        }
      ])
    }
  }

  return (
    <div className="chat-layout" role="main">
      <GovtAccessibilityBar theme={theme} toggleTheme={toggleTheme} fontSize={fontSize} setFontSize={setFontSize} />

      {/* Topbar */}
      <header className="chat-topbar" role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle history sidebar"
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

          <button className="btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }} onClick={onOpenAbout}>
            ℹ️ About
          </button>
          <ThemeToggleBtn theme={theme} toggleTheme={toggleTheme} />
        </div>
      </header>

      {/* Main Chat Area with Sidebar */}
      <div className="chat-container">
        <ChatSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onOpenWizard={onOpenWizard}
          onOpenAbout={onOpenAbout}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Chat Body */}
          <div className="chat-body" id="chat-messages" role="log" aria-live="polite">
            {/* Wizard shortcuts */}
            <div className="wizard-shortcut-bar" aria-label="Quick actions">
              {[
                { icon: '🧪', label: 'Formulation Wizard', action: onOpenWizard },
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
          </div>

          {/* Input Bar */}
          <div className="chat-input-bar" role="form" aria-label="Message input">
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
              <button className="action-btn" onClick={onOpenWizard}>
                🧪 Formulation Wizard
              </button>
              <Link to="/abs-checker" className="action-btn">
                🌿 ABS Compliance
              </Link>
              <button className="action-btn" id="clear-chat-btn" onClick={handleClear}>
                🗑️ Clear Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   ABS COMPLIANCE CHECKER PAGE
   ============================================================ */
function ABSCheckerPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  const [applicantType, setApplicantType] = useState('indian_individual')
  const [resourceSource, setResourceSource] = useState('india')
  const [activityIntent, setActivityIntent] = useState('commercial')
  const [evaluated, setEvaluated] = useState(false)

  const handleEvaluate = (e) => {
    e.preventDefault()
    setEvaluated(true)
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
      />

      <header className="page-header">
        <span className="chip" style={{ background: 'rgba(6, 95, 70, 0.2)', color: 'var(--secondary-light)', marginBottom: '0.75rem' }}>
          🌿 Biological Diversity Act 2002 Module
        </span>
        <h1 className="page-title">ABS Compliance Checker</h1>
        <p className="page-subtitle">
          Verify Access and Benefit Sharing (ABS) obligations & National Biodiversity Authority (NBA) approval requirements.
        </p>
      </header>

      <main className="abs-form-card">
        <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">1. Applicant Entity Type</label>
            <select
              className="form-select"
              value={applicantType}
              onChange={e => setApplicantType(e.target.value)}
            >
              <option value="indian_individual">Indian Citizen / Local Cultivator</option>
              <option value="indian_company">Indian Entity (100% Domestic Shareholding)</option>
              <option value="foreign_entity">Foreign Entity / NRI / Foreign Shareholding Company</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">2. Origin of Biological Material</label>
            <select
              className="form-select"
              value={resourceSource}
              onChange={e => setResourceSource(e.target.value)}
            >
              <option value="india">Sourced within India (Flora / Medicinal Herbs / Micro-organisms)</option>
              <option value="imported">Imported from foreign country</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">3. Intended Purpose / Activity</label>
            <select
              className="form-select"
              value={activityIntent}
              onChange={e => setActivityIntent(e.target.value)}
            >
              <option value="commercial">Commercial Utilization & Drug Manufacturing</option>
              <option value="patent">Filing Intellectual Property / Patent Protection</option>
              <option value="export">Transfer of Research / Exporting Bio-Resources</option>
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
            Check Compliance Requirements →
          </button>
        </form>

        {evaluated && (
          <div className="abs-result-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>📋</span>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                NBA Approval & ABS Regulatory Assessment
              </h3>
            </div>

            {applicantType === 'foreign_entity' ? (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p><strong>Status:</strong> <span style={{ color: '#FCA5A5' }}>Mandatory Prior Approval Required (Section 3 of BD Act 2002)</span></p>
                <p style={{ marginTop: '0.5rem' }}>Because the applicant involves foreign equity, NRIs, or foreign incorporation:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                  <li>Must submit <strong>Form I</strong> application to the National Biodiversity Authority (NBA).</li>
                  <li>Must sign an Access & Benefit Sharing (ABS) agreement before accessing Indian herbs.</li>
                  <li>If filing a patent, <strong>Form III</strong> approval is mandatory before patent grant (Section 6).</li>
                </ul>
              </div>
            ) : (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p><strong>Status:</strong> <span style={{ color: '#86EFAC' }}>State Biodiversity Board (SBB) Intimation Required</span></p>
                <p style={{ marginTop: '0.5rem' }}>For 100% Indian entities and domestic Vaidyas:</p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                  <li>Local Vaidyas & traditional practitioners are EXEMPT from ABS fees for domestic practice.</li>
                  <li>Commercial AYUSH manufacturers must notify the respective State Biodiversity Board (SBB) prior to commercial production.</li>
                  <li>If filing for an international PCT patent, prior NBA notification via Form III is required.</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

/* ============================================================
   SOURCES DIRECTORY PAGE
   ============================================================ */
function SourcesPage({ onOpenAbout, onOpenWizard, theme, toggleTheme, fontSize, setFontSize }) {
  const SOURCES = [
    {
      icon: '🏛️',
      name: 'India Code statutory archive',
      tag: 'Statute Corpus',
      desc: 'Official repository of Indian legislation including Patents Act 1970, Biological Diversity Act 2002, and Drugs & Cosmetics Act 1940.',
      url: 'https://indiacode.nic.in/',
    },
    {
      icon: '🔖',
      name: 'IP India Patent & Design Office',
      tag: 'Patent Office',
      desc: 'Official portal of the Controller General of Patents, Designs & Trade Marks (CGPDTM) detailing examination guidelines.',
      url: 'https://ipindia.gov.in/',
    },
    {
      icon: '📚',
      name: 'TKDL (Traditional Knowledge Digital Library)',
      tag: 'Prior Art DB',
      desc: 'Joint initiative of CSIR and Ministry of AYUSH mapping traditional formulas to prevent international biopiracy.',
      url: 'https://www.tkdl.res.in/',
    },
    {
      icon: '🌍',
      name: 'WIPO GRATK Treaty (2024)',
      tag: 'International Law',
      desc: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge establishing disclosure rules.',
      url: 'https://www.wipo.int/',
    },
    {
      icon: '📋',
      name: 'Nagoya Protocol on ABS',
      tag: 'Treaty Corpus',
      desc: 'Global treaty under the Convention on Biological Diversity governing fair access and equitable benefit-sharing.',
      url: 'https://www.cbd.int/abs/',
    },
    {
      icon: '🌿',
      name: 'Ministry of AYUSH Regulatory Portal',
      tag: 'AYUSH Rules',
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
      />

      <header className="page-header">
        <span className="chip" style={{ background: 'rgba(217, 119, 6, 0.2)', color: 'var(--primary-light)', marginBottom: '0.75rem' }}>
          📚 Grounding Corpus
        </span>
        <h1 className="page-title">Official Ingested Data Sources</h1>
        <p className="page-subtitle">
          IP-SAKTI Sahayak strictly cites verified government statutes, international treaties, and traditional knowledge archives.
        </p>
      </header>

      <main className="sources-grid">
        {SOURCES.map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="source-card">
            <div className="source-header">
              <span className="source-icon">{s.icon}</span>
              <div>
                <div className="source-title">{s.name}</div>
                <span className="source-tag">{s.tag}</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {s.desc}
            </p>
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
   MAIN APP ROUTER
   ============================================================ */
export default function App() {
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [prefillPrompt, setPrefillPrompt] = useState('')
  const { theme, toggleTheme } = useTheme()
  const { fontSize, setFontSize } = useFontSize()

  const handleAskChatFromWizard = (prompt) => {
    setPrefillPrompt(prompt)
    window.location.hash = ''
  }

  return (
    <BrowserRouter>
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <FormulationWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onAskChat={handleAskChatFromWizard}
      />

      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              onOpenAbout={() => setIsAboutOpen(true)}
              onOpenWizard={() => setIsWizardOpen(true)}
              theme={theme}
              toggleTheme={toggleTheme}
              fontSize={fontSize}
              setFontSize={setFontSize}
              setPrefillPrompt={setPrefillPrompt}
            />
          }
        />
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
        <Route
          path="/abs-checker"
          element={
            <ABSCheckerPage
              onOpenAbout={() => setIsAboutOpen(true)}
              onOpenWizard={() => setIsWizardOpen(true)}
              theme={theme}
              toggleTheme={toggleTheme}
              fontSize={fontSize}
              setFontSize={setFontSize}
              setPrefillPrompt={setPrefillPrompt}
            />
          }
        />
        <Route
          path="/sources"
          element={
            <SourcesPage
              onOpenAbout={() => setIsAboutOpen(true)}
              onOpenWizard={() => setIsWizardOpen(true)}
              theme={theme}
              toggleTheme={toggleTheme}
              fontSize={fontSize}
              setFontSize={setFontSize}
              setPrefillPrompt={setPrefillPrompt}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
