import React from 'react'

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
  filing: { color: '#0ea5e9', icon: '📨' },
  office_action: { color: '#f59e0b', icon: '📋' },
  deadline: { color: '#ef4444', icon: '⏰' },
  response: { color: '#8b5cf6', icon: '✍️' },
  grant: { color: '#10b981', icon: '🏆' },
  note: { color: '#94a3b8', icon: '📝' },
}

/**
 * Vertical timeline of a matter's events.
 * Props: events [{id,event_type,event_date,description,reminder_date}]
 */
export default function MatterTimeline({ events = [] }) {
  if (!events.length) {
    return (
      <div style={{ padding: '32px 12px', textAlign: 'center', opacity: 0.6, fontSize: 14 }}>
        No events yet. Add a filing, office action, or reminder to build the timeline.
      </div>
    )
  }

  const sorted = [...events].sort((a, b) => {
    const av = a.event_date || a.reminder_date || a.created_at || 0
    const bv = b.event_date || b.reminder_date || b.created_at || 0
    return new Date(bv) - new Date(av)
  })

  return (
    <div style={{ position: 'relative', paddingLeft: 28, marginTop: 8 }}>
      {/* spine */}
      <div style={{
        position: 'absolute', left: 9, top: 6, bottom: 6, width: 2,
        background: 'linear-gradient(to bottom, rgba(99,102,241,0.6), rgba(16,185,129,0.4))',
        borderRadius: 2,
      }} />
      {sorted.map((ev) => {
        const meta = EVENT_META[ev.event_type] || { color: '#94a3b8', icon: '•' }
        const overdue = ev.reminder_date && new Date(ev.reminder_date) < new Date()
        return (
          <div key={ev.id} style={{ position: 'relative', marginBottom: 18 }}>
            <span style={{
              position: 'absolute', left: -27, top: 2, width: 18, height: 18,
              borderRadius: '50%', background: meta.color, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 10,
              boxShadow: `0 0 0 3px ${meta.color}33`,
            }}>{meta.icon}</span>

            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ textTransform: 'capitalize', fontSize: 13, color: meta.color }}>
                  {String(ev.event_type).replace(/_/g, ' ')}
                </strong>
                <span style={{ fontSize: 11, opacity: 0.65 }}>{fmt(ev.event_date)}</span>
              </div>
              {ev.description && (
                <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
                  {ev.description}
                </p>
              )}
              {ev.reminder_date && (
                <div style={{
                  marginTop: 8, fontSize: 11, fontWeight: 600,
                  color: overdue ? '#ef4444' : '#f59e0b',
                }}>
                  {overdue ? '⚠️ Overdue reminder: ' : '⏰ Reminder: '}{fmt(ev.reminder_date, true)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
