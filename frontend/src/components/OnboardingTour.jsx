import { useState, useEffect, useRef, useCallback } from 'react'
import { IconArrowRight, IconX, IconCheck } from './Icons'
import { useLanguage } from '../locales'

export const TOUR_STORAGE_KEY = 'ragvyn_tour_v1'

const TOUR_STEPS = [
  {
    targetId: 'tour-nav-brand',
    titleKey: 'tour.brandTitle',
    descKey: 'tour.brandDesc',
    title: 'RAGVYN Intelligence',
    description: 'Your verified portal for Ayurvedic Intellectual Property, patentability, TKDL prior art, and Biological Diversity compliance. Click anytime to return home.',
    placement: 'bottom',
  },
  {
    targetId: 'tour-services-menu',
    titleKey: 'tour.servicesTitle',
    descKey: 'tour.servicesDesc',
    title: 'Services & Specialized Tools',
    description: 'Access the Formulation Wizard, ABS Compliance Checker, IP Cost Calculator, and Statutory Deadline Tracker from this menu.',
    placement: 'bottom',
  },
  {
    targetId: 'tour-use-cases',
    titleKey: 'tour.useCasesTitle',
    descKey: 'tour.useCasesDesc',
    title: 'Practical Use Cases',
    description: 'Explore real-world scenarios showing how researchers, startups, and Ayurvedic practitioners navigate IP laws with RAGVYN.',
    placement: 'bottom',
  },
  {
    targetId: 'tour-lang-selector',
    titleKey: 'tour.langTitle',
    descKey: 'tour.langDesc',
    title: 'Multilingual Language Selector',
    description: 'Seamlessly switch interface languages between English, Hindi, and Marathi, with official legal and statutory terminology preserved.',
    placement: 'bottom',
  },
  {
    targetId: 'tour-theme-toggle',
    titleKey: 'tour.themeTitle',
    descKey: 'tour.themeDesc',
    title: 'Light / Dark Theme Toggle',
    description: 'Toggle between clean daytime reading and an institutional, low-glare forest-charcoal dark theme.',
    placement: 'bottom',
  },
  {
    targetId: 'tour-a11y-btn',
    titleKey: 'tour.a11yTitle',
    descKey: 'tour.a11yDesc',
    title: 'Accessibility Menu',
    description: 'Customize high contrast, text size scaling, expanded reading layout, large cursor, or page text-to-speech narration.',
    placement: 'bottom',
  },
  {
    targetId: 'hero-start-btn',
    titleKey: 'tour.startBtnTitle',
    descKey: 'tour.startBtnDesc',
    title: 'Start a New Task CTA',
    description: 'Launch RAGVYN AI to enter your formulation, ask IP questions, and receive grounded statutory citations.',
    placement: 'top',
  },
  {
    targetId: 'hero-demo-btn',
    titleKey: 'tour.demoBtnTitle',
    descKey: 'tour.demoBtnDesc',
    title: 'Watch Interactive Demo',
    description: 'Preview an interactive walkthrough of TKDL prior art retrieval, section 3(p) analysis, and source verification in action.',
    placement: 'top',
  },
]

