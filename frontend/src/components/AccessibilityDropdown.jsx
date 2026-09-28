import { useState, useEffect, useRef, useCallback } from 'react'
import { IconX, IconAccessibility, IconRotate } from './Icons'
import { useLanguage } from '../locales'

const STORAGE_KEYS = {
  contrast: 'ragvyn_contrast',
  fontScale: 'ragvyn_font_scale',
  textSpacing: 'ragvyn_text_spacing',
  lineHeight: 'ragvyn_line_height',
  hideImages: 'ragvyn_hide_images',
  largeCursor: 'ragvyn_large_cursor',
}

const FONT_SCALES = ['sm', 'md', 'lg', 'xl']

export default function AccessibilityDropdown({ isOpen, onClose, triggerRef }) {
  const { t } = useLanguage()
  const popoverRef = useRef(null)

  // Local state initialized from localStorage
  const [contrast, setContrast] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.contrast) || 'normal'
  })

  const [fontScale, setFontScale] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.fontScale) || localStorage.getItem('ip_sakti_font_size') || 'md'
  })

  const [textSpacing, setTextSpacing] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.textSpacing) === 'increased'
  })

  const [lineHeight, setLineHeight] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.lineHeight) === 'increased'
  })

  const [hideImages, setHideImages] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.hideImages) === 'true'
  })

  const [largeCursor, setLargeCursor] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.largeCursor) === 'true'
  })

  const [isSpeaking, setIsSpeaking] = useState(false)
  const isTtsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Apply attributes to <html> whenever state changes
  useEffect(() => {
    const html = document.documentElement
    
    // Contrast
    if (contrast === 'high') {
      html.setAttribute('data-contrast', 'high')
      localStorage.setItem(STORAGE_KEYS.contrast, 'high')
    } else {
      html.removeAttribute('data-contrast')
      localStorage.setItem(STORAGE_KEYS.contrast, 'normal')
    }

    // Font Scale
    html.setAttribute('data-font-scale', fontScale)
    localStorage.setItem(STORAGE_KEYS.fontScale, fontScale)
    localStorage.setItem('ip_sakti_font_size', fontScale)

    // Text Spacing
    if (textSpacing) {
      html.setAttribute('data-text-spacing', 'increased')
      localStorage.setItem(STORAGE_KEYS.textSpacing, 'increased')
    } else {
      html.removeAttribute('data-text-spacing')
      localStorage.setItem(STORAGE_KEYS.textSpacing, 'normal')
    }

    // Line Height
    if (lineHeight) {
      html.setAttribute('data-line-height', 'increased')
      localStorage.setItem(STORAGE_KEYS.lineHeight, 'increased')
    } else {
      html.removeAttribute('data-line-height')
      localStorage.setItem(STORAGE_KEYS.lineHeight, 'normal')
    }

    // Hide Images
    if (hideImages) {
      html.setAttribute('data-hide-images', 'true')
      localStorage.setItem(STORAGE_KEYS.hideImages, 'true')
    } else {
      html.removeAttribute('data-hide-images')
      localStorage.setItem(STORAGE_KEYS.hideImages, 'false')
    }

    // Large Cursor
    if (largeCursor) {
      html.setAttribute('data-large-cursor', 'true')
      localStorage.setItem(STORAGE_KEYS.largeCursor, 'true')
    } else {
      html.removeAttribute('data-large-cursor')
      localStorage.setItem(STORAGE_KEYS.largeCursor, 'false')
    }
  }, [contrast, fontScale, textSpacing, lineHeight, hideImages, largeCursor])

  // Handle Close & Focus Return
  const handleClose = useCallback(() => {
    onClose()
    if (triggerRef && triggerRef.current) {
      triggerRef.current.focus()
    }
  }, [onClose, triggerRef])

  // Keyboard navigation & Escape key listener
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, handleClose, triggerRef])

  // Focus trap / initial focus on open
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      const focusable = popoverRef.current.querySelector('button, [tabindex="0"]')
      if (focusable) {
        focusable.focus()
      }
    }
  }, [isOpen])

  // Web Speech API: Read page aloud
  const handleToggleReadAloud = () => {
    if (!isTtsSupported) return
    const synth = window.speechSynthesis

    if (isSpeaking) {
      synth.cancel()
      setIsSpeaking(false)
      return
    }

    // Extract page text excluding navigation, modals, and hidden elements
    const mainEl = document.querySelector('main, .page-container, .ragvyn-landing, [role="main"]') || document.body
    const clone = mainEl.cloneNode(true)
    clone.querySelectorAll('nav, header.ragvyn-nav-wrapper, .ragvyn-a11y-popover, script, style, noscript').forEach(el => el.remove())

    const textToRead = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3500)
    if (!textToRead) return

    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(textToRead)
    const langAttr = (document.documentElement.getAttribute('lang') || 'en').toLowerCase()
    utterance.lang = langAttr === 'hi' ? 'hi-IN' : 'en-IN'
    utterance.rate = 0.95

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synth.speak(utterance)
    // Chrome workaround for paused speech
    setTimeout(() => {
      if (synth.paused) synth.resume()
    }, 150)
  }

  const handleStopSpeech = () => {
    if (isTtsSupported) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  // Text Scaling handlers
  const handleIncreaseText = () => {
    const idx = FONT_SCALES.indexOf(fontScale)
    if (idx < FONT_SCALES.length - 1) {
      setFontScale(FONT_SCALES[idx + 1])
    }
  }

  const handleDecreaseText = () => {
    const idx = FONT_SCALES.indexOf(fontScale)
    if (idx > 0) {
      setFontScale(FONT_SCALES[idx - 1])
    }
  }

  const handleResetText = () => {
    setFontScale('md')
  }

  const handleResetReadingLayout = () => {
    setTextSpacing(false)
    setLineHeight(false)
  }

  // Reset all accessibility settings
  const handleResetAll = () => {
    setContrast('normal')
    setFontScale('md')
    setTextSpacing(false)
    setLineHeight(false)
    setHideImages(false)
    setLargeCursor(false)
    handleStopSpeech()
  }

  if (!isOpen) return null

  const fontScaleLabel = {
    sm: t('accessibility.scaleSmall') || 'Small (85%)',
    md: t('accessibility.scaleStandard') || 'Standard (100%)',
    lg: t('accessibility.scaleLarge') || 'Large (115%)',
    xl: t('accessibility.scaleExtraLarge') || 'Extra Large (130%)',
  }[fontScale] || t('accessibility.scaleStandard') || 'Standard'

  return (
    <div
      id="ragvyn-a11y-popover"
      ref={popoverRef}
      className="ragvyn-a11y-popover"
      role="dialog"
      aria-label={t('accessibility.title') || 'Accessibility options'}
      aria-modal="false"
    >
      {/* Header */}
      <div className="ragvyn-a11y-header">
        <div className="ragvyn-a11y-title">
          <IconAccessibility size={18} />
          <span>{t('accessibility.title')}</span>
        </div>
        <button
          type="button"
          className="ragvyn-a11y-close-btn"
          onClick={handleClose}
          aria-label={t('accessibility.closeAria') || 'Close accessibility options'}
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="ragvyn-a11y-body">
        {/* 1. Contrast */}
        <section className="ragvyn-a11y-section" aria-labelledby="a11y-contrast-heading">
          <h3 id="a11y-contrast-heading" className="ragvyn-a11y-section-title">{t('accessibility.contrastHeading')}</h3>
          <div className="ragvyn-a11y-btn-group">
            <button
              type="button"
              className={`ragvyn-a11y-btn ${contrast === 'normal' ? 'active' : ''}`}
              onClick={() => setContrast('normal')}
              aria-pressed={contrast === 'normal'}
            >
              {t('accessibility.contrastNormal')}
            </button>
            <button
              type="button"
              className={`ragvyn-a11y-btn ${contrast === 'high' ? 'active' : ''}`}
              onClick={() => setContrast('high')}
              aria-pressed={contrast === 'high'}
            >
              {t('accessibility.contrastHigh')}
            </button>
          </div>
        </section>

        {/* 2. Text Size */}
        <section className="ragvyn-a11y-section" aria-labelledby="a11y-text-heading">
          <div className="ragvyn-a11y-section-header">
            <h3 id="a11y-text-heading" className="ragvyn-a11y-section-title">{t('accessibility.textSizeHeading')}</h3>
            <span className="ragvyn-a11y-current-val">{fontScaleLabel}</span>
          </div>
          <div className="ragvyn-a11y-btn-group">
            <button
              type="button"
              className="ragvyn-a11y-btn"
              onClick={handleDecreaseText}
              disabled={fontScale === 'sm'}
              aria-label={t('accessibility.decreaseText')}
            >
              {t('accessibility.decreaseText')} (A-)
            </button>
            <button
              type="button"
              className={`ragvyn-a11y-btn ${fontScale === 'md' ? 'active' : ''}`}
              onClick={handleResetText}
              aria-label={t('accessibility.resetText')}
            >
              {t('accessibility.resetText')} (A)
            </button>
            <button
              type="button"
              className="ragvyn-a11y-btn"
              onClick={handleIncreaseText}
              disabled={fontScale === 'xl'}
              aria-label={t('accessibility.increaseText')}
            >
              {t('accessibility.increaseText')} (A+)
            </button>
          </div>
        </section>

        {/* 3. Reading Layout */}
        <section className="ragvyn-a11y-section" aria-labelledby="a11y-layout-heading">
          <h3 id="a11y-layout-heading" className="ragvyn-a11y-section-title">{t('accessibility.readingHeading')}</h3>
          <div className="ragvyn-a11y-toggle-group">
            <button
              type="button"
              className={`ragvyn-a11y-toggle-btn ${textSpacing ? 'active' : ''}`}
              onClick={() => setTextSpacing(prev => !prev)}
              aria-pressed={textSpacing}
            >
              <span>{t('accessibility.textSpacing')}</span>
              <span className={`ragvyn-a11y-switch ${textSpacing ? 'on' : ''}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`ragvyn-a11y-toggle-btn ${lineHeight ? 'active' : ''}`}
              onClick={() => setLineHeight(prev => !prev)}
              aria-pressed={lineHeight}
            >
              <span>{t('accessibility.lineHeight')}</span>
              <span className={`ragvyn-a11y-switch ${lineHeight ? 'on' : ''}`} aria-hidden="true" />
            </button>
            {(textSpacing || lineHeight) && (
              <button
                type="button"
                className="ragvyn-a11y-subaction-btn"
                onClick={handleResetReadingLayout}
              >
                {t('accessibility.resetSpacing')}
              </button>
            )}
          </div>
        </section>

        {/* 4. Display & Narration */}
        <section className="ragvyn-a11y-section" aria-labelledby="a11y-display-heading">
          <h3 id="a11y-display-heading" className="ragvyn-a11y-section-title">{t('accessibility.visualAidsHeading')}</h3>
          <div className="ragvyn-a11y-toggle-group">
            <button
              type="button"
              className={`ragvyn-a11y-toggle-btn ${hideImages ? 'active' : ''}`}
              onClick={() => setHideImages(prev => !prev)}
              aria-pressed={hideImages}
            >
              <span>{t('accessibility.hideImages')}</span>
              <span className={`ragvyn-a11y-switch ${hideImages ? 'on' : ''}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`ragvyn-a11y-toggle-btn ${largeCursor ? 'active' : ''}`}
              onClick={() => setLargeCursor(prev => !prev)}
              aria-pressed={largeCursor}
            >
              <span>{t('accessibility.largeCursor')}</span>
              <span className={`ragvyn-a11y-switch ${largeCursor ? 'on' : ''}`} aria-hidden="true" />
            </button>

            {/* Read Page Aloud */}
            <div className="ragvyn-a11y-speech-card">
              {isTtsSupported ? (
                <>
                  <div className="ragvyn-a11y-speech-row">
                    <button
                      type="button"
                      className={`ragvyn-a11y-speech-btn ${isSpeaking ? 'speaking' : ''}`}
                      onClick={handleToggleReadAloud}
                      aria-pressed={isSpeaking}
                    >
                      <span>{isSpeaking ? `⏹ ${t('accessibility.ttsStop')}` : `🔊 ${t('accessibility.ttsStart')}`}</span>
                    </button>
                    {isSpeaking && (
                      <button
                        type="button"
                        className="ragvyn-a11y-mini-btn"
                        onClick={handleStopSpeech}
                        aria-label={t('accessibility.ttsStop')}
                      >
                        {t('accessibility.ttsStop')}
                      </button>
                    )}
                  </div>
                  <p className="ragvyn-a11y-caption">
                    {t('accessibility.ttsReading')}
                  </p>
                </>
              ) : (
                <div className="ragvyn-a11y-tts-unsupported" role="note">
                  <span>⚠️ {t('accessibility.ttsUnsupported')}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 5. Reset All */}
        <div className="ragvyn-a11y-footer">
          <button
            type="button"
            className="ragvyn-a11y-reset-all-btn"
            onClick={handleResetAll}
          >
            <IconRotate size={14} />
            <span>{t('accessibility.resetAll')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
