import React from 'react'
import {
  IconFileText,
  IconAward,
  IconBook,
  IconLeaf,
  IconGlobe,
  IconEdit,
  IconTrash,
} from './Icons'

const CASE_TYPE_META = {
  patent: { label: 'Patent', color: '#6D35E8', bg: '#F4EFFE', border: '#D8C7F9', icon: IconFileText },
  trademark: { label: 'Trademark', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', icon: IconAward },
  copyright: { label: 'Copyright', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: IconBook },
  gi: { label: 'GI', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: IconLeaf },
}

function formatDate(value) {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return null }
}

function getJurisdictionCode(appNumber) {
  if (!appNumber) return 'IN'
  const u = appNumber.toUpperCase()
  if (u.startsWith('PCT') || u.startsWith('WO')) return 'PCT'
  if (u.startsWith('US')) return 'US'
  if (u.startsWith('EP')) return 'EP'
  if (u.startsWith('GB')) return 'GB'
  return 'IN'
}

/**
 * A single matter card for the Kanban board.
 * Props: matter, onOpen(matter), onEdit(matter), onDelete(matter)
 */
export default function MatterCard({ matter, onOpen, onEdit, onDelete }) {
  const meta = CASE_TYPE_META[matter.case_type] || { label: matter.case_type, color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', icon: IconFileText }
  const filed = formatDate(matter.filing_date)
  const code = getJurisdictionCode(matter.application_number)
  const IconComp = meta.icon

  return (
    <div
      className="mw-kanban-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(matter)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(matter) }}
      style={{
        background: 'var(--mw-card-bg, #ffffff)',
        border: '1px solid var(--mw-card-border, #E4E0D8)',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 10,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: 'var(--mw-shadow-sm, 0 1px 3px rgba(17,24,39,0.04))',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'var(--mw-purple, #6D35E8)'
        e.currentTarget.style.boxShadow = 'var(--mw-shadow-md, 0 4px 14px rgba(17,24,39,0.08))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.borderColor = 'var(--mw-card-border, #E4E0D8)'
        e.currentTarget.style.boxShadow = 'var(--mw-shadow-sm, 0 1px 3px rgba(17,24,39,0.04))'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
            padding: '2px 8px', borderRadius: 6,
            background: meta.bg, color: meta.color,
            border: `1px solid ${meta.border}`, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <IconComp size={12} /> {meta.label}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            title="Edit"
            onClick={(e) => { e.stopPropagation(); onEdit?.(matter) }}
            style={iconBtn}
          >
            <IconEdit size={13} />
          </button>
          <button
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete?.(matter) }}
            style={{ ...iconBtn, color: '#dc2626' }}
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      <h4 style={{
        margin: '0 0 6px',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.35,
        color: 'var(--mw-text-main, #111827)',
      }}>
        {matter.title}
      </h4>

      {matter.application_number && (
        <div style={{
          fontSize: 12,
          color: 'var(--mw-text-muted, #667085)',
          fontFamily: 'var(--font-mono, monospace)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--mw-bg, #F7F5F0)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--mw-card-border, #E4E0D8)', fontSize: 11 }}>
            <IconGlobe size={11} /> {code}
          </span>
          <span>#{matter.application_number}</span>
        </div>
      )}

      {matter.notes && (
        <p style={{
          margin: '0 0 10px',
          fontSize: 12,
          color: 'var(--mw-text-muted, #667085)',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {matter.notes}
        </p>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTop: '1px solid var(--mw-card-border, #E4E0D8)',
        fontSize: 11,
        color: 'var(--mw-text-subtle, #94a3b8)',
      }}>
        <span>{filed ? `Filed ${filed}` : 'Draft'}</span>
        <span>{(matter.event_count ?? 0)} event{(matter.event_count ?? 0) === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

const iconBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--mw-text-muted, #667085)',
  opacity: 0.85,
  padding: '4px',
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
}