export default function OnboardingTour({ run, onClose }) {
  const { t } = useLanguage()
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const dialogRef = useRef(null)
  const nextBtnRef = useRef(null)

  const activeStep = TOUR_STEPS[currentStep]
  const totalSteps = TOUR_STEPS.length

  // Finish or skip tour
  const handleExit = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'completed')
    if (onClose) onClose()
    // Return focus to the tour trigger button in the navbar
    setTimeout(() => {
      const trigger = document.getElementById('tour-nav-btn')
      if (trigger) trigger.focus()
    }, 50)
  }, [onClose])

  // Move to next step
  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleExit()
    }
  }, [currentStep, totalSteps, handleExit])

  // Move to previous step
  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  // Update target element coordinates and scroll into view
  const updatePosition = useCallback(() => {
    if (!run || !activeStep) return
    const el = document.getElementById(activeStep.targetId)

    if (!el) {
      // If target element is not on page, fall back to center of viewport
      setTargetRect(null)
      setPopoverPos({
        top: Math.max(80, window.innerHeight / 2 - 120),
        left: Math.max(16, window.innerWidth / 2 - 170),
      })
      return
    }

    // Scroll element smoothly into view if offscreen
    const initialRect = el.getBoundingClientRect()
    if (initialRect.top < 70 || initialRect.bottom > window.innerHeight - 70) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // Measure bounding box
    const rect = el.getBoundingClientRect()
    setTargetRect(rect)

    // Calculate popover coordinates with boundary safety clamping
    const popoverWidth = Math.min(340, window.innerWidth - 32)
    const popoverHeight = 180
    const margin = 12
    const left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, rect.left + rect.width / 2 - popoverWidth / 2))
    let top

    if (activeStep.placement === 'top') {
      top = rect.top - popoverHeight - margin
      if (top < 80) {
        // Flip below if not enough room on top
        top = rect.bottom + margin
      }
    } else {
      // Bottom placement
      top = rect.bottom + margin
      if (top + popoverHeight > window.innerHeight - 20) {
        // Flip above if not enough room below
        top = Math.max(80, rect.top - popoverHeight - margin)
      }
    }

    setPopoverPos({ top, left })
  }, [run, activeStep])

  // Recalculate on step change, resize, and scroll
  useEffect(() => {
    if (!run) return
    const frameId = requestAnimationFrame(() => {
      updatePosition()
    })

    const onResize = () => updatePosition()
    const onScroll = () => updatePosition()

    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [run, updatePosition])

  // Focus trap / focus next button on step change
  useEffect(() => {
    if (!run) return
    const timer = setTimeout(() => {
      if (nextBtnRef.current) {
        nextBtnRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [run, currentStep])

  // Keyboard navigation
  useEffect(() => {
    if (!run) return

    const handleKeyDown = (e) => {
      // Guard: Do not capture arrow keys while user is in an input field
      const activeTag = document.activeElement ? document.activeElement.tagName : ''
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || (document.activeElement && document.activeElement.isContentEditable)

      if (e.key === 'Escape') {
        e.preventDefault()
        handleExit()
      } else if (!isInput && e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (!isInput && e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [run, handleNext, handlePrev, handleExit])

  if (!run) return null

  const isLastStep = currentStep === totalSteps - 1

  return (
    <div className="ragvyn-tour-root" aria-live="polite">
      {/* Dimmed backdrop with spotlight cutout around target */}
      {targetRect && (
        <div
          className="ragvyn-tour-spotlight"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
          aria-hidden="true"
        />
      )}
      <div className="ragvyn-tour-scrim" onClick={handleExit} aria-hidden="true" />

      {/* Tour Dialog Popover */}
      <div
        ref={dialogRef}
        className="ragvyn-tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-dialog-title"
        aria-describedby="tour-dialog-desc"
        style={{
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
        }}
      >
        <div className="ragvyn-tour-card-header">
          <span className="ragvyn-tour-step-badge">
            {t('tour.step') || 'Step'} {currentStep + 1} {t('tour.of') || 'of'} {totalSteps}
          </span>
          <button
            type="button"
            className="ragvyn-tour-skip-btn"
            onClick={handleExit}
            aria-label={t('tour.skip') || 'Skip tour'}
            title={t('tour.skip') || 'Skip tour'}
          >
            <IconX size={15} />
          </button>
        </div>

        <div className="ragvyn-tour-card-body">
          <h2 id="tour-dialog-title" className="ragvyn-tour-title">
            {t(activeStep.titleKey) || activeStep.title}
          </h2>
          <p id="tour-dialog-desc" className="ragvyn-tour-desc">
            {t(activeStep.descKey) || activeStep.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="ragvyn-tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`ragvyn-tour-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
            />
          ))}
        </div>

        <div className="ragvyn-tour-card-footer">
          <button
            type="button"
            className="ragvyn-tour-btn ragvyn-tour-btn-prev"
            onClick={handlePrev}
            disabled={currentStep === 0}
            aria-label={t('tour.back') || 'Previous step'}
          >
            {t('tour.back') || 'Previous'}
          </button>

          <button
            ref={nextBtnRef}
            type="button"
            className="ragvyn-tour-btn ragvyn-tour-btn-next"
            onClick={handleNext}
            aria-label={isLastStep ? (t('tour.finish') || 'Finish product tour') : (t('tour.next') || 'Next step')}
          >
            <span>{isLastStep ? (t('tour.finish') || 'Get Started') : (t('tour.next') || 'Next')}</span>
            {isLastStep ? <IconCheck size={14} /> : <IconArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
