import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconPlus,
  IconMenu,
  IconMessageSquare,
  IconSparkles,
} from './Icons'
import { getApiBase } from '../api/config'

/**
 * RagvynSidebar — Chatbot-Only Navigation Sidebar
 * 
 * Strict Scope:
 * - Renders ONLY inside the RAGVYN AI chatbot interface.
 * - Contains ONLY:
 *   1. "New Task" action button
 *   2. "Previous Tasks" list backed by existing conversations API (no dummy data)
 * - All profile/auth controls are kept in the top navigation bar.
 */
export default function RagvynSidebar({
  onNewChat,
  activeSessionId,
  onSelectSession,
}) {
  const navigate = useNavigate()
  const sidebarRef = useRef(null)

  // Collapsed / hidden state (persisted in localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.innerWidth <= 768) return true
    const saved = localStorage.getItem('ragvyn_nav_collapsed')
    return saved === 'true'
  })

  // Mobile drawer open state
  const [mobileOpen, setMobileOpen] = useState(false)

  // Real conversation sessions loaded from backend API
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768

  // Toggle collapsed state
  const toggleCollapsed = () => {
    if (isMobile()) {
      setMobileOpen(prev => !prev)
    } else {
      setCollapsed(prev => {
        const next = !prev
        localStorage.setItem('ragvyn_nav_collapsed', String(next))
        window.dispatchEvent(new CustomEvent('ragvyn_sidebar_toggled', { detail: { hidden: next } }))
        return next
      })
    }
  }

  // Close mobile drawer
  const closeMobile = useCallback(() => {
    setMobileOpen(false)
  }, [])

  // Escape key closes mobile sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        closeMobile()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, closeMobile])

  // Handle responsive resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setMobileOpen(false)
      } else if (window.innerWidth <= 1024) {
        setCollapsed(true)
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Sync with external sidebar toggle events (e.g. AppShell restore toggle)
  useEffect(() => {
    const handleExternalToggle = (e) => {
      const hidden = !!e.detail?.hidden
      setCollapsed(hidden)
    }
    window.addEventListener('ragvyn_sidebar_toggled', handleExternalToggle)
    return () => window.removeEventListener('ragvyn_sidebar_toggled', handleExternalToggle)
  }, [])

  // Click outside mobile drawer to close
  useEffect(() => {
    if (!mobileOpen) return
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        closeMobile()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileOpen, closeMobile])

  // Active session tracking: prefer event-driven selection or activeSessionId prop
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const effectiveActiveId = selectedSessionId !== null ? selectedSessionId : activeSessionId

  useEffect(() => {
    const handleActiveChanged = (e) => {
      setSelectedSessionId(e.detail?.id || null)
    }
    window.addEventListener('ragvyn_active_session_changed', handleActiveChanged)
    return () => window.removeEventListener('ragvyn_active_session_changed', handleActiveChanged)
  }, [])

  // Format session timestamp for human readability
  const formatSessionDate = useCallback((iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    if (sameDay) return 'Today'
    if (isYesterday) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }, [])

  // Fetch real conversation history from API
  const refreshSessions = useCallback(async () => {
    const API_BASE = getApiBase()
    setLoadingSessions(true)
    try {
      const token = localStorage.getItem('ip_sakti_access_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/api/conversations?limit=30`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setSessions(data.map(c => ({
          id: c.id,
          title: c.title || 'Untitled task',
          date: formatSessionDate(c.updated_at || c.created_at),
        })))
      } else {
        setSessions([])
      }
    } catch {
      // Gracefully handle unauthenticated or offline API states
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [formatSessionDate])

  useEffect(() => {
    queueMicrotask(() => refreshSessions())
  }, [refreshSessions])

  // Listen for session updates (e.g. new message posted in chat)
  useEffect(() => {
    const handleUpdated = () => {
      refreshSessions()
    }
    window.addEventListener('ragvyn_sessions_updated', handleUpdated)
    return () => window.removeEventListener('ragvyn_sessions_updated', handleUpdated)
  }, [refreshSessions])

  // Handler for New Task
  const handleNewTask = () => {
    setSelectedSessionId(null)
    window.dispatchEvent(new CustomEvent('ragvyn_active_session_changed', { detail: { id: null } }))
    if (onNewChat) onNewChat()
    navigate('/chat', { state: { newChat: true } })
    if (isMobile()) closeMobile()
  }

  // Handler for selecting a past task
  const handleSessionClick = (id) => {
    setSelectedSessionId(id)
    window.dispatchEvent(new CustomEvent('ragvyn_active_session_changed', { detail: { id } }))
    if (onSelectSession) onSelectSession(id)
    navigate('/chat', { state: { loadSessionId: id } })
    if (isMobile()) closeMobile()
  }

  const isExpanded = isMobile() ? mobileOpen : !collapsed
  const isFullyHidden = !isMobile() && collapsed

  return (
    <>
      {/* Mobile drawer trigger button */}
      {isMobile() && (
        <button
          type="button"
          className="ragvyn-sidebar-mobile-trigger"
          onClick={toggleCollapsed}
          aria-label={mobileOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
          title={mobileOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
          aria-expanded={mobileOpen}
        >
          <IconMenu size={22} />
        </button>
      )}

      {/* Mobile backdrop overlay */}
      {isMobile() && mobileOpen && (
        <div
          className="ragvyn-sidebar-backdrop"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        ref={sidebarRef}
        className={[
          'ragvyn-sidebar',
          isExpanded ? 'ragvyn-sidebar--expanded' : 'ragvyn-sidebar--collapsed',
          isFullyHidden ? 'ragvyn-sidebar--fully-hidden' : '',
          isMobile() && mobileOpen ? 'ragvyn-sidebar--mobile-open' : '',
          isMobile() && !mobileOpen ? 'ragvyn-sidebar--mobile-hidden' : '',
        ].filter(Boolean).join(' ')}
        aria-label="Chatbot Task Navigation"
        role="navigation"
        aria-hidden={isFullyHidden ? 'true' : undefined}
      >
        {/* Brand / Logo Header */}
        <div className="ragvyn-sidebar__header">
          <div className="ragvyn-sidebar__brand">
            <div className="ragvyn-sidebar__logo" aria-hidden="true">
              <IconSparkles size={22} />
            </div>
            {isExpanded && (
              <span className="ragvyn-sidebar__brand-name">RAGVYN AI</span>
            )}
          </div>
          {isExpanded && !isMobile() && (
            <button
              type="button"
              className="ragvyn-sidebar__toggle"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <IconMenu size={18} />
            </button>
          )}
        </div>

        {/* Action: 1. New Task */}
        <nav className="ragvyn-sidebar__nav">
          <ul className="ragvyn-sidebar__nav-list" role="list">
            <li className="ragvyn-sidebar__nav-item">
              <button
                type="button"
                className={[
                  'ragvyn-sidebar__nav-btn',
                  !effectiveActiveId ? 'ragvyn-sidebar__nav-btn--active' : '',
                ].filter(Boolean).join(' ')}
                onClick={handleNewTask}
                title="New Task"
                aria-label="Start a new task"
              >
                <span className="ragvyn-sidebar__nav-icon">
                  <IconPlus size={20} />
                </span>
                {isExpanded && <span className="ragvyn-sidebar__nav-label">New Task</span>}
              </button>
            </li>
          </ul>
        </nav>

        {/* Action: 2. Previous Tasks */}
        {isExpanded && (
          <div className="ragvyn-sidebar__recents">
            <div className="ragvyn-sidebar__recents-heading">Previous Tasks</div>
            <div className="ragvyn-sidebar__recents-list">
              {loadingSessions && (
                <div className="ragvyn-sidebar__recents-empty">Loading history…</div>
              )}
              {!loadingSessions && sessions.length === 0 && (
                <div className="ragvyn-sidebar__recents-empty">No previous tasks.</div>
              )}
              {!loadingSessions && sessions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={[
                    'ragvyn-sidebar__recent-item',
                    effectiveActiveId === s.id ? 'ragvyn-sidebar__recent-item--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleSessionClick(s.id)}
                  title={s.title}
                  aria-label={`Open task: ${s.title}`}
                  aria-current={effectiveActiveId === s.id ? 'true' : undefined}
                >
                  <span className="ragvyn-sidebar__recent-icon">
                    <IconMessageSquare size={16} />
                  </span>
                  <span className="ragvyn-sidebar__recent-title">{s.title}</span>
                  {s.date && (
                    <span className="ragvyn-sidebar__recent-date" style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 'auto' }}>
                      {s.date}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ragvyn-sidebar__spacer" style={{ flex: 1 }} />
      </aside>
    </>
  )
}
