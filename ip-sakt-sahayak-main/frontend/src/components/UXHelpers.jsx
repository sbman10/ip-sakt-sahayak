import React, { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * UXHelpers — small, self-contained UX components to make IP-SAKTI Sahayak
 * friendly for first-time / layman users (SIH judge-facing polish).
 *
 * All are inline-styled so index.css stays untouched, and NOTHING is
 * hard-coded to a specific answer: NextActionBar derives its buttons from
 * KEYWORDS present in the actual answer text, and JargonText scans the real
 * rendered text for known terms. If nothing matches, they render nothing.
 */

// ---------------------------------------------------------------------------
// 1) NextActionBar — "Ab kya karun?" smart next-step buttons under an answer.
//    Buttons are chosen by scanning the answer text for topic keywords, then
//    de-duplicated. This is routing logic, not a canned per-question map.
// ---------------------------------------------------------------------------

const ACTION_RULES = [
  {
    // patentability / novelty / Section 3 → Verdict engine
    match: /\b(patent|patentab|section\s*3|novelt|invent|prior art|3\(p\)|3\(d\)|3\(e\))/i,
    to: '/verdict',
    icon: '🛡️',
    labelKey: 'naPatentability',
    labelDefault: 'Check patentability',
  },
  {
    match: /\b(draft|application|form[-\s]?1|petition|opposition|nba form|specification)\b/i,
    to: '/drafts',
    icon: '📝',
    labelKey: 'naDraft',
    labelDefault: 'Generate a draft',
  },
  {
    match: /\b(fee|cost|charge|₹|rupee|payment|price)\b/i,
    to: '/ip-calculator',
    icon: '💰',
    labelKey: 'naFees',
    labelDefault: 'Calculate fees',
  },
  {
    match: /\b(deadline|timeline|rfe|fer|renewal|within \d+ month|18 month|48 month|due date)\b/i,
    to: '/deadline-calculator',
    icon: '📅',
    labelKey: 'naDeadline',
    labelDefault: 'Track deadlines',
  },
  {
    match: /\b(abs|biological diversit|biodiversit|nba|nagoya|access and benefit)\b/i,
    to: '/guardian',
    icon: '🧭',
    labelKey: 'naCompliance',
    labelDefault: 'Full compliance check',
  },
  {
    match: /\b(checklist|documents required|step[-\s]?by[-\s]?step|filing process|how to file|procedure)\b/i,
    to: '/checklists',
    icon: '✅',
    labelKey: 'naChecklist',
    labelDefault: 'Open filing checklist',
  },
  {
    match: /\b(license|licence|rule 158|drugs and cosmetic|ayush manufactur|fssai)\b/i,
    to: '/guardian',
    icon: '🧭',
    labelKey: 'naCompliance',
    labelDefault: 'Full compliance check',
  },
]

export function NextActionBar({ text, t }) {
  const tr = t || ((k, d) => d)
  if (!text || typeof text !== 'string') return null

  // Derive relevant actions from the answer text; de-dup by destination.
  const seen = new Set()
  const actions = []
  for (const rule of ACTION_RULES) {
    if (rule.match.test(text) && !seen.has(rule.to)) {
      seen.add(rule.to)
      actions.push(rule)
    }
  }
  // Always offer a roadmap as a gentle default if we found at least one topic.
  if (actions.length && !seen.has('/roadmap')) {
    actions.push({ to: '/roadmap', icon: '🗺️', labelKey: 'naRoadmap', labelDefault: 'See my IP journey' })
  }
  if (actions.length === 0) return null

  return (
    <div style={styles.naWrap}>
      <span style={styles.naLabel}>{tr('nextActionLabel', 'What would you like to do next?')}</span>
      <div style={styles.naRow}>
        {actions.slice(0, 4).map((a, i) => (
          <Link key={i} to={a.to} style={styles.naBtn}>
            <span aria-hidden="true">{a.icon}</span>
            {tr(a.labelKey, a.labelDefault)}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2) JargonText — renders text and wraps known legal jargon in a hover tooltip
//    with a plain-language explanation. Scans the REAL text; unmatched text is
//    left as-is. Definitions are reference data, not answers.
// ---------------------------------------------------------------------------

const JARGON = [
  { term: 'TKDL', def: 'Traditional Knowledge Digital Library — a government record of old Ayurvedic knowledge that helps stop wrong patents on traditional formulations.' },
  { term: 'Section 3(p)', def: 'A clause of the Patents Act 1970 that bars patents on inventions that are, in effect, traditional knowledge.' },
  { term: 'Section 3(d)', def: 'Patents Act 1970 clause: a new form of a known substance is not patentable unless it shows enhanced efficacy.' },
  { term: 'Section 3(e)', def: 'Patents Act 1970 clause: a mere admixture (aggregation) of known substances is not patentable without a synergistic effect.' },
  { term: 'ABS', def: 'Access and Benefit Sharing — under the Biological Diversity Act, users of biological resources must share benefits and may need NBA approval.' },
  { term: 'NBA', def: 'National Biodiversity Authority — the body that approves access to Indian biological resources and associated knowledge.' },
  { term: 'Nagoya Protocol', def: 'An international agreement on fair and equitable sharing of benefits from the use of genetic resources.' },
  { term: 'GI', def: 'Geographical Indication — a tag for products tied to a specific place (e.g. a regional herb variety).' },
  { term: 'Rule 158-B', def: 'A Drugs & Cosmetics Rules provision governing AYUSH (Ayurveda/Siddha/Unani) manufacturing licences.' },
  { term: 'FSSAI', def: 'Food Safety and Standards Authority of India — regulator for products sold as food / nutraceuticals.' },
  { term: 'prior art', def: 'Any existing public knowledge (documents, products, texts) that can make an invention not new.' },
]

function Tip({ term, def }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      style={styles.jargon}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      {term}
      <span aria-hidden="true" style={styles.jargonMark}>ⓘ</span>
      {open && <span style={styles.jargonPop}>{def}</span>}
    </span>
  )
}

export function JargonText({ text }) {
  if (!text || typeof text !== 'string') return text || null
  // Build one regex of all terms (longest first so 'Section 3(p)' beats 'Section 3').
  const terms = [...JARGON].sort((a, b) => b.term.length - a.term.length)
  const escaped = terms.map((j) => j.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const parts = text.split(re)
  return (
    <>
      {parts.map((part, i) => {
        const hit = JARGON.find((j) => j.term === part)
        return hit ? <Tip key={i} term={hit.term} def={hit.def} /> : <React.Fragment key={i}>{part}</React.Fragment>
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// 3) HowToStart — a home-hero "Kaise shuru karun?" 3-step visual card.
// ---------------------------------------------------------------------------

export function HowToStart({ t }) {
  const steps = [
    { n: '1', icon: '💬', title: 'Ask a question', desc: 'Type or speak any IP / Ayurveda question in your language.' },
    { n: '2', icon: '📚', title: 'Get an answer with sources', desc: 'Get a plain answer backed by real government law citations.' },
    { n: '3', icon: '🛠️', title: 'Take action', desc: 'Turn it into a draft, a filing checklist, or a patentability verdict.' },
  ]
  return (
    <div style={styles.htsWrap}>
      <div style={styles.htsHeading}>🧭 New here? Here is how it works</div>
      <div style={styles.htsCard}>
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div style={styles.htsStep}>
              <div style={styles.htsNum}>{s.n}</div>
              <div style={styles.htsIcon}>{s.icon}</div>
              <div style={styles.htsTitle}>{s.title}</div>
              <div style={styles.htsDesc}>{s.desc}</div>
            </div>
            {i < steps.length - 1 && <div style={styles.htsArrow}>→</div>}
          </React.Fragment>
        ))}
      </div>
      <Link to="/chat" style={styles.htsCta}>Start now — ask your first question →</Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4) FriendlyEmptyState — replaces a blank screen with a helpful message + CTA.
// ---------------------------------------------------------------------------

export function FriendlyEmptyState({ icon = '📁', title, desc, ctaLabel, ctaTo, onCta }) {
  return (
    <div style={styles.emptyWrap}>
      <div style={styles.emptyIcon}>{icon}</div>
      <div style={styles.emptyTitle}>{title}</div>
      {desc && <div style={styles.emptyDesc}>{desc}</div>}
      {ctaLabel && (ctaTo ? (
        <Link to={ctaTo} style={styles.emptyCta}>{ctaLabel}</Link>
      ) : (
        <button style={styles.emptyCta} onClick={onCta}>{ctaLabel}</button>
      ))}
    </div>
  )
}

const styles = {
  // NextActionBar
  naWrap: { marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(20,61,48,0.18)' },
  naLabel: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #7A8A7A)', display: 'block', marginBottom: 8 },
  naRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  naBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.82rem', fontWeight: 700,
    background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff', borderRadius: 20, textDecoration: 'none',
  },
  // Jargon
  jargon: { position: 'relative', borderBottom: '1px dotted #1E8449', cursor: 'help', fontWeight: 600, color: 'inherit' },
  jargonMark: { fontSize: '0.7em', color: '#1E8449', marginLeft: 1, verticalAlign: 'super' },
  jargonPop: {
    position: 'absolute', bottom: '130%', left: 0, zIndex: 50, width: 260, background: '#143D30', color: '#fff',
    padding: '10px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 400, lineHeight: 1.5,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', whiteSpace: 'normal',
  },
  // HowToStart
  htsWrap: { margin: '0 auto', maxWidth: 760, textAlign: 'center' },
  htsHeading: { fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #143D30)', marginBottom: 12, textAlign: 'center' },
  htsCard: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 10, background: 'rgba(255,255,255,0.97)',
    borderRadius: 16, padding: '18px 16px', boxShadow: '0 12px 40px rgba(0,0,0,0.22)', border: '1px solid rgba(212,175,55,0.4)',
  },
  htsStep: { flex: '1 1 180px', minWidth: 150, textAlign: 'center', padding: '6px 8px' },
  htsNum: {
    width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff',
    fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px',
  },
  htsIcon: { fontSize: 26, marginBottom: 4 },
  htsTitle: { fontWeight: 800, fontSize: '0.95rem', color: '#143D30', marginBottom: 3 },
  htsDesc: { fontSize: '0.8rem', color: '#4A5A4A', lineHeight: 1.45 },
  htsArrow: { display: 'flex', alignItems: 'center', color: '#1E8449', fontWeight: 800, fontSize: 22 },
  htsCta: {
    display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 24, fontWeight: 700, fontSize: '0.9rem',
    background: '#D4AF37', color: '#143D30', textDecoration: 'none', boxShadow: '0 4px 14px rgba(212,175,55,0.4)',
  },
  // Empty state
  emptyWrap: { textAlign: 'center', padding: '48px 20px', maxWidth: 460, margin: '0 auto' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #143D30)', marginBottom: 8 },
  emptyDesc: { fontSize: '0.92rem', color: 'var(--text-secondary, #4A5A4A)', lineHeight: 1.6, marginBottom: 18 },
  emptyCta: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 22px', fontSize: '0.9rem', fontWeight: 700,
    background: 'linear-gradient(135deg,#143D30,#1E8449)', color: '#fff', borderRadius: 12, textDecoration: 'none',
    border: 'none', cursor: 'pointer',
  },
}
