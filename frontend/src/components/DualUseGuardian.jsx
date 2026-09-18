import React, { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * DualUseGuardian — holistic IP + regulatory compliance matrix.
 *
 * User enters their product + how it is sold; backend (POST /api/guardian)
 * returns a grounded compliance matrix across dimensions (Patent/IP, AYUSH
 * license, Biodiversity/ABS, FSSAI/food), each with obligation, law basis,
 * authority and next step. Nothing is hard-coded — everything comes from the API.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const APPLIC_THEME = {
  required: { color: '#C0392B', bg: '#FDECEA', label: 'Required' },
  likely: { color: '#B7791F', bg: '#FEF7E6', label: 'Likely' },
  conditional: { color: '#B7791F', bg: '#FEF7E6', label: 'Conditional' },
  not_applicable: { color: '#5D6D7E', bg: '#F4F6F7', label: 'Not Applicable' },
  unknown: { color: '#5D6D7E', bg: '#F4F6F7', label: 'Unclear' },
}

const DIMENSION_ICON = (name) => {
  const n = (name || '').toLowerCase()
  if (n.includes('patent') || n.includes('ip')) return '📜'
  if (n.includes('ayush') || n.includes('license') || n.includes('licence') || n.includes('drug')) return '🏭'
  if (n.includes('biodiversity') || n.includes('abs') || n.includes('nba')) return '🌿'
  if (n.includes('fssai') || n.includes('food')) return '🍽️'
  return '📋'
}

const EXAMPLES = [
  'A Tulsi-Ashwagandha immunity drink sold as food',
  'A classical churna sold as an ASU medicine',
  'A neem-based skincare cream',
]

export default function DualUseGuardian() {
  const [product, setProduct] = useState('')
  const [positioning, setPositioning] = useState('')
  const [jurisdiction, setJurisdiction] = useState('India')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const runGuardian = async (e) => {
    if (e) e.preventDefault()
    const q = product.trim()
    if (q.length < 2) {
      setError('Please describe your product to run the compliance check.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/guardian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: q, positioning: positioning.trim(), jurisdiction, language: 'EN' }),
      })
      if (!res.ok) throw new Error(`Compliance check failed (HTTP ${res.status}). Is the backend running?`)
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err.message || 'Could not reach the compliance engine. Make sure the backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← Home</Link>
          <div style={styles.badge}>🧭 Dual-Use Guardian</div>
          <h1 style={styles.title}>Dual-Use Guardian</h1>
          <p style={styles.subtitle}>
            A patent alone is not enough — an Ayurvedic product may also need an AYUSH licence,
            Biodiversity (NBA/ABS) approval, and FSSAI compliance. Enter your product and see the
            full compliance picture in one place. Every requirement is grounded in real law, not hardcoded.
          </p>
        </div>

        <form onSubmit={runGuardian} style={styles.card}>
          <label style={styles.label}>Your Product *</label>
          <input
            type="text"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. A Tulsi-Ashwagandha herbal immunity drink"
            style={styles.input}
          />
          <div style={styles.chipRow}>
            {EXAMPLES.map((ex) => (
              <button type="button" key={ex} onClick={() => setProduct(ex)} style={styles.chip}>{ex}</button>
            ))}
          </div>

          <label style={styles.label}>How is it sold / positioned? (optional)</label>
          <input
            type="text"
            value={positioning}
            onChange={(e) => setPositioning(e.target.value)}
            placeholder="e.g. as a food / nutraceutical, as an ASU medicine, exported abroad"
            style={styles.input}
          />

          <label style={styles.label}>Jurisdiction</label>
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={styles.select}>
            <option value="India">India</option>
            <option value="International">International</option>
            <option value="Both">Both</option>
          </select>

          <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Checking all compliance dimensions…' : '🧭 Run Compliance Check'}
          </button>
          {error && <div style={styles.error}>{error}</div>}
        </form>

        {loading && (
          <div style={styles.card}>
            <div style={styles.loadingText}>🔍 Searching IP + AYUSH + Biodiversity + FSSAI sources…</div>
          </div>
        )}

        {result && !loading && (
          <div style={styles.card}>
            <div style={styles.overview}>{result.summary}</div>
            <div style={styles.confidence}>Confidence: {result.confidence}% · {result.jurisdiction}</div>

            {result.priority_actions?.length > 0 && (
              <div style={styles.priorityBox}>
                <div style={styles.sectionTitle}>🚀 Do These First</div>
                <ol style={styles.list}>
                  {result.priority_actions.map((p, i) => <li key={i} style={styles.li}>{p}</li>)}
                </ol>
              </div>
            )}

            {/* Compliance matrix */}
            <div style={styles.matrix}>
              {result.dimensions?.map((d, i) => {
                const th = APPLIC_THEME[d.applicability] || APPLIC_THEME.unknown
                return (
                  <div key={i} style={{ ...styles.dimCard, background: th.bg, borderColor: th.color }}>
                    <div style={styles.dimHead}>
                      <span style={styles.dimIcon}>{DIMENSION_ICON(d.dimension)}</span>
                      <span style={styles.dimName}>{d.dimension}</span>
                      <span style={{ ...styles.applicPill, background: th.color }}>{th.label}</span>
                    </div>
                    <div style={styles.dimObligation}>{d.obligation}</div>
                    {d.law_basis?.length > 0 && (
                      <div style={styles.dimMeta}>⚖️ {d.law_basis.join(' · ')}</div>
                    )}
                    {d.authority && <div style={styles.dimMeta}>🏛️ {d.authority}</div>}
                    {d.next_step && <div style={styles.dimNext}>➡️ {d.next_step}</div>}
                  </div>
                )
              })}
            </div>

            {result.citations?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>📚 Evidence Sources</div>
                {result.citations.map((c, i) => (
                  <div key={i} style={styles.citation}>
                    <div style={styles.citationSource}>{c.source}{c.section && c.section !== 'General' ? ` · ${c.section}` : ''}</div>
                    {c.text && <div style={styles.citationText}>{c.text.slice(0, 280)}{c.text.length > 280 ? '…' : ''}</div>}
                  </div>
                ))}
              </div>
            )}

            <div style={styles.actionRow}>
              <Link to="/verdict" style={styles.actionBtn}>🛡️ Patentability Verdict</Link>
              <Link to="/roadmap" style={styles.actionBtn}>🗺️ IP Journey Roadmap</Link>
              <Link to="/checklists" style={styles.actionBtn}>✅ Filing Checklist</Link>
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
  container: { maxWidth: 860, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 28 },
  backLink: { display: 'inline-block', marginBottom: 12, color: '#1E8449', textDecoration: 'none', fontWeight: 600 },
  badge: { display: 'inline-block', background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, letterSpacing: 0.5, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: 800, color: 'var(--text-primary,#143D30)', margin: '4px 0 10px' },
  subtitle: { fontSize: 15, color: 'var(--text-secondary,#4A5A4A)', lineHeight: 1.6, maxWidth: 660, margin: '0 auto' },
  card: { background: 'var(--bg-card,#fff)', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 4px 20px rgba(20,61,48,0.08)', border: '1px solid rgba(20,61,48,0.08)' },
  label: { display: 'block', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary,#4A5A4A)', margin: '14px 0 6px' },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid rgba(20,61,48,0.15)', fontSize: 15, boxSizing: 'border-box', background: 'var(--bg-input,#fff)', color: 'var(--text-primary,#143D30)' },
  select: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid rgba(20,61,48,0.15)', fontSize: 15, boxSizing: 'border-box', background: 'var(--bg-input,#fff)', color: 'var(--text-primary,#143D30)' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { background: 'rgba(30,132,73,0.08)', border: '1px solid rgba(30,132,73,0.25)', color: '#1E8449', padding: '6px 12px', borderRadius: 16, fontSize: 12.5, cursor: 'pointer', fontWeight: 600 },
  submitBtn: { width: '100%', marginTop: 20, padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  error: { marginTop: 14, color: '#C0392B', background: '#FDECEA', padding: '10px 14px', borderRadius: 8, fontSize: 14 },
  loadingText: { textAlign: 'center', color: '#1E8449', fontWeight: 600, fontSize: 15 },
  overview: { fontSize: 15.5, lineHeight: 1.65, color: '#2C3E2C' },
  confidence: { fontSize: 13, color: '#5D6D7E', marginTop: 6, fontWeight: 600 },
  priorityBox: { background: '#EAF7EF', border: '1px solid #27AE60', borderRadius: 12, padding: '14px 18px', marginTop: 18 },
  matrix: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 20 },
  dimCard: { borderRadius: 14, border: '2px solid', padding: '16px 18px' },
  dimHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  dimIcon: { fontSize: 22 },
  dimName: { fontWeight: 800, fontSize: 15, color: '#143D30', flex: 1 },
  applicPill: { color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  dimObligation: { fontSize: 14, color: '#2C3E2C', lineHeight: 1.55 },
  dimMeta: { fontSize: 12.5, color: '#1E8449', fontWeight: 600, marginTop: 6 },
  dimNext: { fontSize: 13, color: '#143D30', fontWeight: 700, marginTop: 8, background: 'rgba(255,255,255,0.6)', padding: '6px 10px', borderRadius: 8 },
  section: { marginTop: 20 },
  sectionTitle: { fontWeight: 800, fontSize: 14, color: '#143D30', marginBottom: 8 },
  list: { margin: 0, paddingLeft: 20 },
  li: { fontSize: 14, lineHeight: 1.6, color: '#2C3E2C', marginBottom: 4 },
  citation: { background: 'rgba(30,132,73,0.05)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, border: '1px solid rgba(20,61,48,0.1)' },
  citationSource: { fontWeight: 700, fontSize: 13, color: '#143D30' },
  citationText: { fontSize: 13, color: '#4A5A4A', marginTop: 4, lineHeight: 1.5 },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  actionBtn: { background: '#fff', border: '2px solid #1E8449', color: '#1E8449', padding: '10px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13.5 },
  disclaimer: { marginTop: 20, fontSize: 12, color: '#7A8A7A', fontStyle: 'italic', lineHeight: 1.5, borderTop: '1px dashed rgba(20,61,48,0.2)', paddingTop: 12 },
}
