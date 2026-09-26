import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  IconPlus,
  IconSearch,
  IconFlask,
  IconLeaf,
  IconCalculator,
  IconBook,
  IconCalendar,
  IconInfo,
  IconMenu,
  IconZap,
  IconUser,
  IconHelpCircle,
  IconChevronLeft,
  IconMessageSquare,
  IconSparkles,
} from './Icons'
import { getApiBase } from '../api/config'

/**
 * RagvynSidebar — Primary navigation sidebar (Eureka-style blue sidebar)
 *
 * Props:
 *   isLoggedIn   — boolean from App auth state
 *   userName     — string from App auth state (or '')
 *   onNewChat    — () => void — starts a fresh chat/task
 *   activeSessionId — current active conversation ID (from ChatPage or null)
 *   onSelectSession — (id) => void — load a past conversation
 *   onOpenAbout  — () => void — open about IP-SAKTI modal
 */
export default function RagvynSidebar({
  isLoggedIn,
  userName,
  onNewChat,
  activeSessionId,
  onSelectSession,
  onOpenAbout,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const sidebarRef = useRef(null)

  // Collapsed state (persisted in localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.innerWidth <= 768) return true // start collapsed on mobile/tablet
    const saved = localStorage.getItem('ragvyn_nav_collapsed')
    return saved === 'true'
  })

  // Mobile overlay open state (separate from collapsed — mobile is overlay-based)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Search panel open
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Conversation sessions (loaded from API, same source as ChatPage)
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
        return next
      })
    }
  }

  // Close mobile overlay
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

  // Close mobile sidebar on route change
  const prevPathnameRef = useRef(location.pathname)
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname && mobileOpen) {
      // Use a microtask to defer the state update
      queueMicrotask(() => setMobileOpen(false))
    }
    prevPathnameRef.current = location.pathname
  }, [location.pathname, mobileOpen])

  // Handle responsive breakpoints
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        // On mobile — always start collapsed, overlay mode
        setMobileOpen(false)
      } else if (window.innerWidth <= 1024) {
        // Tablet — collapsible
        setCollapsed(true)
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Click outside mobile sidebar to close
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

  // ---------- Load conversations from API ----------
  const formatSessionDate = useCallback((iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    if (sameDay) return `Today`
    if (isYesterday) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }, [])

  const refreshSessions = useCallback(async () => {
    const API_BASE = getApiBase()
    setLoadingSessions(true)
    try {
      const res = await fetch(`${API_BASE}/api/conversations?limit=30`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data.map(c => ({
        id: c.id,
        title: c.title || 'Untitled consultation',
        date: formatSessionDate(c.updated_at || c.created_at),
      })))
    } catch {
      // Silently fail — sidebar still works
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [formatSessionDate])

  useEffect(() => {
    // Fetch sessions on mount via a microtask to avoid synchronous setState in effect
    queueMicrotask(() => refreshSessions())
  }, [refreshSessions])

  // Refresh sessions when navigating to chat
  useEffect(() => {
    if (location.pathname === '/chat') {
      queueMicrotask(() => refreshSessions())
    }
  }, [location.pathname, refreshSessions])

  // ---------- Navigation items ----------
  const primaryNav = [
    {
      id: 'new-task',
      label: 'New Task',
      icon: <IconPlus size={20} />,
      action: () => {
        if (onNewChat) onNewChat()
        navigate('/chat', { state: { newChat: true } })
      },
      isAction: true,
    },
    {
      id: 'search-tasks',
      label: 'Search Tasks',
      icon: <IconSearch size={20} />,
      action: () => setSearchOpen(prev => !prev),
      isAction: true,
    },
    {
      id: 'formulation-wizard',
      label: 'Formulation Wizard',
      icon: <IconFlask size={20} />,
      path: '/formulation-wizard',
    },
    {
      id: 'abs-checker',
      label: 'ABS Checker',
      icon: <IconLeaf size={20} />,
      path: '/abs-checker',
    },
    {
      id: 'ip-calculator',
      label: 'IP Calculator',
      icon: <IconCalculator size={20} />,
      path: '/ip-calculator',
    },
    {
      id: 'sources',
      label: 'Official Data Corpora',
      icon: <IconBook size={20} />,
      path: '/sources',
    },
  ]

  const secondaryNav = [
    {
      id: 'deadline-calculator',
      label: 'Deadline Calculator',
      icon: <IconCalendar size={18} />,
      path: '/deadline-calculator',
    },
    {
      id: 'about-ip-sakti',
      label: 'About IP-SAKTI',
      icon: <IconInfo size={18} />,
      action: () => {
        if (onOpenAbout) onOpenAbout()
      },
      isAction: true,
    },
  ]

  // Filtered sessions for search
  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s =>
      s.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
    : sessions

  const handleSessionClick = (id) => {
    if (onSelectSession) onSelectSession(id)
    navigate('/chat')
    if (isMobile()) closeMobile()
  }

  const handleNavAction = (item) => {
    if (item.action) {
      item.action()
    }
    if (isMobile()) closeMobile()
  }

  // Determine effective sidebar state
  const isExpanded = isMobile() ? mobileOpen : !collapsed

  // User initial for avatar
  const userInitial = userName ? userName.charAt(0).toUpperCase() : ''

  return (
    <>
      {/* Mobile hamburger button — only visible on mobile when sidebar is hidden */}
      {isMobile() && !mobileOpen && (
        <button
          className="ragvyn-sidebar-mobile-trigger"
          onClick={toggleCollapsed}
          aria-label="Open navigation"
          title="Open navigation"
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

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={[
          'ragvyn-sidebar',
          isExpanded ? 'ragvyn-sidebar--expanded' : 'ragvyn-sidebar--collapsed',
          isMobile() && mobileOpen ? 'ragvyn-sidebar--mobile-open' : '',
          isMobile() && !mobileOpen ? 'ragvyn-sidebar--mobile-hidden' : '',
        ].filter(Boolean).join(' ')}
        aria-label="Main navigation"
        role="navigation"
      >
        {/* ---- Header ---- */}
        <div className="ragvyn-sidebar__header">
          <div className="ragvyn-sidebar__brand">
            <div className="ragvyn-sidebar__logo" aria-hidden="true">
              <IconSparkles size={22} />
            </div>
            {isExpanded && (
              <span className="ragvyn-sidebar__brand-name">RAGVYN AI</span>
            )}
          </div>
          <button
            className="ragvyn-sidebar__toggle"
            onClick={toggleCollapsed}
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isExpanded ? <IconChevronLeft size={18} /> : <IconMenu size={18} />}
          </button>
        </div>

        {/* ---- Primary Navigation ---- */}
        <nav className="ragvyn-sidebar__nav">
          <ul className="ragvyn-sidebar__nav-list" role="list">
            {primaryNav.map(item => {
              const isActive = item.path && location.pathname === item.path
              const isCurrentChat = item.id === 'new-task' && location.pathname === '/chat' && !activeSessionId

              if (item.isAction) {
                return (
                  <li key={item.id} className="ragvyn-sidebar__nav-item">
                    <button
                      className={[
                        'ragvyn-sidebar__nav-btn',
                        isCurrentChat ? 'ragvyn-sidebar__nav-btn--active' : '',
                        item.id === 'search-tasks' && searchOpen ? 'ragvyn-sidebar__nav-btn--active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleNavAction(item)}
                      title={collapsed && !isMobile() ? item.label : undefined}
                      aria-label={item.label}
                    >
                      <span className="ragvyn-sidebar__nav-icon">{item.icon}</span>
                      {isExpanded && <span className="ragvyn-sidebar__nav-label">{item.label}</span>}
                    </button>
                  </li>
                )
              }

              return (
                <li key={item.id} className="ragvyn-sidebar__nav-item">
                  <Link
                    to={item.path}
                    className={[
                      'ragvyn-sidebar__nav-btn',
                      isActive ? 'ragvyn-sidebar__nav-btn--active' : '',
                    ].filter(Boolean).join(' ')}
                    title={collapsed && !isMobile() ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="ragvyn-sidebar__nav-icon">{item.icon}</span>
                    {isExpanded && <span className="ragvyn-sidebar__nav-label">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ---- Search Tasks Panel ---- */}
        {isExpanded && searchOpen && (
          <div className="ragvyn-sidebar__search-panel">
            <input
              type="text"
              className="ragvyn-sidebar__search-input"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              aria-label="Search conversations"
            />
          </div>
        )}

        {/* ---- Recents ---- */}
        {isExpanded && (
          <div className="ragvyn-sidebar__recents">
            <div className="ragvyn-sidebar__recents-heading">Recents</div>
            <div className="ragvyn-sidebar__recents-list">
              {loadingSessions && (
                <div className="ragvyn-sidebar__recents-empty">Loading…</div>
              )}
              {!loadingSessions && filteredSessions.length === 0 && (
                <div className="ragvyn-sidebar__recents-empty">
                  {searchQuery.trim() ? 'No matching conversations.' : 'No recent conversations.'}
                </div>
              )}
              {!loadingSessions && filteredSessions.map(s => (
                <button
                  key={s.id}
                  className={[
                    'ragvyn-sidebar__recent-item',
                    activeSessionId === s.id ? 'ragvyn-sidebar__recent-item--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleSessionClick(s.id)}
                  title={s.title}
                  aria-label={`Open conversation: ${s.title}`}
                  aria-current={activeSessionId === s.id ? 'true' : undefined}
                >
                  <span className="ragvyn-sidebar__recent-icon">
                    <IconMessageSquare size={16} />
                  </span>
                  <span className="ragvyn-sidebar__recent-title">{s.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---- Collapsed-mode recent dots (tooltip on hover) ---- */}
        {!isExpanded && sessions.length > 0 && !isMobile() && (
          <div className="ragvyn-sidebar__recents-collapsed">
            <div className="ragvyn-sidebar__recents-heading-collapsed" title="Recents">
              <IconMessageSquare size={14} />
            </div>
            {sessions.slice(0, 5).map(s => (
              <button
                key={s.id}
                className={[
                  'ragvyn-sidebar__recent-dot',
                  activeSessionId === s.id ? 'ragvyn-sidebar__recent-dot--active' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleSessionClick(s.id)}
                title={s.title}
                aria-label={`Open conversation: ${s.title}`}
              >
                <span className="ragvyn-sidebar__recent-dot-inner">
                  {s.title.charAt(0).toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ---- Spacer ---- */}
        <div className="ragvyn-sidebar__spacer" />

        {/* ---- Lower Navigation Section ---- */}
        <div className="ragvyn-sidebar__secondary-nav">
          <ul className="ragvyn-sidebar__nav-list" role="list">
            {secondaryNav.map(item => {
              const isActive = item.path && location.pathname === item.path

              if (item.isAction) {
                return (
                  <li key={item.id} className="ragvyn-sidebar__nav-item">
                    <button
                      className="ragvyn-sidebar__nav-btn"
                      onClick={() => handleNavAction(item)}
                      title={collapsed && !isMobile() ? item.label : undefined}
                      aria-label={item.label}
                    >
                      <span className="ragvyn-sidebar__nav-icon">{item.icon}</span>
                      {isExpanded && <span className="ragvyn-sidebar__nav-label">{item.label}</span>}
                    </button>
                  </li>
                )
              }

              return (
                <li key={item.id} className="ragvyn-sidebar__nav-item">
                  <Link
                    to={item.path}
                    className={[
                      'ragvyn-sidebar__nav-btn',
                      isActive ? 'ragvyn-sidebar__nav-btn--active' : '',
                    ].filter(Boolean).join(' ')}
                    title={collapsed && !isMobile() ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => { if (isMobile()) closeMobile() }}
                  >
                    <span className="ragvyn-sidebar__nav-icon">{item.icon}</span>
                    {isExpanded && <span className="ragvyn-sidebar__nav-label">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* ---- Bottom Section ---- */}
        <div className="ragvyn-sidebar__bottom">
          {/* Upgrade button */}
          <Link
            to="/pricing"
            className="ragvyn-sidebar__upgrade-btn"
            title={!isExpanded ? 'Upgrade' : undefined}
            aria-label="Upgrade subscription"
            onClick={() => { if (isMobile()) closeMobile() }}
          >
            <IconZap size={16} />
            {isExpanded && <span>Upgrade</span>}
          </Link>

          {/* Bottom icons row */}
          <div className="ragvyn-sidebar__bottom-row">
            {/* User avatar / login */}
            {isLoggedIn && userName ? (
              <div
                className="ragvyn-sidebar__user-avatar"
                title={!isExpanded ? userName : undefined}
                aria-label={`Logged in as ${userName}`}
              >
                <span className="ragvyn-sidebar__avatar-circle">
                  {userInitial}
                </span>
                {isExpanded && (
                  <div className="ragvyn-sidebar__user-info">
                    <span className="ragvyn-sidebar__user-name">{userName}</span>
                    <span className="ragvyn-sidebar__user-role">Individual</span>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="ragvyn-sidebar__bottom-icon-btn"
                title={!isExpanded ? 'Sign in' : undefined}
                aria-label="Sign in"
                onClick={() => { if (isMobile()) closeMobile() }}
              >
                <IconUser size={18} />
                {isExpanded && <span>Sign in</span>}
              </Link>
            )}

            {/* Help */}
            <button
              className="ragvyn-sidebar__bottom-icon-btn"
              title={!isExpanded ? 'Help' : 'Help & Support'}
              aria-label="Help & Support"
              onClick={() => {
                if (onOpenAbout) onOpenAbout()
                if (isMobile()) closeMobile()
              }}
            >
              <IconHelpCircle size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
