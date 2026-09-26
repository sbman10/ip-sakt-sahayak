const CASE_TYPE_META = {
  patent: { label: 'Patent', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', emoji: '⚙️' },
  trademark: { label: 'Trademark', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', emoji: '™️' },
  copyright: { label: 'Copyright', color: '#d97706', bg: '#fffbeb', border: '#fde68a', emoji: '©️' },
  gi: { label: 'GI', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', emoji: '🌿' },
}

function formatDate(value) {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return null }
}

function getJurisdictionFlag(appNumber) {
  if (!appNumber) return '🇮🇳'
  const u = appNumber.toUpperCase()
  if (u.startsWith('PCT') || u.startsWith('WO')) return '🌐'
  if (u.startsWith('US')) return '🇺🇸'
  if (u.startsWith('EP')) return '🇪🇺'
  if (u.startsWith('GB')) return '🇬🇧'
  return '🇮🇳'
}

/**
 * A single matter card for the Kanban board.
 * Props: matter, onOpen(matter), onEdit(matter), onDelete(matter)
 */
export default function MatterCard({ matter, onOpen, onEdit, onDelete }) {
  const meta = CASE_TYPE_META[matter.case_type] || { label: matter.case_type, color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', emoji: '📄' }
  const filed = formatDate(matter.filing_date)
  const flag = getJurisdictionFlag(matter.application_number)

  return (
    <div
      className="mw-kanban-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(matter)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(matter) }}
      style={{
        background: 'var(--mw-card-bg, #ffffff)',
        border: '1px solid var(--mw-card-border, #e2e8f0)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 10,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: 'var(--mw-shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'var(--mw-purple, #7c3aed)'
        e.currentTarget.style.boxShadow = 'var(--mw-shadow-md, 0 4px 12px rgba(0,0,0,0.08))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.borderColor = 'var(--mw-card-border, #e2e8f0)'
        e.currentTarget.style.boxShadow = 'var(--mw-shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
            padding: '2px 8px', borderRadius: 4,
            background: meta.bg, color: meta.color,
            border: `1px solid ${meta.border}`, whiteSpace: 'nowrap',
          }}
        >
          {meta.emoji} {meta.label}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            title="Edit"
            onClick={(e) => { e.stopPropagation(); onEdit?.(matter) }}
            style={iconBtn}
          >✏️</button>
          <button
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete?.(matter) }}
            style={{ ...iconBtn, color: '#ef4444' }}
          >🗑️</button>
        </div>
      </div>

      <h4 style={{
        margin: '0 0 6px',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.35,
        color: 'var(--mw-text-main, #0f172a)',
      }}>
        {matter.title}
      </h4>

      {matter.application_number && (
        <div style={{
          fontSize: 12,
          color: 'var(--mw-text-muted, #64748b)',
          fontFamily: 'var(--font-mono, monospace)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span>{flag}</span>
          <span>#{matter.application_number}</span>
        </div>
      )}

      {matter.notes && (
        <p style={{
          margin: '0 0 10px',
          fontSize: 12,
          color: 'var(--mw-text-muted, #64748b)',
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
        borderTop: '1px solid var(--mw-card-border, #f1f5f9)',
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
  opacity: 0.75,
  padding: '3px 4px',
  borderRadius: 4,
  lineHeight: 1,
}
