import { useMemo, useState } from 'react'
import {
  IconFileText,
  IconSparkles,
  IconCopy,
  IconCheck,
  IconScroll,
  IconScales,
  IconLeaf,
  IconAlertTriangle,
} from './Icons'
import { getApiBase } from '../api/config'

/* ------------------------------------------------------------------
   DraftGenerator
   ------------------------------------------------------------------
   Self-contained page component for the Draft Generation feature.
   Calls POST /api/drafts/generate and renders the returned document
   with copy-to-clipboard and .txt download.

   Kept as a standalone file (no import from App.jsx) to avoid a
   circular dependency and to keep the large App.jsx monolith untouched.
   The parent passes the shared page chrome (Navbar/header) around it.
   ------------------------------------------------------------------ */

const API_BASE = getApiBase()

// Template catalogue — drives the dropdown and the dynamic field set.
const TEMPLATES = [
  {
    id: 'form_1',
    label: 'Patent Application — Form 1',
    reference: 'Patents Rules, 2003 — Form 1',
    icon: IconScroll,
    showClaims: true,
    showRespondent: false,
    descriptionLabel: 'Field / summary of the invention',
    descriptionHint:
      'Describe the invention, its technical field, and what makes it novel.',
  },
  {
    id: 'nba',
    label: 'National Biodiversity Authority (NBA) Application',
    reference: 'Biological Diversity Act, 2002 — Section 6, Form III',
    icon: IconLeaf,
    showClaims: false,
    showRespondent: false,
    descriptionLabel: 'Biological resource & associated traditional knowledge',
    descriptionHint:
      'Describe the biological resource(s) used, their source, and the research purpose.',
  },
  {
    id: '3p_petition',
    label: 'Pre-Grant Opposition Petition — Section 3(p)',
    reference: 'Patents Act, 1970 — Section 25(1) & 3(p)',
    icon: IconScales,
    showClaims: false,
    showRespondent: true,
    descriptionLabel: 'Statement of the case (grounds of opposition)',
    descriptionHint:
      'Set out the prior art / traditional knowledge relied on to oppose the grant.',
  },
]

// Glassmorphism style tokens mirroring the existing calculator pages.
const cardStyle = {
  background: 'var(--glass-bg, rgba(255,255,255,0.06))',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
  borderRadius: '18px',
  padding: '1.6rem',
  boxShadow: '0 10px 40px -12px rgba(0,0,0,0.35)',
}

const inputStyle = {
  width: '100%',
  padding: '0.7rem 0.9rem',
  borderRadius: '12px',
  border: '1px solid var(--glass-border, rgba(255,255,255,0.18))',
  background: 'var(--input-bg, rgba(255,255,255,0.08))',
  color: 'var(--text-primary, inherit)',
  fontSize: '0.95rem',
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.4rem',
}

const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '0.8rem 1.4rem',
  borderRadius: '12px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 600,
  background: 'var(--color-primary, #143D30)',
  color: '#fff',
}

const btnGhost = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '0.55rem 0.95rem',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
  background: 'var(--glass-bg, rgba(255,255,255,0.08))',
  border: '1px solid var(--glass-border, rgba(255,255,255,0.18))',
  color: 'var(--text-primary, inherit)',
}

