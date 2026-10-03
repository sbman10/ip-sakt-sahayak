import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * AccessibilityPanel — Integrated Accessibility Dropdown & Popover
 *
 * Refactored from fixed side drawer to accessible dropdown popover opened directly
 * from the IP Tools navigation menu.
 *
 * Preserves all underlying settings, global document classes, TTS speech synthesis,
 * and localStorage persistence ('ip_sakti_a11y_v1' and 'ip_sakti_font_size').
 *
 * Adds dedicated Scrolling Accessibility controls (scroll-to-top, scroll-to-bottom,
 * page-up, page-down) with reduced-motion awareness and full keyboard navigation.
 */

const LS_KEY = 'ip_sakti_a11y_v1'

const DEFAULTS = {
  fontScale: 'md',        // sm | md | lg | xl
  contrast: false,        // high-contrast mode
  dyslexia: false,        // dyslexia-friendly spacing/weight
  highlightLinks: false,  // underline + box links
  bigCursor: false,       // large cursor
  reduceMotion: false,    // stop animations
  readAloud: false,       // click-to-read (TTS)
  hideImages: false,      // hide images / text-only mode
  focusIndicators: false, // high-contrast focus rings
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch (_) {}
  // Migrate legacy font size flag if present
  try {
    const legacy = localStorage.getItem('ip_sakti_font_size')
    if (legacy) return { ...DEFAULTS, fontScale: legacy }
  } catch (_) {}
  return { ...DEFAULTS }
}

function applySettings(s) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.setAttribute('data-font-scale', s.fontScale || 'md')
  html.classList.toggle('a11y-contrast', Boolean(s.contrast))
  html.classList.toggle('a11y-dyslexia', Boolean(s.dyslexia))
  html.classList.toggle('a11y-links', Boolean(s.highlightLinks))
  html.classList.toggle('a11y-cursor', Boolean(s.bigCursor))
  html.classList.toggle('a11y-reduce-motion', Boolean(s.reduceMotion))
  html.classList.toggle('a11y-readaloud', Boolean(s.readAloud))
  html.classList.toggle('a11y-hide-images', Boolean(s.hideImages))
  html.classList.toggle('a11y-focus-indicators', Boolean(s.focusIndicators))

  // Keep legacy key in sync so legacy font hooks agree
  try { localStorage.setItem('ip_sakti_font_size', s.fontScale || 'md') } catch (_) {}
}

// Re-apply saved settings at module load so reload restores state before React mounts
if (typeof document !== 'undefined') {
  try { applySettings(loadSettings()) } catch (_) {}
}

