import React, { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * VerdictEngine — "Biopiracy Shield" Patentability Verdict Engine.
 *
 * The flagship differentiator: user enters a formulation / herb combination,
 * and the backend (POST /api/verdict) returns a grounded traffic-light verdict
 * (RED / YELLOW / GREEN / UNKNOWN) with statutory basis, evidence citations,
 * compliance flags, and next steps.
 *
 * Nothing is hard-coded — everything shown comes from the API response, which
 * is itself grounded in the retrieved TKDL / Patents Act corpus.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const VERDICT_THEME = {
  RED: { color: '#C0392B', bg: '#FDECEA', border: '#E74C3C', icon: '🔴', ring: 'rgba(231,76,60,0.35)' },
  YELLOW: { color: '#B7791F', bg: '#FEF7E6', border: '#F1C40F', icon: '🟡', ring: 'rgba(241,196,15,0.35)' },
  GREEN: { color: '#1E8449', bg: '#EAF7EF', border: '#27AE60', icon: '🟢', ring: 'rgba(39,174,96,0.35)' },
  UNKNOWN: { color: '#5D6D7E', bg: '#F4F6F7', border: '#AEB6BF', icon: '⚪', ring: 'rgba(174,182,191,0.35)' },
}

const EXAMPLES = [
  'Ashwagandha + Shatavari churna for immunity',
  'Turmeric-based wound healing paste',
  'A novel nano-emulsion delivery of Curcumin',
  'Neem extract as an antifungal agent',
]

export default function VerdictEngine() {
  const [formulation, setFormulation] = useState('')
  const [intendedUse, setIntendedUse] = useState('')
  const [jurisdiction, setJurisdiction] = useState('India')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const runScreening = async (e) => {
    if (e) e.preventDefault()
    const q = formulation.trim()
    if (q.length < 2) {
      setError('Please enter a formulation or herb combination to screen.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formulation: q,
          intended_use: intendedUse.trim(),
          jurisdiction,
          language: 'EN',
        }),
      })
      if (!res.ok) {
        throw new Error(`Screening failed (HTTP ${res.status}). Is the backend running?`)
      }
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err.message || 'Could not reach the screening engine. Make sure the backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  const theme = result ? (VERDICT_THEME[result.verdict] || VERDICT_THEME.UNKNOWN) : null

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← Home</Link>
          <div style={styles.badge}>🛡️ Biopiracy Shield</div>
          <h1 style={styles.title}>Patentability Verdict Engine</h1>
          <p style={styles.subtitle}>
            Enter your Ayurvedic formulation and instantly find out whether it can be patented,
            or whether it is barred as traditional knowledge (TKDL / Section 3(p)). Every verdict
            is grounded in real government legal sources.
          </p>
        </div>

        {/* Input Card */}
        <form onSubmit={runScreening} style={styles.card}>
          <label style={styles.label}>Formulation / Herb Combination *</label>
          <input
            type="text"
            value={formulation}
            onChange={(e) => setFormulation(e.target.value)}
            placeholder="e.g. Ashwagandha + Shatavari for immunity"
            style={styles.input}
          />

          <div style={styles.chipRow}>
            {EXAMPLES.map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => setFormulation(ex)}
                style={styles.chip}
              >
                {ex}
              </button>
            ))}
          </div>

          <label style={styles.label}>Intended Use / Claimed Novelty (optional)</label>
          <input
            type="text"
            value={intendedUse}
            onChange={(e) => setIntendedUse(e.target.value)}
            placeholder="e.g. classical churna, OR a new delivery method / synergistic effect"
            style={styles.input}
          />

          <label style={styles.label}>Jurisdiction</label>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            style={styles.select}
          >
            <option value="India">India</option>
            <option value="International">International</option>
            <option value="Both">Both</option>
          </select>

          <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Screening against legal sources…' : '🛡️ Screen Patentability'}
          </button>

          {error && <div style={styles.error}>{error}</div>}
        </form>

        {/* Loading skeleton */}
        {loading && (
          <div style={styles.card}>
            <div style={styles.loadingText}>
              🔍 Searching TKDL & statutory corpus → reviewing prior art → preparing verdict…
            </div>
          </div>
        )}

        {/* Verdict Result */}
        {result && !loading && (
          <div
            style={{
              ...styles.verdictCard,
              background: theme.bg,
              borderColor: theme.border,
              boxShadow: `0 0 0 4px ${theme.ring}`,
            }}
          >
            <div style={styles.verdictHead}>
              <span style={styles.verdictIcon}>{theme.icon}</span>
              <div>
                <div style={{ ...styles.verdictLabel, color: theme.color }}>
                  {result.verdict}: {result.verdict_label}
                </div>
                <div style={styles.confidence}>
                  Confidence: {result.confidence}% · Jurisdiction: {result.jurisdiction}
                </div>
              </div>
            </div>

            <p style={styles.summary}>{result.summary}</p>

            {result.law_basis?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>⚖️ Legal Basis</div>
                <ul style={styles.list}>
                  {result.law_basis.map((l, i) => <li key={i} style={styles.li}>{l}</li>)}
                </ul>
              </div>
            )}

            {result.compliance_flags?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>🌿 Compliance Flags</div>
                <ul style={styles.list}>
                  {result.compliance_flags.map((c, i) => <li key={i} style={styles.li}>{c}</li>)}
                </ul>
              </div>
            )}

            {result.next_steps?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>✅ Recommended Next Steps</div>
                <ol style={styles.list}>
                  {result.next_steps.map((s, i) => <li key={i} style={styles.li}>{s}</li>)}
                </ol>
              </div>
            )}

            {result.citations?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>📚 Evidence Sources</div>
                {result.citations.map((c, i) => (
                  <div key={i} style={styles.citation}>
                    <div style={styles.citationSource}>
                      {c.source} {c.section && c.section !== 'General' ? `· ${c.section}` : ''}
                    </div>
                    {c.text && <div style={styles.citationText}>{c.text.slice(0, 320)}{c.text.length > 320 ? '…' : ''}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Action bridges to other features */}
            <div style={styles.actionRow}>
              <Link to="/checklists" style={styles.actionBtn}>✅ Filing Checklist</Link>
              <Link to="/ip-calculator" style={styles.actionBtn}>💰 Fee Calculator</Link>
              <Link to="/chat" style={styles.actionBtn}>💬 Ask the Assistant</Link>
            </div>

            <div style={styles.disclaimer}>{result.disclaimer}</div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg-primary, #F5F7F5)', padding: '40px 16px' },
  container: { maxWidth: 780, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 28 },
  backLink: { display: 'inline-block', marginBottom: 12, color: '#1E8449', textDecoration: 'none', fontWeight: 600 },
  badge: {
    display: 'inline-block', background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff',
    padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, letterSpacing: 0.5, marginBottom: 12,
  },
  title: { fontSize: 30, fontWeight: 800, color: 'var(--text-primary,#143D30)', margin: '4px 0 10px' },
  subtitle: { fontSize: 15, color: 'var(--text-secondary,#4A5A4A)', lineHeight: 1.6, maxWidth: 620, margin: '0 auto' },
  card: {
    background: 'var(--bg-card,#fff)', borderRadius: 16, padding: 24, marginBottom: 20,
    boxShadow: '0 4px 20px rgba(20,61,48,0.08)', border: '1px solid rgba(20,61,48,0.08)',
  },
  label: { display: 'block', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary,#4A5A4A)', margin: '14px 0 6px' },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid rgba(20,61,48,0.15)',
    fontSize: 15, boxSizing: 'border-box', background: 'var(--bg-input,#fff)', color: 'var(--text-primary,#143D30)',
  },
  select: {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid rgba(20,61,48,0.15)',
    fontSize: 15, boxSizing: 'border-box', background: 'var(--bg-input,#fff)', color: 'var(--text-primary,#143D30)',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    background: 'rgba(30,132,73,0.08)', border: '1px solid rgba(30,132,73,0.25)', color: '#1E8449',
    padding: '6px 12px', borderRadius: 16, fontSize: 12.5, cursor: 'pointer', fontWeight: 600,
  },
  submitBtn: {
    width: '100%', marginTop: 20, padding: '14px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  },
  error: { marginTop: 14, color: '#C0392B', background: '#FDECEA', padding: '10px 14px', borderRadius: 8, fontSize: 14 },
  loadingText: { textAlign: 'center', color: '#1E8449', fontWeight: 600, fontSize: 15 },
  verdictCard: { borderRadius: 18, padding: 26, border: '2px solid', marginBottom: 20 },
  verdictHead: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 },
  verdictIcon: { fontSize: 40 },
  verdictLabel: { fontSize: 22, fontWeight: 800 },
  confidence: { fontSize: 13, color: '#5D6D7E', marginTop: 2, fontWeight: 600 },
  summary: { fontSize: 15.5, lineHeight: 1.65, color: '#2C3E2C', marginBottom: 6 },
  section: { marginTop: 18 },
  sectionTitle: { fontWeight: 800, fontSize: 14, color: '#143D30', marginBottom: 8 },
  list: { margin: 0, paddingLeft: 22 },
  li: { fontSize: 14.5, lineHeight: 1.6, color: '#2C3E2C', marginBottom: 5 },
  citation: { background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, border: '1px solid rgba(20,61,48,0.1)' },
  citationSource: { fontWeight: 700, fontSize: 13, color: '#143D30' },
  citationText: { fontSize: 13, color: '#4A5A4A', marginTop: 4, lineHeight: 1.5 },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  actionBtn: {
    background: '#fff', border: '2px solid #1E8449', color: '#1E8449', padding: '10px 16px',
    borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
  },
  disclaimer: { marginTop: 20, fontSize: 12, color: '#7A8A7A', fontStyle: 'italic', lineHeight: 1.5, borderTop: '1px dashed rgba(20,61,48,0.2)', paddingTop: 12 },
}
