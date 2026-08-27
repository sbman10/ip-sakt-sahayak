import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom'
import './index.css'

// REMOVED: Floating herb particles system has been removed to keep the background clean and professional.

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

  useState(() => {
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
  }, [phraseIdx, charIdx, deleting])

  return displayText
}

/* ============================================================
   LANDING PAGE
   ============================================================ */
function LandingPage() {
  const navigate = useNavigate()
  const text = useTypewriter(TYPEWRITER_PHRASES)

  return (
    <div className="landing">
      {/* REMOVED: <Particles /> background component invocation is deleted to keep background flat and clean */}

      {/* Navbar */}
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-brand">
          <div className="navbar-logo" aria-hidden="true">🌿</div>
          <div className="navbar-name">
            <span className="brand-main">IP-SAKTI Sahayak</span>
            <span className="brand-sub devanagari">बौद्धिक संपदा सहायक</span>
          </div>
        </div>
        <button
          className="navbar-cta"
          id="nav-start-btn"
          onClick={() => navigate('/chat')}
        >
          Start Asking →
        </button>
      </nav>

      {/* Hero */}
      <section className="hero-section" id="hero" aria-labelledby="hero-title">
        <div className="hero-eyebrow">
          <span>🏆</span>
          <span>SIH 2026 · Ministry of AYUSH</span>
        </div>

        <h1 className="hero-title" id="hero-title">IP-SAKTI Sahayak</h1>
        <p className="hero-title-sub">Your Trusted Guide to Ayurvedic Intellectual Property</p>

        <div className="typewriter-wrap" aria-live="polite" aria-label="Rotating phrases">
          <span className="typewriter">{text}</span>
          <span className="typewriter-cursor" aria-hidden="true" />
        </div>

        <div className="hero-cta-group">
          <button
            className="btn-primary"
            id="hero-start-btn"
            onClick={() => navigate('/chat')}
          >
            Start Asking →
          </button>
          <a href="#how-it-works" className="btn-secondary">
            How it works ↓
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="section" id="features" aria-labelledby="features-title">
        <p className="section-label">What We Offer</p>
        <h2 className="section-title" id="features-title">Everything you need for Ayurvedic IP</h2>
        <div className="features-grid">
          {[
            {
              icon: '📜',
              title: 'Cited Answers',
              desc: 'Every response is backed by exact citations from Patents Act 1970, BD Act 2002, TKDL, and other official statutes.',
              delay: '0.1s',
            },
            {
              icon: '🌐',
              title: 'Multilingual Support',
              desc: 'Ask in Hindi, Kannada, Bengali, Tamil, or English. We understand and respond in your language.',
              delay: '0.2s',
            },
            {
              icon: '⚖️',
              title: 'Jurisdiction-Aware',
              desc: 'Toggle between India 🇮🇳 and International 🌐 perspectives. Know which laws apply where.',
              delay: '0.3s',
            },
            {
              icon: '🔒',
              title: 'Confidence Scoring',
              desc: 'Each answer comes with a confidence level — High, Moderate, or Low — so you know when to consult an expert.',
              delay: '0.35s',
            },
            {
              icon: '🧪',
              title: 'Formulation Wizard',
              desc: 'Step-by-step guidance on filing IP applications for Ayurvedic formulations and traditional knowledge claims.',
              delay: '0.4s',
            },
            {
              icon: '🛡️',
              title: 'TKDL & GI Protection',
              desc: 'Understand how the Traditional Knowledge Digital Library protects your heritage from biopiracy.',
              delay: '0.45s',
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
            { n: '01', title: 'Ask Your Question', desc: 'Type or speak your IP question in any language — Hindi, English, or regional.' },
            { n: '02', title: 'Select Jurisdiction', desc: 'Choose India 🇮🇳 for domestic law or International 🌐 for PCT / TRIPS / CBD treaties.' },
            { n: '03', title: 'Get Cited Answers', desc: 'Receive precise answers with statute citations, section numbers, and links to official sources.' },
            { n: '04', title: 'Consult & Act', desc: 'Use the confidence badge to decide if you need a lawyer, or proceed with the Formulation Wizard.' },
          ].map((s, i) => (
            <div key={s.n} className="step-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="step-number" aria-hidden="true">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <div className="trust-section" id="sources" aria-labelledby="trust-title">
        <p className="section-label">Official Sources</p>
        <h2 className="section-title" id="trust-title" style={{ marginBottom: 0 }}>
          Built on authoritative data
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Answers grounded in official government and international databases
        </p>
        <div className="trust-logos">
          {[
            { icon: '🏛️', name: 'India Code' },
            { icon: '🔖', name: 'IP India' },
            { icon: '🌿', name: 'AYUSH Portal' },
            { icon: '📚', name: 'TKDL' },
            { icon: '🌍', name: 'WIPO' },
            { icon: '📋', name: 'CBD / Nagoya' },
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
          This tool provides information only, not legal advice. Consult a qualified IP attorney for legal decisions.
        </p>
      </footer>
    </div>
  )
}

/* ============================================================
   DEMO DATA for Chat page preview
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
]

/* ============================================================
   CHAT COMPONENTS
   ============================================================ */

function CitationCard({ citation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="citation-card"
    >
      <span className="citation-title">{citation.title}</span>
      <span className="citation-url">{citation.url}</span>
    </a>
  )
}

function ConfidenceBadge({ level }) {
  const map = {
    high:   { label: '● High Confidence',                       cls: 'high' },
    medium: { label: '● Moderate Confidence — Verify with expert', cls: 'medium' },
    low:    { label: '● Low Confidence — Please consult a lawyer', cls: 'low' },
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
      <span>This is information only, not legal advice. Consult a qualified IP attorney for legal decisions.</span>
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

  // AI message
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

/* ============================================================
   JURISDICTION TOGGLE
   ============================================================ */
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
   CHAT PAGE
   ============================================================ */
function ChatPage() {
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [input, setInput] = useState('')
  const [jurisdiction, setJurisdiction] = useState('india')
  const [lang, setLang] = useState('en')
  const [typing, setTyping] = useState(false)

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMsg = { id: Date.now(), role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)

    // Simulate AI response (placeholder — no backend yet)
    setTimeout(() => {
      setTyping(false)
      const aiMsg = {
        id: Date.now() + 1,
        role: 'ai',
        text: `You asked: "${trimmed}"\n\nThis is a UI framework demo — backend integration will be added in a future phase. The full RAG pipeline will cite real statutes and return jurisdiction-specific (${jurisdiction === 'india' ? '🇮🇳 India' : '🌐 International'}) answers.`,
        citations: [],
        confidence: 'medium',
        showDisclaimer: true,
      }
      setMessages(prev => [...prev, aiMsg])
    }, 1800)
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([DEMO_MESSAGES[0]])
    setInput('')
  }

  return (
    <div className="chat-layout" role="main">
      {/* Topbar */}
      <header className="chat-topbar" role="banner">
        <Link to="/" className="chat-brand" aria-label="Back to IP-SAKTI Sahayak home">
          <div className="chat-brand-icon" aria-hidden="true">🌿</div>
          <span className="chat-brand-name">IP-SAKTI Sahayak</span>
        </Link>

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
        </div>
      </header>

      {/* Chat Body */}
      <div
        className="chat-body"
        id="chat-messages"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {/* Wizard shortcuts */}
        <div className="wizard-shortcut-bar" aria-label="Quick actions">
          {[
            { icon: '🧪', label: 'Formulation Wizard' },
            { icon: '📋', label: 'Check Patentability' },
            { icon: '🔖', label: 'Trademark Guide' },
            { icon: '🌿', label: 'GI Tag Info' },
            { icon: '🛡️', label: 'TKDL Lookup' },
          ].map(b => (
            <button
              key={b.label}
              className="wizard-btn"
              id={`wizard-${b.label.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => setInput(b.label + ' — ')}
            >
              <span aria-hidden="true">{b.icon}</span>
              {b.label}
            </button>
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
              placeholder="Ask about patents, GI tags, trademarks, TKDL…"
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
          <button className="action-btn" id="voice-input-btn" aria-label="Voice input">
            🎙️ Voice
          </button>
          <button className="action-btn" id="classify-btn" aria-label="Classify IP type">
            🔍 Classify
          </button>
          <button className="action-btn" id="clear-chat-btn" onClick={handleClear} aria-label="Clear chat">
            🗑️ Clear
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   APP ROOT — Router
   ============================================================ */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  )
}