export default function AccessibilityPanel({
  isOpen,
  onClose,
  triggerRef,
  t,
  hideFab = true
}) {
  const tr = useCallback((k, fallback) => {
    if (typeof t === 'function') {
      const res = t(k)
      if (res && res !== k) return res
    }
    return fallback
  }, [t])
  const [internalOpen, setInternalOpen] = useState(false)
  const isEffectiveOpen = isOpen !== undefined ? isOpen : internalOpen
  const [s, setS] = useState(loadSettings)
  const [placement, setPlacement] = useState('desktop') // 'desktop' | 'mobile'
  const [floatingStyle, setFloatingStyle] = useState({})
  const panelRef = useRef(null)

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
    } else {
      setInternalOpen(false)
    }
    if (triggerRef?.current) {
      triggerRef.current.focus()
    }
  }, [onClose, triggerRef])

  // Expose global opener when used in standalone mode
  useEffect(() => {
    if (isOpen === undefined) {
      window.__openAccessibility = () => setInternalOpen(true)
      return () => {
        try { delete window.__openAccessibility } catch (_) {}
      }
    }
  }, [isOpen])

  // Apply and persist settings on every change
  useEffect(() => {
    applySettings(s)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s))
    } catch (_) {}
  }, [s])

  const set = useCallback((patch) => setS((prev) => ({ ...prev, ...patch })), [])

  // Responsive placement & floating coordinates calculation
  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined') return
    if (window.innerWidth <= 640) {
      setPlacement('mobile')
      setFloatingStyle({
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: '12px',
        top: 'auto',
        width: 'auto',
        maxWidth: 'none',
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 2600,
      })
      return
    }
    setPlacement('desktop')

    let triggerEl = triggerRef?.current
    if (!triggerEl) {
      triggerEl = document.getElementById('gov-top-a11y-btn') || document.getElementById('a11y-tools-trigger')
    }
    if (!triggerEl) return

    const triggerRect = triggerEl.getBoundingClientRect()
    const popoverWidth = Math.min(360, window.innerWidth - 24)

    // Calculate vertical position: drop down directly below the trigger button
    const spaceBelow = window.innerHeight - triggerRect.bottom - 16
    const spaceAbove = triggerRect.top - 16

    const floating = {
      position: 'fixed',
      zIndex: 2600,
      width: `${popoverWidth}px`,
    }

    if (spaceBelow < 280 && spaceAbove > spaceBelow) {
      // Flip upward if clamped at the very bottom of viewport
      floating.bottom = `${Math.round(window.innerHeight - triggerRect.top + 8)}px`
      floating.top = 'auto'
      floating.maxHeight = `${Math.min(580, spaceAbove)}px`
    } else {
      // Normal dropdown directly below the trigger button
      floating.top = `${Math.round(triggerRect.bottom + 8)}px`
      floating.bottom = 'auto'
      floating.maxHeight = `${Math.min(580, Math.max(260, spaceBelow))}px`
    }

    // Horizontal alignment directly below the button:
    // If the button is right-aligned (e.g. top utility strip button or right half of screen), align right edges
    const isRightAligned = (triggerRect.left + popoverWidth > window.innerWidth - 16) || (triggerRect.left > window.innerWidth / 2)

    if (isRightAligned) {
      const rightGap = Math.max(12, Math.round(window.innerWidth - triggerRect.right))
      floating.right = `${rightGap}px`
      floating.left = 'auto'
    } else {
      const leftPos = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, Math.round(triggerRect.left)))
      floating.left = `${leftPos}px`
      floating.right = 'auto'
    }

    setFloatingStyle(floating)
  }, [triggerRef])

  useEffect(() => {
    if (!isEffectiveOpen) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isEffectiveOpen, updatePosition])

  // Focus management & Escape key handling
  useEffect(() => {
    if (!isEffectiveOpen) return

    // Focus initial interactive element
    const timer = setTimeout(() => {
      if (panelRef.current) {
        const firstFocusable = panelRef.current.querySelector('button:not(.a11y-close), [tabindex="0"]')
        if (firstFocusable) firstFocusable.focus()
      }
    }, 50)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEffectiveOpen, handleClose])

  // Outside click listener
  useEffect(() => {
    if (!isEffectiveOpen) return

    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        (!triggerRef?.current || !triggerRef.current.contains(e.target)) &&
        !e.target.closest('#gov-top-a11y-btn')
      ) {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isEffectiveOpen, handleClose, triggerRef])

  // Read-Aloud (Text-to-Speech)
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!s.readAloud || !ttsSupported) return
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
      setTimeout(() => { try { if (synth.paused) synth.resume() } catch (_) {} }, 150)
    }

    const onClick = (e) => {
      if (e.target.closest('.a11y-popover-panel, .a11y-fab, #a11y-tools-trigger')) return
      const sel = window.getSelection && window.getSelection().toString()
      if (sel && sel.trim().length > 1) { speak(sel); return }
      const el = e.target.closest('p, li, h1, h2, h3, h4, h5, a, button, label, td, th, blockquote, span')
      if (!el) return
      speak(el.innerText || el.textContent)
    }

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
  }, [s.readAloud, ttsSupported])

  const stopReading = () => {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel() } catch (_) {}
  }

  const readMainContent = () => {
    if (!ttsSupported) return
    const synth = window.speechSynthesis
    const scope = document.querySelector('main, .ragvyn-shell-main, [role="main"]') || document.body
    const clone = scope.cloneNode(true)
    clone.querySelectorAll('.a11y-popover-panel, nav, header, footer, script, style').forEach((n) => n.remove())
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

  // Scrolling Accessibility Actions (Requirement 4)
  const doScroll = (top, delta = null) => {
    const behavior = s.reduceMotion ? 'auto' : 'smooth'
    if (delta !== null) {
      window.scrollBy({ top: delta, behavior })
      if (document.body && typeof document.body.scrollBy === 'function') {
        document.body.scrollBy({ top: delta, behavior })
      }
      if (document.documentElement && typeof document.documentElement.scrollBy === 'function') {
        document.documentElement.scrollBy({ top: delta, behavior })
      }
    } else {
      window.scrollTo({ top, behavior })
      if (document.body && typeof document.body.scrollTo === 'function') {
        document.body.scrollTo({ top, behavior })
      }
      if (document.documentElement && typeof document.documentElement.scrollTo === 'function') {
        document.documentElement.scrollTo({ top, behavior })
      }
    }
  }

  const scrollToTop = () => {
    doScroll(0)
  }

  const scrollToBottom = () => {
    const maxScroll = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0,
      window.innerHeight
    )
    doScroll(maxScroll)
  }

  const scrollPageUp = () => {
    const delta = -Math.round(window.innerHeight * 0.75)
    doScroll(null, delta)
  }

  const scrollPageDown = () => {
    const delta = Math.round(window.innerHeight * 0.75)
    doScroll(null, delta)
  }

  // Step font scale
  const stepFontSize = (delta) => {
    const scales = ['sm', 'md', 'lg', 'xl']
    const curIndex = scales.indexOf(s.fontScale)
    const nextIndex = Math.max(0, Math.min(scales.length - 1, (curIndex === -1 ? 1 : curIndex) + delta))
    set({ fontScale: scales[nextIndex] })
  }

  const resetAll = () => {
    setS(DEFAULTS)
    stopReading()
  }

  if (!isEffectiveOpen) {
    return <style>{STYLE}</style>
  }

  const content = (
    <section
      id="a11y-popover-panel"
      ref={panelRef}
      className={`a11y-popover-panel placement-${placement}`}
      style={placement === 'desktop' ? floatingStyle : undefined}
      role="dialog"
      aria-modal={placement === 'desktop'}
      aria-label={tr('a11yTitle', 'Accessibility Tools')}
    >
        {/* Header */}
        <div className="a11y-head">
          <div className="a11y-head-title">
            <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>♿</span>
            <span>{tr('a11yHeading', 'Accessibility Tools')}</span>
          </div>
          <button
            type="button"
            className="a11y-close"
            aria-label={tr('close', 'Close Accessibility Tools')}
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="a11y-body">
          {/* Section 1: Text Size & Font Scaling */}
          <div className="a11y-group">
            <div className="a11y-label">{tr('a11yFont', 'Text Size & Typography')}</div>
            <div className="a11y-font-controls">
              <button
                type="button"
                className="a11y-quick-btn"
                onClick={() => stepFontSize(-1)}
                title="Decrease font size"
                aria-label="Decrease text size"
              >
                A-
              </button>
              <button
                type="button"
                className="a11y-quick-btn"
                onClick={() => set({ fontScale: 'md' })}
                title="Reset to default text size"
                aria-label="Default text size"
              >
                Default
              </button>
              <button
                type="button"
                className="a11y-quick-btn"
                onClick={() => stepFontSize(1)}
                title="Increase font size"
                aria-label="Increase text size"
              >
                A+
              </button>

              <div className="a11y-seg" role="group" aria-label="Font scale size options">
                {[
                  ['sm', 'SM'],
                  ['md', 'MD'],
                  ['lg', 'LG'],
                  ['xl', 'XL'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`a11y-seg-btn ${s.fontScale === val ? 'active' : ''}`}
                    onClick={() => set({ fontScale: val })}
                    aria-pressed={s.fontScale === val}
                    title={`Set text size to ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Visual & Display Toggles */}
          <div className="a11y-group">
            <div className="a11y-label">Display & Visual Settings</div>
            <div className="a11y-toggle-stack">
              {[
                { key: 'contrast', icon: '🌗', label: tr('a11yContrast', 'High contrast mode') },
                { key: 'dyslexia', icon: '🔤', label: tr('a11yDyslexia', 'Readable font & spacing') },
                { key: 'highlightLinks', icon: '🔗', label: tr('a11yLinks', 'Highlight links & targets') },
                { key: 'focusIndicators', icon: '🎯', label: 'Enhanced focus rings' },
                { key: 'bigCursor', icon: '🖱️', label: tr('a11yCursor', 'Large high-visibility cursor') },
                { key: 'reduceMotion', icon: '🎞️', label: tr('a11yMotion', 'Reduce motion & animations') },
                { key: 'hideImages', icon: '🖼️', label: 'Hide images (text-only mode)' },
                { key: 'readAloud', icon: '🔊', label: tr('a11yRead', 'Read aloud (click text)') },
              ].map((row) => (
                <button
                  key={row.key}
                  type="button"
                  className={`a11y-toggle ${s[row.key] ? 'on' : ''}`}
                  onClick={() => set({ [row.key]: !s[row.key] })}
                  aria-pressed={Boolean(s[row.key])}
                >
                  <span className="a11y-toggle-ic" aria-hidden="true">{row.icon}</span>
                  <span className="a11y-toggle-label">{row.label}</span>
                  <span className={`a11y-switch ${s[row.key] ? 'on' : ''}`} aria-hidden="true">
                    <span />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Read Aloud Auxiliary Controls */}
          {s.readAloud && (
            <div className="a11y-hint" role="status">
              {ttsSupported ? (
                <>
                  <div>🔊 {tr('a11yReadOn', 'Read aloud is ON — click any text to listen.')}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="a11y-mini" onClick={readMainContent}>
                      ▶ {tr('a11yReadPage', 'Read page')}
                    </button>
                    <button type="button" className="a11y-mini" onClick={stopReading}>
                      ⏹ {tr('a11yStop', 'Stop')}
                    </button>
                  </div>
                </>
              ) : (
                <div>⚠️ {tr('a11yNoTts', 'Your browser does not support text-to-speech.')}</div>
              )}
            </div>
          )}

          {/* Section 3: Scrolling Accessibility (Requirement 4) */}
          <div className="a11y-group">
            <div className="a11y-label">Scrolling Accessibility</div>
            <div className="a11y-scroll-grid">
              <button
                type="button"
                className="a11y-action-btn"
                onClick={scrollToTop}
                title="Scroll page to the very top"
              >
                <span aria-hidden="true">⬆</span>
                <span>Scroll to Top</span>
              </button>
              <button
                type="button"
                className="a11y-action-btn"
                onClick={scrollToBottom}
                title="Scroll page to the very bottom"
              >
                <span aria-hidden="true">⬇</span>
                <span>Scroll to Bottom</span>
              </button>
              <button
                type="button"
                className="a11y-action-btn"
                onClick={scrollPageUp}
                title="Scroll up by one screen view"
              >
                <span aria-hidden="true">▲</span>
                <span>Page Up</span>
              </button>
              <button
                type="button"
                className="a11y-action-btn"
                onClick={scrollPageDown}
                title="Scroll down by one screen view"
              >
                <span aria-hidden="true">▼</span>
                <span>Page Down</span>
              </button>
            </div>
            <div className="a11y-keyboard-hint">
              <span aria-hidden="true">⌨️</span>
              <span>
                Native keyboard scrolling: use <strong>Arrow Up/Down</strong>, <strong>Page Up/Down</strong>, <strong>Home</strong> (top), <strong>End</strong> (bottom).
              </span>
            </div>
          </div>

          {/* Section 4: Footer Reset and Notice */}
          <button type="button" className="a11y-reset" onClick={resetAll}>
            ↺ {tr('a11yReset', 'Reset all settings')}
          </button>
          <p className="a11y-note">
            {tr('a11yNote', 'Settings persist across all pages and future visits on this device.')}
          </p>
        </div>
      </section>
  )

  if (typeof document === 'undefined') {
    return <style>{STYLE}</style>
  }

  return (
    <>
      <style>{STYLE}</style>
      {createPortal(content, document.body)}
    </>
  )
}

const STYLE = `
/* ============================================================
   INTEGRATED ACCESSIBILITY DROPDOWN / POPOVER STYLES
   ============================================================ */

.a11y-popover-panel {
  position: fixed;
  z-index: 2600;
  width: 360px;
  max-width: min(360px, calc(100vw - 24px));
  max-height: min(580px, calc(100vh - 40px));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  background: var(--bg-surface, #ffffff);
  color: var(--text-main, #0f172a);
  border: 1px solid var(--border-clean, #e2e8f0);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(10, 25, 20, 0.22), 0 2px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  animation: a11yFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  scrollbar-width: thin;
}

.a11y-popover-panel.placement-mobile {
  position: static;
  width: 100%;
  max-width: 100%;
  max-height: none;
  margin-top: 10px;
  box-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(14, 38, 30, 0.95);
  color: #F1F5F9;
}

@keyframes a11yFadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

[data-theme="dark"] .a11y-popover-panel {
  background: #15221d;
  color: #F1F5F9;
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6);
}

.a11y-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #143D30, #1E8449);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 0.94rem;
  border-top-left-radius: 13px;
  border-top-right-radius: 13px;
  position: sticky;
  top: 0;
  z-index: 2;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}

.a11y-head-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.a11y-close {
  background: transparent;
  border: none;
  color: #FFFFFF;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.a11y-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.a11y-close:focus-visible {
  outline: 2px solid #D4AF37;
  outline-offset: 2px;
}

.a11y-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.a11y-group {
  margin-bottom: 2px;
}

.a11y-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted-clean, #64748b);
  margin-bottom: 6px;
}

[data-theme="dark"] .a11y-label {
  color: #94A3B8;
}

.a11y-font-controls {
  display: flex;
  gap: 6px;
  align-items: center;
}

.a11y-quick-btn {
  padding: 6px 10px;
  border: 1px solid var(--border-clean, rgba(20, 61, 48, 0.18));
  background: var(--bg-surface, #ffffff);
  color: var(--ragvyn-blue, #0d463b);
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.15s ease;
}

.a11y-quick-btn:hover {
  background: rgba(20, 61, 48, 0.08);
}

.a11y-quick-btn:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 2px;
}

[data-theme="dark"] .a11y-quick-btn {
  background: rgba(255, 255, 255, 0.06);
  color: #F1F5F9;
  border-color: rgba(255, 255, 255, 0.15);
}

.a11y-seg {
  display: flex;
  gap: 4px;
  flex: 1;
}

.a11y-seg-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--border-clean, rgba(20, 61, 48, 0.18));
  background: var(--bg-surface, #ffffff);
  color: var(--ragvyn-blue, #0d463b);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.76rem;
  line-height: 1;
  transition: all 0.15s ease;
}

.a11y-seg-btn:hover {
  background: rgba(20, 61, 48, 0.06);
}

.a11y-seg-btn.active {
  background: linear-gradient(135deg, #143D30, #1E8449);
  color: #ffffff;
  border-color: #143D30;
}

[data-theme="dark"] .a11y-seg-btn {
  background: rgba(255, 255, 255, 0.06);
  color: #CBD5E1;
  border-color: rgba(255, 255, 255, 0.12);
}

[data-theme="dark"] .a11y-seg-btn.active {
  background: #10B981;
  color: #06241a;
  border-color: #10B981;
}

.a11y-toggle-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.a11y-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-clean, rgba(20, 61, 48, 0.14));
  background: var(--bg-surface, #ffffff);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.a11y-toggle:hover {
  border-color: #1E8449;
  background: rgba(30, 132, 73, 0.04);
}

.a11y-toggle.on {
  border-color: #1E8449;
  background: rgba(30, 132, 73, 0.08);
}

.a11y-toggle:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 2px;
}

[data-theme="dark"] .a11y-toggle {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme="dark"] .a11y-toggle.on {
  border-color: #10B981;
  background: rgba(16, 185, 129, 0.15);
}

.a11y-toggle-ic {
  font-size: 16px;
  line-height: 1;
}

.a11y-toggle-label {
  flex: 1;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}

[data-theme="dark"] .a11y-toggle-label {
  color: #E2E8F0;
}

.a11y-switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(20, 61, 48, 0.2);
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

[data-theme="dark"] .a11y-switch {
  background: rgba(255, 255, 255, 0.2);
}

.a11y-switch span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.a11y-switch.on {
  background: #1E8449;
}

[data-theme="dark"] .a11y-switch.on {
  background: #10B981;
}

.a11y-switch.on span {
  transform: translateX(16px);
}

.a11y-scroll-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.a11y-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border-clean, rgba(20, 61, 48, 0.16));
  background: var(--bg-surface, #ffffff);
  color: var(--ragvyn-blue, #0d463b);
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.a11y-action-btn:hover {
  background: rgba(20, 61, 48, 0.06);
  border-color: #1E8449;
}

.a11y-action-btn:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 2px;
}

[data-theme="dark"] .a11y-action-btn {
  background: rgba(255, 255, 255, 0.05);
  color: #E2E8F0;
  border-color: rgba(255, 255, 255, 0.12);
}

[data-theme="dark"] .a11y-action-btn:hover {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10B981;
}

.a11y-keyboard-hint {
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--text-muted-clean, #64748b);
  display: flex;
  align-items: flex-start;
  gap: 6px;
  line-height: 1.4;
  background: rgba(0, 0, 0, 0.02);
  padding: 6px 8px;
  border-radius: 6px;
}

[data-theme="dark"] .a11y-keyboard-hint {
  color: #94A3B8;
  background: rgba(255, 255, 255, 0.03);
}

.a11y-reset {
  margin-top: 4px;
  padding: 9px;
  border: none;
  background: rgba(20, 61, 48, 0.08);
  color: var(--ragvyn-blue, #143D30);
  font-weight: 700;
  font-size: 0.82rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.a11y-reset:hover {
  background: rgba(20, 61, 48, 0.14);
}

.a11y-reset:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 2px;
}

[data-theme="dark"] .a11y-reset {
  background: rgba(255, 255, 255, 0.08);
  color: #E2E8F0;
}

[data-theme="dark"] .a11y-reset:hover {
  background: rgba(255, 255, 255, 0.14);
}

.a11y-note {
  font-size: 0.68rem;
  color: var(--text-muted-clean, #7A8A7A);
  text-align: center;
  margin: 2px 0 0;
  line-height: 1.35;
}

.a11y-hint {
  background: rgba(30, 132, 73, 0.08);
  border: 1px solid rgba(30, 132, 73, 0.3);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.8rem;
  color: #143D30;
  font-weight: 600;
  line-height: 1.5;
}

[data-theme="dark"] .a11y-hint {
  color: #34d399;
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
}

.a11y-mini {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #1E8449;
  background: #ffffff;
  color: #1E8449;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.78rem;
}

.a11y-mini:hover {
  background: rgba(30, 132, 73, 0.1);
}

[data-theme="dark"] .a11y-mini {
  background: rgba(255, 255, 255, 0.06);
  color: #34d399;
  border-color: #34d399;
}

/* ===== Site-wide classes on <html> ===== */
html.a11y-contrast { filter: contrast(1.18) saturate(1.15); }
html.a11y-contrast body { background: #000 !important; color: #fff !important; }
html.a11y-contrast a, html.a11y-contrast a * { color: #ffe066 !important; }
html.a11y-contrast .a11y-popover-panel, html.a11y-contrast .a11y-popover-panel * { filter: none; }

html.a11y-dyslexia body { letter-spacing: .04em !important; word-spacing: .12em !important; line-height: 1.9 !important; }
html.a11y-dyslexia p, html.a11y-dyslexia li, html.a11y-dyslexia span, html.a11y-dyslexia div { font-weight: 500; }

html.a11y-links a { text-decoration: underline !important; text-underline-offset: 2px; outline: 1px dashed currentColor; outline-offset: 2px; }

html.a11y-cursor, html.a11y-cursor * {
  cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M6 2 L6 32 L14 24 L20 36 L26 33 L20 22 L32 22 Z' fill='%23143D30' stroke='white' stroke-width='2'/></svg>") 4 2, auto !important;
}

html.a11y-reduce-motion *, html.a11y-reduce-motion *::before, html.a11y-reduce-motion *::after {
  animation-duration: .001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: .001ms !important;
  scroll-behavior: auto !important;
}

html.a11y-hide-images img,
html.a11y-hide-images [style*="background-image"]:not(.hero-section) {
  opacity: 0.05 !important;
  filter: grayscale(100%) !important;
}

html.a11y-focus-indicators *:focus-visible {
  outline: 3px solid #D4AF37 !important;
  outline-offset: 3px !important;
}

html.a11y-readaloud p:hover, html.a11y-readaloud li:hover, html.a11y-readaloud h1:hover,
html.a11y-readaloud h2:hover, html.a11y-readaloud h3:hover {
  outline: 2px dashed #1E8449;
  outline-offset: 2px;
  cursor: pointer;
}

html[data-font-scale="xl"] { font-size: 20px; }
`
