import React, { useEffect, useState, useCallback } from 'react'

/**
 * AccessibilityPanel — a real, working accessibility toolkit.
 *
 * The old accessibility bar only had A-/A/A+ font buttons and felt like it
 * "did nothing". This replaces it with a proper panel whose every toggle
 * VISIBLY changes the page and PERSISTS across reloads.
 *
 * How it works (no hard-coding of per-page styles): each setting flips a class
 * or data-attribute on <html>, and one injected <style> block defines what
 * those classes do site-wide. Because the app's typography is rem-based and
 * <html> font-size is what the font-scale changes, the scaling cascades to the
 * whole site. Settings are saved to localStorage and re-applied on load.
 */

const LS_KEY = 'ip_sakti_a11y_v1'

const DEFAULTS = {
  fontScale: 'md',      // sm | md | lg | xl
  contrast: false,      // high-contrast mode
  dyslexia: false,      // dyslexia-friendly spacing/weight
  highlightLinks: false,// underline + box links
  bigCursor: false,     // large cursor
  reduceMotion: false,  // stop animations
  readAloud: false,     // click-to-read (TTS)
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch (_) {}
  // Migrate the old standalone font-size flag if present.
  const legacy = localStorage.getItem('ip_sakti_font_size')
  return { ...DEFAULTS, fontScale: legacy || 'md' }
}

function applySettings(s) {
  const html = document.documentElement
  html.setAttribute('data-font-scale', s.fontScale)
  html.classList.toggle('a11y-contrast', s.contrast)
  html.classList.toggle('a11y-dyslexia', s.dyslexia)
  html.classList.toggle('a11y-links', s.highlightLinks)
  html.classList.toggle('a11y-cursor', s.bigCursor)
  html.classList.toggle('a11y-reduce-motion', s.reduceMotion)
  html.classList.toggle('a11y-readaloud', s.readAloud)
  // keep the legacy key in sync so the old useFontSize hook agrees
  try { localStorage.setItem('ip_sakti_font_size', s.fontScale) } catch (_) {}
}

