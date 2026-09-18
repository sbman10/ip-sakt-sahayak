import React, { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * IPJourneyRoadmap — personalized, grounded IP journey timeline.
 *
 * User enters their innovation + current stage; backend (POST /api/roadmap)
 * returns a grounded timeline (prerequisites -> filing -> publication -> RFE ->
 * FER -> grant -> renewals) with per-stage statutory basis, timelines, and
 * action items. Nothing is hard-coded — everything comes from the API.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const STATUS_THEME = {
  required: { color: '#1E8449', label: 'Required' },
  conditional: { color: '#B7791F', label: 'Conditional' },
  optional: { color: '#5D6D7E', label: 'Optional' },
  info: { color: '#2874A6', label: 'Info' },
}

const EXAMPLES = [
  'A novel modified Ashwagandha formulation',
  'Turmeric-based nano wound-healing gel',
  'A new synergistic herbal immunity blend',
]

export default function IPJourneyRoadmap() {
  const [innovation, setInnovation] = useState('')
  const [stage, setStage] = useState('')
  const [jurisdiction, setJurisdiction] = useState('India')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const runRoadmap = async (e) => {
    if (e) e.preventDefault()
    const q = innovation.trim()
    if (q.length < 2) {
      setError('Please describe your innovation to build the roadmap.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ innovation: q, stage: stage.trim(), jurisdiction, language: 'EN' }),
      })
      if (!res.ok) throw new Error(`Roadmap failed (HTTP ${res.status}). Is the backend running?`)
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err.message || 'Could not reach the roadmap engine. Make sure the backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← Home</Link>
          <div style={styles.badge}>🗺️ IP Journey</div>
          <h1 style={styles.title}>IP Journey Roadmap</h1>
          <p style={styles.subtitle}>
            Enter your innovation and see your full patent journey — from filing to grant to
            renewals — with each step's timeline, legal basis, and what to do. Everything is
            grounded in real legal sources, nothing guessed.
          </p>
        </div>

        <form onSubmit={runRoadmap} style={styles.card}>
          <label style={styles.label}>Your Innovation *</label>
          <input
            type="text"
            value={innovation}
            onChange={(e) => setInnovation(e.target.value)}
            placeholder="e.g. A novel modified Ashwagandha formulation with a new delivery method"
            style={styles.input}
          />
          <div style={styles.chipRow}>
            {EXAMPLES.map((ex) => (
              <button type="button" key={ex} onClick={() => setInnovation(ex)} style={styles.chip}>{ex}</button>
            ))}
          </div>

          <label style={styles.label}>Where are you right now? (optional)</label>
          <input
            type="text"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            placeholder="e.g. just an idea / ready to file / already filed, waiting for exam"
            style={styles.input}
          />

          <label style={styles.label}>Jurisdiction</label>
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={styles.select}>
            <option value="India">India</option>
            <option value="International">International</option>
            <option value="Both">Both</option>
          </select>

          <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Building your roadmap…' : '🗺️ Build My Roadmap'}
          </button>
          {error && <div style={styles.error}>{error}</div>}
        </form>

        {loading && (
          <div style={styles.card}>
            <div style={styles.loadingText}>🔍 Searching statutory timelines → sequencing your journey…</div>
          </div>
        )}

        {result && !loading && (
          <div style={styles.card}>
            <div style={styles.overview}>{result.overview}</div>
            <div style={styles.confidence}>Confidence: {result.confidence}% · {result.jurisdiction}</div>

            {result.prerequisites?.length > 0 && (
              <div style={styles.prereqBox}>
                <div style={styles.sectionTitle}>⚠️ Before You File</div>
                <ul style={styles.list}>
                  {result.prerequisites.map((p, i) => <li key={i} style={styles.li}>{p}</li>)}
                </ul>
              </div>
            )}

            {/* Vertical timeline */}
            <div style={styles.timeline}>
              {result.stages?.map((s, i) => {
                const st = STATUS_THEME[s.status] || STATUS_THEME.info
                const isLast = i === result.stages.length - 1
                return (
                  <div key={i} style={styles.stageRow}>
                    <div style={styles.stageMarkerCol}>
                      <div style={{ ...styles.dot, background: st.color }}>{i + 1}</div>
                      {!isLast && <div style={styles.line} />}
                    </div>
                    <div style={styles.stageBody}>
                      <div style={styles.stageHead}>
                        <span style={styles.stageTitle}>{s.title}</span>
                        <span style={{ ...styles.statusPill, background: st.color }}>{st.label}</span>
                      </div>
                      {s.timeline && <div style={styles.stageTimeline}>⏱️ {s.timeline}</div>}
                      <div style={styles.stageDesc}>{s.description}</div>
                      {s.law_basis?.length > 0 && (
                        <div style={styles.stageMeta}>⚖️ {s.law_basis.join(' · ')}</div>
                      )}
                      {s.action_items?.length > 0 && (
                        <ul style={styles.actionList}>
                          {s.action_items.map((a, j) => <li key={j} style={styles.li}>{a}</li>)}
                        </ul>
                      )}
                    </div>
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
              <Link to="/guardian" style={styles.actionBtn}>🧭 Dual-Use Guardian</Link>
              <Link to="/ip-calculator" style={styles.actionBtn}>💰 Fee Calculator</Link>
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
  container: { maxWidth: 820, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 28 },
  backLink: { display: 'inline-block', marginBottom: 12, color: '#1E8449', textDecoration: 'none', fontWeight: 600 },
  badge: { display: 'inline-block', background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, letterSpacing: 0.5, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: 800, color: 'var(--text-primary,#143D30)', margin: '4px 0 10px' },
  subtitle: { fontSize: 15, color: 'var(--text-secondary,#4A5A4A)', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' },
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
  prereqBox: { background: '#FEF7E6', border: '1px solid #F1C40F', borderRadius: 12, padding: '14px 18px', marginTop: 18 },
  timeline: { marginTop: 22 },
  stageRow: { display: 'flex', gap: 16 },
  stageMarkerCol: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  dot: { width: 34, height: 34, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 },
  line: { width: 3, flex: 1, background: 'rgba(20,61,48,0.15)', margin: '4px 0' },
  stageBody: { flex: 1, paddingBottom: 24 },
  stageHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  stageTitle: { fontWeight: 800, fontSize: 16, color: '#143D30' },
  statusPill: { color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  stageTimeline: { fontSize: 13, color: '#B7791F', fontWeight: 700, marginTop: 4 },
  stageDesc: { fontSize: 14.5, color: '#2C3E2C', lineHeight: 1.6, marginTop: 6 },
  stageMeta: { fontSize: 13, color: '#1E8449', fontWeight: 600, marginTop: 6 },
  actionList: { margin: '8px 0 0', paddingLeft: 20 },
  section: { marginTop: 18 },
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