function IconDownload({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export default function DraftGenerator() {
  const [templateType, setTemplateType] = useState('form_1')
  const [applicantName, setApplicantName] = useState('')
  const [applicantAddress, setApplicantAddress] = useState('')
  const [inventionTitle, setInventionTitle] = useState('')
  const [filingDate, setFilingDate] = useState('')
  const [description, setDescription] = useState('')
  const [claimsText, setClaimsText] = useState('')
  const [respondentName, setRespondentName] = useState('')
  const [applicationNumber, setApplicationNumber] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const activeTemplate = useMemo(
    () => TEMPLATES.find((tpl) => tpl.id === templateType) || TEMPLATES[0],
    [templateType],
  )

  const canSubmit =
    applicantName.trim().length >= 2 &&
    inventionTitle.trim().length >= 3 &&
    filingDate.trim().length > 0 &&
    description.trim().length >= 10 &&
    !loading

  const handleGenerate = async () => {
    setError('')
    setResult(null)
    setCopied(false)

    if (!canSubmit) {
      setError('Please fill applicant name, title, filing date and a description (min 10 chars).')
      return
    }

    // Build claims array from newline-separated textarea, only for patents.
    const claims =
      activeTemplate.showClaims && claimsText.trim()
        ? claimsText
            .split('\n')
            .map((c) => c.trim())
            .filter(Boolean)
        : null

    const payload = {
      template_type: templateType,
      applicant_name: applicantName.trim(),
      invention_title: inventionTitle.trim(),
      filing_date: filingDate.trim(),
      description: description.trim(),
      claims,
      applicant_address: applicantAddress.trim() || null,
      respondent_name: activeTemplate.showRespondent ? respondentName.trim() || null : null,
      application_number: activeTemplate.showRespondent
        ? applicationNumber.trim() || null
        : null,
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('ip_sakti_access_token')
      const response = await fetch(`${API_BASE}/api/drafts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let detail = `Request failed (HTTP ${response.status}).`
        try {
          const errBody = await response.json()
          if (errBody && errBody.detail) {
            detail =
              typeof errBody.detail === 'string'
                ? errBody.detail
                : JSON.stringify(errBody.detail)
          }
        } catch {
          /* non-JSON error body — keep the generic message */
        }
        throw new Error(detail)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed to generate the draft. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.plain_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard. Please select and copy manually.')
    }
  }

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob([result.plain_text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeTitle = (result.document_title || 'draft')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
    a.href = url
    a.download = `${safeTitle || 'draft'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setResult(null)
    setError('')
    setCopied(false)
  }

  const ActiveIcon = activeTemplate.icon

  return (
    <main
      className="draft-generator"
      style={{ display: 'grid', gap: '1.5rem', maxWidth: '960px', margin: '0 auto', width: '100%' }}
    >
      {/* ---- Input card ---- */}
      <section style={cardStyle} aria-label="Draft input form">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
          <span
            style={{
              display: 'inline-flex',
              padding: '10px',
              borderRadius: '12px',
              background: 'var(--color-primary-light, rgba(20,61,48,0.12))',
              color: 'var(--color-primary, #143D30)',
            }}
          >
            <IconFileText size={22} />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Draft Generator</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #9aa0a6)' }}>
              Auto-generate a structured IP legal-document draft.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.1rem' }}>
          {/* Template type */}
          <div>
            <label htmlFor="dg-template" style={labelStyle}>
              Document type
            </label>
            <select
              id="dg-template"
              value={templateType}
              onChange={(e) => {
                setTemplateType(e.target.value)
                setResult(null)
                setError('')
              }}
              style={inputStyle}
              aria-label="Document type"
            >
              {TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary, #9aa0a6)',
                margin: '0.4rem 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ActiveIcon size={14} /> {activeTemplate.reference}
            </p>
          </div>

          {/* Applicant name + filing date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.1rem' }}>
            <div>
              <label htmlFor="dg-applicant" style={labelStyle}>
                {templateType === '3p_petition' ? 'Opponent name' : 'Applicant name'} *
              </label>
              <input
                id="dg-applicant"
                type="text"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="e.g. Dr. Anjali Sharma"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="dg-date" style={labelStyle}>
                {templateType === '3p_petition' ? 'Date of representation' : 'Filing date'} *
              </label>
              <input
                id="dg-date"
                type="date"
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Applicant address */}
          <div>
            <label htmlFor="dg-address" style={labelStyle}>
              {templateType === '3p_petition' ? 'Address for service in India' : 'Applicant address'}
            </label>
            <input
              id="dg-address"
              type="text"
              value={applicantAddress}
              onChange={(e) => setApplicantAddress(e.target.value)}
              placeholder="Postal address (optional)"
              style={inputStyle}
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="dg-title" style={labelStyle}>
              {templateType === '3p_petition' ? 'Title of the impugned application' : 'Invention / subject title'} *
            </label>
            <input
              id="dg-title"
              type="text"
              value={inventionTitle}
              onChange={(e) => setInventionTitle(e.target.value)}
              placeholder="e.g. A synergistic Ashwagandha nano-formulation"
              style={inputStyle}
            />
          </div>

          {/* Respondent + application number (petition only) */}
          {activeTemplate.showRespondent && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.1rem' }}>
              <div>
                <label htmlFor="dg-respondent" style={labelStyle}>
                  Respondent (patent applicant)
                </label>
                <input
                  id="dg-respondent"
                  type="text"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  placeholder="Name of the applicant being opposed"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="dg-appno" style={labelStyle}>
                  Patent application number
                </label>
                <input
                  id="dg-appno"
                  type="text"
                  value={applicationNumber}
                  onChange={(e) => setApplicationNumber(e.target.value)}
                  placeholder="e.g. 202611012345"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="dg-description" style={labelStyle}>
              {activeTemplate.descriptionLabel} *
            </label>
            <textarea
              id="dg-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={activeTemplate.descriptionHint}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '110px' }}
            />
          </div>

          {/* Claims (patent only) */}
          {activeTemplate.showClaims && (
            <div>
              <label htmlFor="dg-claims" style={labelStyle}>
                Claims (one per line)
              </label>
              <textarea
                id="dg-claims"
                value={claimsText}
                onChange={(e) => setClaimsText(e.target.value)}
                placeholder={
                  'A herbal composition comprising a standardised Withania somnifera extract...\n' +
                  'The composition of claim 1, wherein the mean particle size is below 200 nm.'
                }
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '90px' }}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #9aa0a6)', margin: '0.4rem 0 0' }}>
                Each line becomes a numbered claim. Leave blank to insert a placeholder claim.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '0.75rem 0.9rem',
                borderRadius: '10px',
                background: 'rgba(220,38,38,0.12)',
                color: '#dc2626',
                fontSize: '0.85rem',
              }}
            >
              <IconAlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canSubmit}
              style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.55, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            >
              <IconSparkles size={16} />
              {loading ? 'Generating…' : 'Generate draft'}
            </button>
            {result && (
              <button type="button" onClick={handleReset} style={btnGhost}>
                Clear result
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ---- Output card ---- */}
      {result && (
        <section style={cardStyle} aria-label="Generated draft">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{result.document_title}</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #9aa0a6)' }}>
                {result.form_reference}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={handleCopy} style={btnGhost}>
                {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={handleDownload} style={btnGhost}>
                <IconDownload size={15} /> Download .txt
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1.1rem' }}>
            {result.sections.map((sec, idx) => (
              <div key={idx}>
                <h3
                  style={{
                    margin: '0 0 0.35rem',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--color-primary, #143D30)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {sec.heading}
                </h3>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'inherit',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    color: 'var(--text-primary, inherit)',
                  }}
                >
                  {sec.body}
                </pre>
              </div>
            ))}
          </div>

          {result.disclaimer && (
            <p
              style={{
                marginTop: '1.3rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
                fontSize: '0.78rem',
                fontStyle: 'italic',
                color: 'var(--text-secondary, #9aa0a6)',
              }}
            >
              {result.disclaimer}
            </p>
          )}
        </section>
      )}
    </main>
  )
}
