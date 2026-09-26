import React from 'react'
import { Link } from 'react-router-dom'
import {
  IconCheck,
  IconArrowRight,
  IconInfo,
  IconShieldCheck,
  IconChevronDown,
} from './Icons'
import './ToolIntro.css'

/**
 * Reusable ToolIntro Component
 * 
 * Provides an authoritative, crystal-clear 10-15 second overview
 * of any IP/regulatory tool before entering its working interface.
 * 
 * Conforms strictly to the IP-SAKTI Sahayak institutional design system:
 * - Zero emojis
 * - Clean SVG iconography
 * - Restrained typography and card elevations
 * - Fully responsive and accessible
 */
export default function ToolIntro({
  config = {},
  icon = null,
  onStart,
  onBack,
  backTo = '/',
  backLabel = 'Back to Portal',
}) {
  const {
    toolName = 'IP Utility Tool',
    chipLabel = 'Statutory Module',
    purpose = '',
    whatItDoes = '',
    whyUseful = '',
    steps = [],
    outputs = [],
    disclaimer = 'Information for guidance only — not legal advice.',
    ctaText = 'Start Using Tool',
    estimatedTime = '~1-2 mins',
  } = config

  return (
    <div className="tool-intro-wrapper" role="region" aria-label={`${toolName} Overview`}>
      {/* Top back navigation */}
      <div className="tool-intro-nav">
        {onBack ? (
          <button
            type="button"
            className="tool-intro-back-btn"
            onClick={onBack}
            aria-label={backLabel}
          >
            <span className="tool-intro-back-arrow" aria-hidden="true">←</span>
            <span>{backLabel}</span>
          </button>
        ) : (
          <Link to={backTo} className="tool-intro-back-btn" aria-label={backLabel}>
            <span className="tool-intro-back-arrow" aria-hidden="true">←</span>
            <span>{backLabel}</span>
          </Link>
        )}

        {estimatedTime && (
          <span className="tool-intro-time-badge">
            <span className="tool-intro-time-dot" aria-hidden="true" />
            <span>Estimated: {estimatedTime}</span>
          </span>
        )}
      </div>

      {/* Hero Header Card */}
      <div className="tool-intro-hero">
        <div className="tool-intro-header-row">
          {icon && (
            <div className="tool-intro-icon-box" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="tool-intro-header-meta">
            {chipLabel && (
              <span className="tool-intro-chip">
                <IconShieldCheck size={13} />
                <span>{chipLabel}</span>
              </span>
            )}
            <h1 className="tool-intro-title">{toolName}</h1>
          </div>
        </div>

        {purpose && (
          <p className="tool-intro-purpose">{purpose}</p>
        )}
      </div>

      {/* Two-Card Overview: What it Does & Why it Matters */}
      <div className="tool-intro-details-grid">
        <div className="tool-intro-detail-card">
          <div className="tool-intro-card-header">
            <span className="tool-intro-card-icon" aria-hidden="true">
              <IconInfo size={16} />
            </span>
            <h2 className="tool-intro-card-title">What does this tool do?</h2>
          </div>
          <p className="tool-intro-card-body">{whatItDoes}</p>
        </div>

        <div className="tool-intro-detail-card">
          <div className="tool-intro-card-header">
            <span className="tool-intro-card-icon" aria-hidden="true">
              <IconShieldCheck size={16} />
            </span>
            <h2 className="tool-intro-card-title">Why it matters</h2>
          </div>
          <p className="tool-intro-card-body">{whyUseful}</p>
        </div>
      </div>

      {/* How It Works - 3-Step Visual Progression */}
      {steps && steps.length > 0 && (
        <div className="tool-intro-workflow-section">
          <div className="tool-intro-section-header">
            <span className="tool-intro-section-label">WORKFLOW</span>
            <h2 className="tool-intro-section-title">How It Works</h2>
          </div>

          <div className="tool-intro-steps-container">
            {steps.map((step, idx) => (
              <div key={idx} className="tool-intro-step-item">
                <div className="tool-intro-step-marker">
                  <span className="tool-intro-step-num">{step.stepNumber || idx + 1}</span>
                  {idx < steps.length - 1 && (
                    <span className="tool-intro-step-connector" aria-hidden="true" />
                  )}
                </div>
                <div className="tool-intro-step-content">
                  <h3 className="tool-intro-step-heading">{step.title}</h3>
                  <p className="tool-intro-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What You Get - Output Deliverables */}
      {outputs && outputs.length > 0 && (
        <div className="tool-intro-outputs-section">
          <div className="tool-intro-section-header">
            <span className="tool-intro-section-label">DELIVERABLES</span>
            <h2 className="tool-intro-section-title">What You'll Get</h2>
          </div>

          <div className="tool-intro-outputs-grid">
            {outputs.map((out, idx) => (
              <div key={idx} className="tool-intro-output-item">
                <span className="tool-intro-output-check" aria-hidden="true">
                  <IconCheck size={15} />
                </span>
                <span className="tool-intro-output-text">{out}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="tool-intro-footer">
        <button
          type="button"
          className="tool-intro-cta-btn"
          onClick={onStart}
          aria-label={ctaText}
        >
          <span>{ctaText}</span>
          <IconArrowRight size={18} className="tool-intro-cta-arrow" />
        </button>

        {disclaimer && (
          <p className="tool-intro-disclaimer">
            <span className="tool-intro-disclaimer-dot" aria-hidden="true" />
            <span>{disclaimer}</span>
          </p>
        )}
      </div>
    </div>
  )
}
