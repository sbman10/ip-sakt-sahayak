function fmt(value, withTime = false) {
  if (!value) return '—'
  try {
    const d = new Date(value)
    return d.toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
  } catch { return '—' }
}

const EVENT_META = {
  filing: { color: '#0284c7', bg: '#e0f2fe', icon: '📨', label: 'Initial Filing' },
  office_action: { color: '#d97706', bg: '#fef3c7', icon: '📋', label: 'Office Action' },
  deadline: { color: '#dc2626', bg: '#fee2e2', icon: '⏰', label: 'Statutory Deadline' },
  response: { color: '#7c3aed', bg: '#f5f3ff', icon: '✍️', label: 'Response Filed' },
  grant: { color: '#16a34a', bg: '#dcfce7', icon: '🏆', label: 'Patent Granted' },
  note: { color: '#64748b', bg: '#f1f5f9', icon: '📝', label: 'Case Note' },
}

/**
 * Vertical timeline of a matter's events with modern SaaS legal-tech aesthetics.
 * Props: events [{id,event_type,event_date,description,reminder_date}]
 */
export default function MatterTimeline({ events = [] }) {
  if (!events.length) {
    return (
      <div style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: 'var(--mw-text-muted, #64748b)',
        fontSize: 13,
        background: 'var(--mw-bg, #f8fafc)',
        borderRadius: 10,
        border: '1px dashed var(--mw-card-border, #e2e8f0)',
      }}>
        No events recorded yet. Add a filing, office action, response or reminder below to build the audit history.
      </div>
    )
  }

  const sorted = [...events].sort((a, b) => {
    const av = a.event_date || a.reminder_date || a.created_at || 0
    const bv = b.event_date || b.reminder_date || b.created_at || 0
    return new Date(bv) - new Date(av)
  })

  return (
    <div style={{ position: 'relative', paddingLeft: 28, marginTop: 12 }}>
      {/* spine */}
      <div style={{
        position: 'absolute', left: 9, top: 8, bottom: 8, width: 2,
        background: 'linear-gradient(to bottom, #7c3aed, #10b981)',
        borderRadius: 2,
        opacity: 0.6,
      }} />
      {sorted.map((ev) => {
        const meta = EVENT_META[ev.event_type] || { color: '#64748b', bg: '#f1f5f9', icon: '•', label: ev.event_type }
        const overdue = ev.reminder_date && new Date(ev.reminder_date) < new Date()
        return (
          <div key={ev.id} style={{ position: 'relative', marginBottom: 16 }}>
            {/* Dot marker */}
            <span style={{
              position: 'absolute', left: -27, top: 4, width: 20, height: 20,
              borderRadius: '50%', background: meta.color, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 11,
              color: '#ffffff',
              boxShadow: `0 0 0 3px ${meta.color}25`,
            }}>{meta.icon}</span>

            {/* Event Card */}
            <div style={{
              background: 'var(--mw-card-bg, #ffffff)',
              border: '1px solid var(--mw-card-border, #e2e8f0)',
              borderRadius: 10,
              padding: '12px 14px',
              boxShadow: 'var(--mw-shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: meta.color,
                  background: `${meta.color}15`,
                  padding: '2px 8px',
                  borderRadius: 4,
                }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--mw-text-muted, #64748b)', fontWeight: 500 }}>
                  {fmt(ev.event_date)}
                </span>
              </div>
              {ev.description && (
                <p style={{
                  margin: '6px 0 0',
                  fontSize: 13,
                  color: 'var(--mw-text-body, #334155)',
                  lineHeight: 1.5,
                }}>
                  {ev.description}
                </p>
              )}
              {ev.reminder_date && (
                <div style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: overdue ? '#fee2e2' : '#fef3c7',
                  color: overdue ? '#b91c1c' : '#92400e',
                  border: `1px solid ${overdue ? '#fca5a5' : '#fde68a'}`,
                }}>
                  {overdue ? '⚠️ Overdue deadline: ' : '⏰ Action deadline: '}{fmt(ev.reminder_date, true)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