export default function AccessibilityPanel({ t, hideFab = false }) {
  const tr = t || ((k, d) => d)
  const [open, setOpen] = useState(false)
  const [s, setS] = useState(loadSettings)

  // Expose a global opener so a navbar icon can open the panel without
  // prop-drilling through the large App tree.
  useEffect(() => {
    window.__openAccessibility = () => setOpen(true)
    window.dispatchEvent(new Event('a11y-panel-ready'))
    return () => { try { delete window.__openAccessibility } catch (_) {} }
  }, [])

  // Apply + persist on every change.
  useEffect(() => {
    applySettings(s)
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch (_) {}
  }, [s])

  const set = useCallback((patch) => setS((prev) => ({ ...prev, ...patch })), [])

  // Read-aloud: when enabled, clicking any text (or selecting text) reads it
  // via the Web Speech API. Robust against Chrome's voice-loading + autoplay quirks.
  useEffect(() => {
    if (!s.readAloud || typeof window === 'undefined' || !window.speechSynthesis) return
    const synth = window.speechSynthesis

    const speak = (rawText) => {
      const text = (rawText || '').trim().replace(/\s+/g, ' ')
      if (!text || text.length < 2) return
      const clipped = text.slice(0, 800)
      try { synth.cancel() } catch (_) {}
      const langAttr = (document.documentElement.getAttribute('lang') || 'en').toLowerCase()
      const langPref = langAttr === 'hi' ? 'hi-IN' : 'en-IN'
      const u = new SpeechSynthesisUtterance(clipped)
      u.lang = langPref
      u.rate = 0.95
      const voices = synth.getVoices()
      if (voices && voices.length) {
        const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(langPref.slice(0, 2)))
          || voices.find((x) => /^en/i.test(x.lang)) || voices[0]
        if (v) u.voice = v
      }
      synth.speak(u)
      // Chrome bug: speech can stay paused right after speak(); nudge it.
      setTimeout(() => { try { if (synth.paused) synth.resume() } catch (_) {} }, 150)
    }

    const onClick = (e) => {
      if (e.target.closest('.a11y-panel, .a11y-fab, .a11y-scrim')) return
      // If the user selected text, read the selection; else read the clicked block.
      const sel = window.getSelection && window.getSelection().toString()
      if (sel && sel.trim().length > 1) { speak(sel); return }
      const el = e.target.closest('p, li, h1, h2, h3, h4, h5, a, button, label, td, th, blockquote, span')
      if (!el) return
      speak(el.innerText || el.textContent)
    }

    // Prime the engine inside the current (toggle) user-gesture so the first
    // real click is allowed to speak on Chrome. Also warm the voice list.
    try {
      synth.getVoices()
      const primer = new SpeechSynthesisUtterance('')
      primer.volume = 0
      synth.speak(primer)
      synth.cancel()
    } catch (_) {}

    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      try { synth.cancel() } catch (_) {}
    }
  }, [s.readAloud])

  const reset = () => {
    setS(DEFAULTS)
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  }

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stopReading = () => {
    try { window.speechSynthesis && window.speechSynthesis.cancel() } catch (_) {}
  }

  // Reliable one-click reader: speaks the main content of the current page,
  // called directly inside the button's click (a valid user gesture on Chrome).
  const readMainContent = () => {
    if (!ttsSupported) return
    const synth = window.speechSynthesis
    const scope = document.querySelector('main, .chat-main-area, [role="main"]') || document.body
    // Gather visible text, skipping our own panel and nav chrome.
    const clone = scope.cloneNode(true)
    clone.querySelectorAll('.a11y-panel, .a11y-fab, .a11y-scrim, nav, script, style').forEach((n) => n.remove())
    const text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000)
    if (!text) return
    try { synth.cancel() } catch (_) {}
    const langAttr = (document.documentElement.getAttribute('lang') || 'en').toLowerCase()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = langAttr === 'hi' ? 'hi-IN' : 'en-IN'
    u.rate = 0.98
    const voices = synth.getVoices()
    if (voices && voices.length) {
      const v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(u.lang.slice(0, 2))) || voices.find((x) => /^en/i.test(x.lang)) || voices[0]
      if (v) u.voice = v
    }
    synth.speak(u)
    setTimeout(() => { try { if (synth.paused) synth.resume() } catch (_) {} }, 150)
  }

  const activeCount = Object.entries(s).filter(([k, v]) => k !== 'fontScale' && v).length + (s.fontScale !== 'md' ? 1 : 0)

  return (
    <>
      <style>{STYLE}</style>

      {!hideFab && (
        <button
          className="a11y-fab"
          aria-label={tr('a11yTitle', 'Accessibility options')}
          title={tr('a11yTitle', 'Accessibility options')}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>♿</span>
          {activeCount > 0 && <span className="a11y-fab-badge">{activeCount}</span>}
        </button>
      )}

      {open && <div className="a11y-scrim" onClick={() => setOpen(false)} />}

      <aside className={`a11y-panel ${open ? 'open' : ''}`} role="dialog" aria-label={tr('a11yTitle', 'Accessibility options')} aria-hidden={!open}>
        <div className="a11y-head">
          <span>♿ {tr('a11yHeading', 'Accessibility')}</span>
          <button className="a11y-close" aria-label={tr('close', 'Close')} onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="a11y-body">
          {/* Font size */}
          <div className="a11y-group">
            <div className="a11y-label">{tr('a11yFont', 'Text size')}</div>
            <div className="a11y-seg">
              {[['sm', 'A'], ['md', 'A'], ['lg', 'A'], ['xl', 'A']].map(([val, ch], i) => (
                <button
                  key={val}
                  className={`a11y-seg-btn ${s.fontScale === val ? 'active' : ''}`}
                  style={{ fontSize: 12 + i * 3 }}
                  onClick={() => set({ fontScale: val })}
                  aria-pressed={s.fontScale === val}
                  title={`${tr('a11yFont', 'Text size')}: ${val.toUpperCase()}`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          {[
            { key: 'contrast', icon: '🌗', label: tr('a11yContrast', 'High contrast') },
            { key: 'dyslexia', icon: '🔤', label: tr('a11yDyslexia', 'Readable font & spacing') },
            { key: 'highlightLinks', icon: '🔗', label: tr('a11yLinks', 'Highlight links') },
            { key: 'bigCursor', icon: '🖱️', label: tr('a11yCursor', 'Large cursor') },
            { key: 'reduceMotion', icon: '🎞️', label: tr('a11yMotion', 'Reduce motion') },
            { key: 'readAloud', icon: '🔊', label: tr('a11yRead', 'Read aloud (click text)') },
          ].map((row) => (
            <button
              key={row.key}
              className={`a11y-toggle ${s[row.key] ? 'on' : ''}`}
              onClick={() => set({ [row.key]: !s[row.key] })}
              aria-pressed={!!s[row.key]}
            >
              <span className="a11y-toggle-ic" aria-hidden="true">{row.icon}</span>
              <span className="a11y-toggle-label">{row.label}</span>
              <span className={`a11y-switch ${s[row.key] ? 'on' : ''}`} aria-hidden="true"><span /></span>
            </button>
          ))}

          {/* Read-aloud active hint + reliable one-click reader */}
          {s.readAloud && (
            <div className="a11y-hint">
              {ttsSupported ? (
                <>
                  <div>🔊 {tr('a11yReadOn', 'Read aloud is ON — click any text (or select text) to hear it.')}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="a11y-mini" onClick={readMainContent}>▶ {tr('a11yReadPage', 'Read this page')}</button>
                    <button className="a11y-mini" onClick={stopReading}>⏹ {tr('a11yStop', 'Stop')}</button>
                  </div>
                </>
              ) : (
                <div>⚠️ {tr('a11yNoTts', 'Your browser does not support text-to-speech. Try Chrome or Edge.')}</div>
              )}
            </div>
          )}

          <button className="a11y-reset" onClick={reset}>↺ {tr('a11yReset', 'Reset all')}</button>
          <p className="a11y-note">{tr('a11yNote', 'Your choices are saved on this device.')}</p>
        </div>
      </aside>
    </>
  )
}

// Re-apply saved settings as early as possible (module import time), so a
// reload restores the user's accessibility state before React mounts.
if (typeof document !== 'undefined') {
  try { applySettings(loadSettings()) } catch (_) {}
}

const STYLE = `
/* Floating accessibility button */
.a11y-fab{position:fixed;right:18px;bottom:18px;z-index:99998;width:52px;height:52px;border-radius:50%;
  background:linear-gradient(135deg,#143D30,#1E8449);color:#fff;border:2px solid #D4AF37;cursor:pointer;
  box-shadow:0 8px 24px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;transition:transform .2s}
.a11y-fab:hover{transform:scale(1.08)}
.a11y-fab-badge{position:absolute;top:-4px;right:-4px;background:#D4AF37;color:#143D30;font-size:11px;font-weight:800;
  min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}
.a11y-scrim{position:fixed;inset:0;background:rgba(8,24,18,.35);z-index:99998}
.a11y-panel{position:fixed;top:0;right:0;height:100vh;width:320px;max-width:90vw;background:#fff;z-index:99999;
  box-shadow:-8px 0 40px rgba(0,0,0,.3);transform:translateX(102%);transition:transform .3s cubic-bezier(.4,0,.2,1);
  display:flex;flex-direction:column;overflow-y:auto}
.a11y-panel.open{transform:translateX(0)}
.a11y-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;
  background:linear-gradient(135deg,#143D30,#1E8449);color:#fff;font-weight:800;font-size:1.05rem}
.a11y-close{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px}
.a11y-close:hover{background:rgba(255,255,255,.15)}
.a11y-body{padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.a11y-group{margin-bottom:4px}
.a11y-label{font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#4A5A4A;margin-bottom:8px}
.a11y-seg{display:flex;gap:6px}
.a11y-seg-btn{flex:1;padding:10px 0;border:2px solid rgba(20,61,48,.18);background:#fff;color:#143D30;border-radius:10px;
  cursor:pointer;font-weight:800;line-height:1}
.a11y-seg-btn.active{background:linear-gradient(135deg,#143D30,#1E8449);color:#fff;border-color:#143D30}
.a11y-toggle{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border:2px solid rgba(20,61,48,.14);
  background:#fff;border-radius:12px;cursor:pointer;text-align:left}
.a11y-toggle.on{border-color:#1E8449;background:rgba(30,132,73,.06)}
.a11y-toggle-ic{font-size:18px}
.a11y-toggle-label{flex:1;font-size:.92rem;font-weight:600;color:#2C3E2C}
.a11y-switch{width:40px;height:22px;border-radius:11px;background:rgba(20,61,48,.2);position:relative;transition:background .2s;flex-shrink:0}
.a11y-switch span{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.a11y-switch.on{background:#1E8449}
.a11y-switch.on span{transform:translateX(18px)}
.a11y-reset{margin-top:6px;padding:10px;border:none;background:rgba(20,61,48,.08);color:#143D30;font-weight:700;
  border-radius:10px;cursor:pointer}
.a11y-reset:hover{background:rgba(20,61,48,.14)}
.a11y-note{font-size:.72rem;color:#7A8A7A;text-align:center;margin:4px 0 0}
.a11y-hint{background:rgba(30,132,73,.08);border:1px solid rgba(30,132,73,.3);border-radius:10px;padding:10px 12px;
  font-size:.82rem;color:#143D30;font-weight:600;line-height:1.5}
.a11y-mini{flex:1;padding:8px;border:1px solid #1E8449;background:#fff;color:#1E8449;font-weight:700;border-radius:8px;
  cursor:pointer;font-size:.8rem}
.a11y-mini:hover{background:rgba(30,132,73,.1)}

/* ===== Effects applied site-wide via <html> classes ===== */
/* High contrast */
html.a11y-contrast{filter:contrast(1.18) saturate(1.15)}
html.a11y-contrast body{background:#000 !important;color:#fff !important}
html.a11y-contrast a,html.a11y-contrast a *{color:#ffe066 !important}
html.a11y-contrast .a11y-panel,html.a11y-contrast .a11y-panel *{filter:none}

/* Dyslexia-friendly: wider spacing, heavier weight, larger line-height */
html.a11y-dyslexia body{letter-spacing:.04em !important;word-spacing:.12em !important;line-height:1.9 !important}
html.a11y-dyslexia p,html.a11y-dyslexia li,html.a11y-dyslexia span,html.a11y-dyslexia div{font-weight:500}

/* Highlight links */
html.a11y-links a{text-decoration:underline !important;text-underline-offset:2px;outline:1px dashed currentColor;outline-offset:2px}

/* Large cursor */
html.a11y-cursor,html.a11y-cursor *{cursor:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M6 2 L6 32 L14 24 L20 36 L26 33 L20 22 L32 22 Z' fill='%23143D30' stroke='white' stroke-width='2'/></svg>") 4 2, auto !important}

/* Reduce motion */
html.a11y-reduce-motion *,html.a11y-reduce-motion *::before,html.a11y-reduce-motion *::after{
  animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important}

/* Read-aloud affordance */
html.a11y-readaloud p:hover,html.a11y-readaloud li:hover,html.a11y-readaloud h1:hover,
html.a11y-readaloud h2:hover,html.a11y-readaloud h3:hover{outline:2px dashed #1E8449;outline-offset:2px;cursor:pointer}

/* Extra font scale beyond the 3 the app shipped */
html[data-font-scale="xl"]{font-size:20px}
`
