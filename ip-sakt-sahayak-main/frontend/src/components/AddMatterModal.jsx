import React, { useEffect, useState } from 'react'

const CASE_TYPES = [
  { value: 'patent', label: '⚙️ Patent' },
  { value: 'trademark', label: '™️ Trademark' },
  { value: 'copyright', label: '©️ Copyright' },
  { value: 'gi', label: '🌿 GI (Geographical Indication)' },
]

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'filed', label: 'Filed' },
  { value: 'examination', label: 'Examination' },
  { value: 'granted', label: 'Granted' },
  { value: 'rejected', label: 'Rejected' },
]

function toDateInput(value) {
  if (!value) return ''
  try { return new Date(value).toISOString().slice(0, 10) } catch { return '' }
}

/**
 * Modal to create or edit a matter.
 * Props:
 *   isOpen, onClose, onSubmit(payload), matter (optional, edit mode), saving
 */
export default function AddMatterModal({ isOpen, onClose, onSubmit, matter = null, saving = false }) {
  const editing = !!matter
  const [form, setForm] = useState({
    title: '', case_type: 'patent', application_number: '',
    filing_date: '', status: 'draft', notes: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setError('')
      setForm({
        title: matter?.title || '',
        case_type: matter?.case_type || 'patent',
        application_number: matter?.application_number || '',
        filing_date: toDateInput(matter?.filing_date),
        status: matter?.status || 'draft',
        notes: matter?.notes || '',
      })
    }
  }, [isOpen, matter])

  if (!isOpen) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required.'); return }
    const payload = {
      title: form.title.trim(),
      case_type: form.case_type,
      application_number: form.application_number.trim() || null,
      filing_date: form.filing_date ? new Date(form.filing_date).toISOString() : null,
      status: form.status,
      notes: form.notes.trim() || null,
    }
    onSubmit?.(payload)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(2,6,23,0.6)', backdropFilter: 'blur(6px)',
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.14)', borderRadius: 20,
          padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,0.5)', color: '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
            {editing ? 'Edit Matter' : 'New Matter'}
          </h3>
          <button type="button" onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <label style={lbl}>Title *</label>
        <input value={form.title} onChange={set('title')} placeholder="e.g. Ashwagandha Extract Process" style={inp} autoFocus />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Case Type *</label>
            <select value={form.case_type} onChange={set('case_type')} style={inp}>
              {CASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Status</label>
            <select value={form.status} onChange={set('status')} style={inp}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Application Number</label>
            <input value={form.application_number} onChange={set('application_number')} placeholder="Optional" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Filing Date</label>
            <input type="date" value={form.filing_date} onChange={set('filing_date')} style={inp} />
          </div>
        </div>

        <label style={lbl}>Notes</label>
        <textarea value={form.notes} onChange={set('notes')} rows={4} placeholder="Case notes, strategy, references…" style={{ ...inp, resize: 'vertical' }} />

        {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
          <button type="submit" disabled={saving} style={primaryBtn}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Matter'}
          </button>
        </div>
      </form>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, opacity: 0.8, margin: '12px 0 5px' }
const inp = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
  color: '#e2e8f0', fontSize: 14, outline: 'none',
}
const closeBtn = { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }
const ghostBtn = {
  padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)',
  background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600, fontSize: 14,
}
const primaryBtn = {
  padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
  fontWeight: 700, fontSize: 14,
}
