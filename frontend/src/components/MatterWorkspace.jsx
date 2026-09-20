import React, { useCallback, useEffect, useMemo, useState } from 'react'
import MatterCard from './MatterCard'
import MatterTimeline from './MatterTimeline'
import AddMatterModal from './AddMatterModal'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'ip_sakti_access_token'

const STATUS_COLUMNS = [
  { key: 'draft', label: 'Draft', color: '#94a3b8' },
  { key: 'filed', label: 'Filed', color: '#0ea5e9' },
  { key: 'examination', label: 'Examination', color: '#f59e0b' },
  { key: 'granted', label: 'Granted', color: '#10b981' },
  { key: 'rejected', label: 'Rejected', color: '#ef4444' },
]

const CASE_TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'patent', label: 'Patent' },
  { value: 'trademark', label: 'Trademark' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'gi', label: 'GI' },
]

const EVENT_TYPES = ['filing', 'office_action', 'response', 'deadline', 'grant', 'note']

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, { headers: authHeaders(), ...options })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try { const j = await res.json(); detail = j.detail || detail } catch { /* noop */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  if (res.status === 204) return null
  return res.json()
}

export default function MatterWorkspace() {
  const [matters, setMatters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [caseTypeFilter, setCaseTypeFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMatter, setEditingMatter] = useState(null)
  const [saving, setSaving] = useState(false)

  const [selected, setSelected] = useState(null) // detail matter (with events)
  const [detailLoading, setDetailLoading] = useState(false)

  const [upcoming, setUpcoming] = useState([])

  // ---- data loading -------------------------------------------------------
  const loadMatters = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: '1', page_size: '100' })
      if (caseTypeFilter) params.set('case_type', caseTypeFilter)
      if (search.trim()) params.set('q', search.trim())
      const data = await api(`/matters?${params.toString()}`)
      setMatters(data.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [caseTypeFilter, search])

  const loadUpcoming = useCallback(async () => {
    try {
      const data = await api('/matters/upcoming?days=30')
      setUpcoming(data || [])
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    const t = setTimeout(loadMatters, 250) // debounce search
    return () => clearTimeout(t)
  }, [loadMatters])

  useEffect(() => { loadUpcoming() }, [loadUpcoming])

  // ---- mutations ----------------------------------------------------------
  const handleCreateOrUpdate = async (payload) => {
    setSaving(true)
    try {
      if (editingMatter) {
        await api(`/matters/${editingMatter.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await api('/matters', { method: 'POST', body: JSON.stringify(payload) })
      }
      setModalOpen(false)
      setEditingMatter(null)
      await loadMatters()
      await loadUpcoming()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (matter) => {
    if (!window.confirm(`Delete "${matter.title}"? This also removes its timeline.`)) return
    try {
      await api(`/matters/${matter.id}`, { method: 'DELETE' })
      if (selected?.id === matter.id) setSelected(null)
      await loadMatters()
      await loadUpcoming()
    } catch (e) {
      setError(e.message)
    }
  }

  const openDetail = async (matter) => {
    setDetailLoading(true)
    setSelected(matter)
    try {
      const full = await api(`/matters/${matter.id}`)
      setSelected(full)
    } catch (e) {
      setError(e.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const columns = useMemo(() => {
    const grouped = Object.fromEntries(STATUS_COLUMNS.map((c) => [c.key, []]))
    for (const m of matters) {
      if (grouped[m.status]) grouped[m.status].push(m)
      else (grouped.draft = grouped.draft || []).push(m)
    }
    return grouped
  }, [matters])

  return (
    <div style={{ minHeight: '100vh', padding: '28px clamp(16px, 4vw, 48px)', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            📁 Matter Workspace
          </h1>
          <p style={{ margin: '6px 0 0', opacity: 0.7, fontSize: 14 }}>
            Save and track your IP cases, deadlines and filing history.
          </p>
        </div>
        <button
          onClick={() => { setEditingMatter(null); setModalOpen(true) }}
          style={{
            padding: '11px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 14,
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
          }}
        >+ New Matter</button>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search title or application number…"
          style={{
            flex: '1 1 260px', padding: '10px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
            color: '#e2e8f0', fontSize: 14, outline: 'none',
          }}
        />
        <select
          value={caseTypeFilter}
          onChange={(e) => setCaseTypeFilter(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)', color: '#e2e8f0', fontSize: 14,
          }}
        >
          {CASE_TYPE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '10px 14px', borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Upcoming deadlines panel */}
      {upcoming.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 16, padding: 16, marginBottom: 24,
        }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#fbbf24' }}>⏰ Upcoming Deadlines (next 30 days)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
            {upcoming.map((u) => (
              <button
                key={u.event_id}
                onClick={() => openDetail(matters.find((m) => m.id === u.matter_id) || { id: u.matter_id })}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: '10px 12px', color: '#e2e8f0',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.matter_title}</div>
                <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'capitalize' }}>
                  {String(u.event_type).replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: u.days_remaining < 0 ? '#f87171' : u.days_remaining <= 7 ? '#fbbf24' : '#a3e635', marginTop: 4 }}>
                  {u.days_remaining < 0 ? `${Math.abs(u.days_remaining)}d overdue` : u.days_remaining === 0 ? 'Due today' : `in ${u.days_remaining}d`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, opacity: 0.6 }}>Loading matters…</div>
      ) : matters.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, opacity: 0.7,
          border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 16,
        }}>
          No matters yet. Click <strong>+ New Matter</strong> to add your first IP case.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 12,
              border: '1px solid rgba(255,255,255,0.08)', minHeight: 120,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
                <strong style={{ fontSize: 13 }}>{col.label}</strong>
                <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>{columns[col.key].length}</span>
              </div>
              {columns[col.key].map((m) => (
                <MatterCard
                  key={m.id}
                  matter={m}
                  onOpen={openDetail}
                  onEdit={(mm) => { setEditingMatter(mm); setModalOpen(true) }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <AddMatterModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingMatter(null) }}
        onSubmit={handleCreateOrUpdate}
        matter={editingMatter}
        saving={saving}
      />

      {/* Detail drawer with timeline */}
      {selected && (
        <MatterDetailDrawer
          matter={selected}
          loading={detailLoading}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditingMatter(selected); setModalOpen(true) }}
          onEventAdded={async () => { await openDetail(selected); await loadUpcoming(); await loadMatters() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail drawer (single matter timeline + add-event form)
// ---------------------------------------------------------------------------
function MatterDetailDrawer({ matter, loading, onClose, onEdit, onEventAdded }) {
  const [ev, setEv] = useState({ event_type: 'note', event_date: '', description: '', reminder_date: '' })
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  const addEvent = async (e) => {
    e.preventDefault()
    setAdding(true)
    setErr('')
    try {
      await api(`/matters/${matter.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          event_type: ev.event_type,
          event_date: ev.event_date ? new Date(ev.event_date).toISOString() : null,
          description: ev.description.trim() || null,
          reminder_date: ev.reminder_date ? new Date(ev.reminder_date).toISOString() : null,
        }),
      })
      setEv({ event_type: 'note', event_date: '', description: '', reminder_date: '' })
      await onEventAdded?.()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(2,6,23,0.55)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)', height: '100%', overflowY: 'auto',
          background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255,255,255,0.14)', padding: 24, color: '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{matter.title || 'Matter'}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 12, opacity: 0.8 }}>
              {matter.case_type && <span style={pill}>{matter.case_type}</span>}
              {matter.status && <span style={pill}>{matter.status}</span>}
              {matter.application_number && <span style={{ ...pill, fontFamily: 'monospace' }}>#{matter.application_number}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={pill}>✏️ Edit</button>
            <button onClick={onClose} style={{ ...pill, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {matter.notes && (
          <p style={{ marginTop: 14, fontSize: 14, opacity: 0.85, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{matter.notes}</p>
        )}

        <h3 style={{ margin: '22px 0 4px', fontSize: 15 }}>Timeline</h3>
        {loading ? (
          <div style={{ padding: 24, opacity: 0.6 }}>Loading events…</div>
        ) : (
          <MatterTimeline events={matter.events || []} />
        )}

        {/* Add event */}
        <form onSubmit={addEvent} style={{ marginTop: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>➕ Add Event / Reminder</h4>
          <select value={ev.event_type} onChange={(e) => setEv({ ...ev, event_type: e.target.value })} style={dInp}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={dLbl}>Event date</label>
              <input type="date" value={ev.event_date} onChange={(e) => setEv({ ...ev, event_date: e.target.value })} style={dInp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={dLbl}>Reminder date</label>
              <input type="date" value={ev.reminder_date} onChange={(e) => setEv({ ...ev, reminder_date: e.target.value })} style={dInp} />
            </div>
          </div>
          <textarea value={ev.description} onChange={(e) => setEv({ ...ev, description: e.target.value })} rows={2} placeholder="Description…" style={{ ...dInp, resize: 'vertical' }} />
          {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{err}</div>}
          <button type="submit" disabled={adding} style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 13 }}>
            {adding ? 'Adding…' : 'Add to Timeline'}
          </button>
        </form>
      </div>
    </div>
  )
}

const pill = {
  padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)', color: '#e2e8f0', fontSize: 12,
  textTransform: 'capitalize', cursor: 'default',
}
const dLbl = { display: 'block', fontSize: 11, opacity: 0.75, margin: '8px 0 4px' }
const dInp = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, marginBottom: 8,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#e2e8f0', fontSize: 13,
}
