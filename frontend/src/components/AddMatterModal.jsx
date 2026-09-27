import { useEffect, useState } from 'react'
import { IconX } from './Icons'

const CASE_TYPES = [
  { value: 'patent', label: 'Patent' },
  { value: 'trademark', label: 'Trademark' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'gi', label: 'Geographical Indication (GI)' },
]

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'filed', label: 'Filed' },
  { value: 'examination', label: 'Under Examination' },
  { value: 'granted', label: 'Granted' },
  { value: 'rejected', label: 'Rejected / Abandoned' },
]

function toDateInput(value) {
  if (!value) return ''
  try { return new Date(value).toISOString().slice(0, 10) } catch { return '' }
}

function AddMatterModalContent({ onClose, onSubmit, matter, saving, externalError }) {
  const editing = !!matter
  const [form, setForm] = useState({
    title: matter?.title || '',
    case_type: matter?.case_type || 'patent',
    application_number: matter?.application_number || '',
    filing_date: toDateInput(matter?.filing_date),
    status: matter?.status || 'draft',
    notes: matter?.notes || '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Patent / Matter title is required.'); return }
    setError('')
    const payload = {
      title: form.title.trim(),
      case_type: form.case_type,
      application_number: form.application_number.trim() || null,
      filing_date: form.filing_date ? new Date(form.filing_date).toISOString() : null,
      status: form.status,
      notes: form.notes.trim() || null,
    }
    setSubmitting(true)
    try {
      await onSubmit?.(payload)
    } catch (err) {
      setError(err?.message || 'Failed to save matter. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1050, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--mw-card-bg, #ffffff)',
          border: '1px solid var(--mw-card-border, #e2e8f0)',
          borderRadius: 16, padding: '24px 28px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
          color: 'var(--mw-text-main, #0f172a)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--mw-text-main, #0f172a)' }}>
              {editing ? 'Edit Patent Matter' : 'New Patent Matter'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--mw-text-muted, #667085)' }}>
              {editing ? 'Update application metadata, status and details.' : 'Create a new patent or IP case to track filings and statutory deadlines.'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={closeBtn} title="Close"><IconX size={18} /></button>
        </div>

        <label style={lbl}>Patent / Matter Title *</label>
        <input
          value={form.title}
          onChange={set('title')}
          placeholder="e.g. Optimized Curcumin Extract Nanoparticles"
          style={inp}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>IP Category *</label>
            <select value={form.case_type} onChange={set('case_type')} style={inp}>
              {CASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Current Status</label>
            <select value={form.status} onChange={set('status')} style={inp}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Application Number</label>
            <input
              value={form.application_number}
              onChange={set('application_number')}
              placeholder="e.g. IN202441012345"
              style={{ ...inp, fontFamily: 'var(--font-mono, monospace)' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Filing Date</label>
            <input type="date" value={form.filing_date} onChange={set('filing_date')} style={inp} />
          </div>
        </div>

        <label style={lbl}>Strategy & Case Notes</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          placeholder="Prior art references, attorney assignment, Section 3(p) TKDL notes, clinical data status..."
          style={{ ...inp, resize: 'vertical' }}
        />

        {(error || externalError) && (
          <div style={{
            color: '#dc2626',
            background: '#fee2e2',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 12,
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>⚠️</span>
            <span>{error || externalError}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
          <button type="submit" disabled={saving || submitting} style={primaryBtn}>
            {(saving || submitting) ? 'Saving…' : editing ? 'Save Changes' : 'Create Matter'}
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * Modal to create or edit a matter in the patent workspace.
 * Props:
 *   isOpen, onClose, onSubmit(payload), matter (optional, edit mode), saving, error
 */
export default function AddMatterModal({ isOpen, onClose, onSubmit, matter = null, saving = false, error = '' }) {
  if (!isOpen) return null
  return (
    <AddMatterModalContent
      onClose={onClose}
      onSubmit={onSubmit}
      matter={matter}
      saving={saving}
      externalError={error}
    />
  )
}

const lbl = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--mw-text-main, #111827)',
  margin: '14px 0 5px',
}

const inp = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 14px',
  borderRadius: 10,
  background: 'var(--mw-card-bg, #ffffff)',
  border: '1px solid var(--mw-card-border, #E4E0D8)',
  color: 'var(--mw-text-main, #111827)',
  fontSize: 13.5,
  outline: 'none',
  transition: 'all 0.15s ease',
}

const closeBtn = {
  background: 'transparent',
  border: 'none',
  color: 'var(--mw-text-muted, #667085)',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const ghostBtn = {
  padding: '9px 18px',
  borderRadius: 10,
  border: '1px solid var(--mw-card-border, #E4E0D8)',
  background: 'transparent',
  color: 'var(--mw-text-body, #4B5563)',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
}

const primaryBtn = {
  padding: '9px 22px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--mw-purple, #6D35E8)',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: 13,
  boxShadow: '0 4px 14px rgba(109, 53, 232, 0.28)',
}
