import React from 'react'

const CASE_TYPE_META = {
  patent: { label: 'Patent', color: '#6366f1', emoji: '⚙️' },
  trademark: { label: 'Trademark', color: '#0ea5e9', emoji: '™️' },
  copyright: { label: 'Copyright', color: '#f59e0b', emoji: '©️' },
  gi: { label: 'GI', color: '#10b981', emoji: '🌿' },
}

function formatDate(value) {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return null }
}

/**
 * A single matter card for the Kanban board.
 * Props: matter, onOpen(matter), onEdit(matter), onDelete(matter)
 */
export default function MatterCard({ matter, onOpen, onEdit, onDelete }) {
  const meta = CASE_TYPE_META[matter.case_type] || { label: matter.case_type, color: '#94a3b8', emoji: '📄' }
  const filed = formatDate(matter.filing_date)

  return (
    <div
      className="mw-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(matter)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(matter) }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        padding: '14px 16px',
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
        boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.borderColor = meta.color
        e.currentTarget.style.boxShadow = `0 10px 30px ${meta.color}33`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
            padding: '3px 9px', borderRadius: 999,
            background: `${meta.color}22`, color: meta.color,
            border: `1px solid ${meta.color}55`, whiteSpace: 'nowrap',
          }}
        >
          {meta.emoji} {meta.label}
        </span>
        <div className="mw-card-actions" style={{ display: 'flex', gap: 6 }}>
          <button
            title="Edit"
            onClick={(e) => { e.stopPropagation(); onEdit?.(matter) }}
            style={iconBtn}
          >✏️</button>
          <button
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete?.(matter) }}
            style={iconBtn}
          >🗑️</button>
        </div>
      </div>

      <h4 style={{ margin: '10px 0 6px', fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
        {matter.title}
      </h4>

      {matter.application_number && (
        <div style={{ fontSize: 12, opacity: 0.75, fontFamily: 'monospace' }}>
          #{matter.application_number}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        <span>{filed ? `Filed ${filed}` : 'Not filed'}</span>
        <span>{(matter.event_count ?? 0)} event{(matter.event_count ?? 0) === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

const iconBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  opacity: 0.7,
  padding: 2,
  lineHeight: 1,
}
