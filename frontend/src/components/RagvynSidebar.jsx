import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  IconChevronRight,
  IconScroll,
  IconGlobe,
  IconLogout,
  IconCheck,
  IconMessageSquare,
  IconSparkles,
  IconX,
  IconTrash,
} from './Icons'
import { getApiBase } from '../api/config'

/**
 * RagvynSidebar — Primary navigation sidebar (Eureka-style blue sidebar)
 *
 * Props:
 *   isLoggedIn   — boolean from App auth state
 *   userName     — string from App auth state (or '')
 *   onLogout     — () => void — logs user out
 *   currentLang  — string (e.g. 'en')
 *   onSetLang    — (code) => void
 *   languages    — array of language objects { code, label }
 *   onNewChat    — () => void — starts a fresh chat/task
 *   activeSessionId — current active conversation ID (from ChatPage or null)
 *   onSelectSession — (id) => void — load a past conversation
 *   onOpenAbout  — () => void — open about IP-SAKTI modal
 */
export default function RagvynSidebar({
  isLoggedIn,
  userName,
  onLogout,
  currentLang,
  onSetLang,
  languages,
  onNewChat,
  activeSessionId,
  onSelectSession,
  onOpenAbout,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const sidebarRef = useRef(null)

  // Hidden state (persisted in localStorage) — fully hides sidebar (zero width)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.innerWidth <= 768) return true // start hidden on mobile/tablet
    const saved = localStorage.getItem('ragvyn_nav_collapsed')
    return saved === 'true'
  })

  // Mobile overlay open state (separate from collapsed — mobile is overlay-based)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Conversation sessions (loaded from API, same source as ChatPage)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  // Delete Task confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    session: null,
    isDeleting: false,
    error: null,
  })
  const [deletingSessionId, setDeletingSessionId] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)
  const toastTimerRef = useRef(null)
  const lastActiveElementRef = useRef(null)
  const cancelBtnRef = useRef(null)
  const deleteBtnRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const promptDeleteSession = (session) => {
    lastActiveElementRef.current = document.activeElement
    setConfirmModal({
      open: true,
      session,
      isDeleting: false,
      error: null,
    })
  }

  const closeDeleteModal = useCallback(() => {
    if (confirmModal.isDeleting) return
    setConfirmModal({
      open: false,
      session: null,
      isDeleting: false,
      error: null,
    })
    if (lastActiveElementRef.current && typeof lastActiveElementRef.current.focus === 'function') {
      lastActiveElementRef.current.focus()
    }
  }, [confirmModal.isDeleting])

  // Focus cancel button on modal open (safe default: pressing Enter won't delete)
  useEffect(() => {
    if (confirmModal.open && cancelBtnRef.current) {
      const t = setTimeout(() => {
        cancelBtnRef.current?.focus()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [confirmModal.open])

  // Trap focus and handle Escape inside modal
  useEffect(() => {
    if (!confirmModal.open) return
    const handleModalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeDeleteModal()
      } else if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])')
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleModalKeyDown, true)
    return () => document.removeEventListener('keydown', handleModalKeyDown, true)
  }, [confirmModal.open, closeDeleteModal])

  const executeDelete = async () => {
    const session = confirmModal.session
    if (!session || confirmModal.isDeleting) return

    setConfirmModal(prev => ({ ...prev, isDeleting: true, error: null }))
    setDeletingSessionId(session.id)
    const API_BASE = getApiBase()

    try {
      const token = sessionStorage.getItem('ip_sakti_access_token') || localStorage.getItem('ip_sakti_access_token')
      const headers = (token && token !== 'undefined' && token !== 'null') ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/api/conversations/${session.id}`, {
        method: 'DELETE',
        headers,
      })

      // Idempotent: 200/204 or 404 (already deleted) are treated as successful cleanup
      if (res.ok || res.status === 404) {
        // Optimistically remove from state
        setSessions(prev => prev.filter(s => s.id !== session.id))
        const wasActive = session.id === effectiveActiveId

        // If the user deleted the task currently open:
        if (wasActive) {
          setCurrentActiveId(null)
          window.dispatchEvent(new CustomEvent('ragvyn_active_session_changed', { detail: { id: null } }))
          if (onNewChat) onNewChat()
          navigate('/chat', { state: { newChat: true } })
        }

        // Notify other listeners (e.g. ChatPage to clear current messages if open)
        window.dispatchEvent(new CustomEvent('ragvyn_session_deleted', { detail: { id: session.id, wasActive } }))
        window.dispatchEvent(new Event('ragvyn_sessions_updated'))

        // Close modal
        const deletedTitle = session.title || 'Task'
        setConfirmModal({ open: false, session: null, isDeleting: false, error: null })
        setDeletingSessionId(null)

        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToastMessage(`Task "${deletedTitle}" deleted`)
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 3500)
      } else {
        let errMessage = 'Failed to delete task. Please try again.'
        try {
          const data = await res.json()
          if (data?.detail) errMessage = data.detail
        } catch {
          // ignore json parse error
        }
        setConfirmModal(prev => ({ ...prev, isDeleting: false, error: errMessage }))
        setDeletingSessionId(null)
      }
    } catch (err) {
      setConfirmModal(prev => ({
        ...prev,
        isDeleting: false,
        error: err.message || 'Network error occurred while deleting task.',
      }))
      setDeletingSessionId(null)
    }
  }

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768

  // Toggle collapsed state (fully hidden on desktop)
  const toggleCollapsed = () => {
    if (isMobile()) {
      setMobileOpen(prev => !prev)
    } else {
      setCollapsed(prev => {
        const next = !prev
        localStorage.setItem('ragvyn_nav_collapsed', String(next))
        // Notify AppShell so it can sync content offset and show restore toggle
        window.dispatchEvent(new CustomEvent('ragvyn_sidebar_toggled', { detail: { hidden: next } }))
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

  // Sync with external sidebar toggle events (e.g. AppShell restore button)
  useEffect(() => {
    const handleExternalToggle = (e) => {
      const hidden = !!e.detail?.hidden
      setCollapsed(hidden)
      if (isMobile()) {
        setMobileOpen(!hidden)
      }
    }
    window.addEventListener('ragvyn_sidebar_toggled', handleExternalToggle)
    return () => window.removeEventListener('ragvyn_sidebar_toggled', handleExternalToggle)
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

  // Active session state tracking (sync with prop or custom event)
  const [currentActiveId, setCurrentActiveId] = useState(activeSessionId)
  useEffect(() => {
    setCurrentActiveId(activeSessionId)
  }, [activeSessionId])

  useEffect(() => {
    const handleActiveChanged = (e) => {
      setCurrentActiveId(e.detail?.id || null)
    }
    window.addEventListener('ragvyn_active_session_changed', handleActiveChanged)
    return () => window.removeEventListener('ragvyn_active_session_changed', handleActiveChanged)
  }, [])

  // ---------- Load conversations/tasks from API ----------
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
      const token = sessionStorage.getItem('ip_sakti_access_token') || localStorage.getItem('ip_sakti_access_token')
      const headers = (token && token !== 'undefined' && token !== 'null') ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/api/conversations?limit=30`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data.map(c => ({
        id: c.id,
        title: c.title || 'Untitled task',
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

  // Listen for global session update events (e.g. when messages are sent in ChatPage)
  useEffect(() => {
    const handleUpdated = () => {
      refreshSessions()
    }
    window.addEventListener('ragvyn_sessions_updated', handleUpdated)
    return () => window.removeEventListener('ragvyn_sessions_updated', handleUpdated)
  }, [refreshSessions])

  // Refresh sessions when navigating to chat
  useEffect(() => {
    if (location.pathname === '/chat') {
      queueMicrotask(() => refreshSessions())
    }
  }, [location.pathname, refreshSessions])

  // ---------- Navigation items ----------
  // Chat-only sidebar: New Task action + Recent Tasks list. Tool shortcuts removed.
  const primaryNav = [
    {
      id: 'new-task',
      label: 'New Task',
      icon: <IconPlus size={20} />,
      action: () => {
        setCurrentActiveId(null)
        window.dispatchEvent(new CustomEvent('ragvyn_active_session_changed', { detail: { id: null } }))
        if (onNewChat) onNewChat()
        navigate('/chat', { state: { newChat: true } })
      },
      isAction: true,
    },
  ]

  // ---- Search Tasks state ----
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const searchBtnRef = useRef(null)

  const toggleSearch = useCallback(() => {
    if (collapsed && !isMobile()) {
      setCollapsed(false)
      localStorage.setItem('ragvyn_nav_collapsed', 'false')
      window.dispatchEvent(new CustomEvent('ragvyn_sidebar_toggled', { detail: { hidden: false } }))
      setSearchOpen(true)
      return
    }
    setSearchOpen(prev => {
      const next = !prev
      if (!next) setSearchQuery('')
      return next
    })
  }, [collapsed])

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  // Filter sessions by title and available metadata (case-insensitive)
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase().trim()
    return sessions.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.jurisdiction || '').toLowerCase().includes(q) ||
      (s.date || '').toLowerCase().includes(q)
    )
  }, [sessions, searchQuery])

  // Search input keyboard management: Escape clears or closes, ArrowDown jumps to list
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (searchQuery) {
        setSearchQuery('')
      } else {
        setSearchOpen(false)
        searchBtnRef.current?.focus()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const firstItem = document.querySelector('.ragvyn-sidebar__recent-item')
      if (firstItem) firstItem.focus()
    }
  }

  const handleSessionClick = (id) => {
    setCurrentActiveId(id)
    window.dispatchEvent(new CustomEvent('ragvyn_active_session_changed', { detail: { id } }))
    if (onSelectSession) onSelectSession(id)
    navigate('/chat', { state: { loadSessionId: id } })
    if (isMobile()) closeMobile()
  }

  const handleNavAction = (item) => {
    if (item.action) {
      item.action()
    }
    if (isMobile()) closeMobile()
  }

  // Determine effective sidebar state
  // On desktop: sidebar is either fully visible (expanded) or fully hidden (collapsed=true means zero-width)
  const isExpanded = isMobile() ? mobileOpen : !collapsed
  const isFullyHidden = !isMobile() && collapsed
  const effectiveActiveId = currentActiveId !== undefined ? currentActiveId : activeSessionId

  // User profile resolution
  const userProfile = useMemo(() => {
    try {
      const raw = localStorage.getItem('ip_sakti_user')
      if (raw) return JSON.parse(raw)
    } catch {
      // fallback
    }
    const name = localStorage.getItem('ip_sakti_user_name') || userName || ''
    return { full_name: name }
  }, [userName])

  // Profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false)
  const [showLangSubmenu, setShowLangSubmenu] = useState(false)
  const profileTriggerRef = useRef(null)
  const profileDropdownRef = useRef(null)

  // Click outside and Escape handling for profile dropdown
  useEffect(() => {
    if (!profileOpen) return
    const handleClickOutside = (e) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target) &&
        profileTriggerRef.current &&
        !profileTriggerRef.current.contains(e.target)
      ) {
        setProfileOpen(false)
        setShowLangSubmenu(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        setShowLangSubmenu(false)
        profileTriggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileOpen])

  // Resolve user display info
  const displayName = userProfile?.full_name || userName || 'Anshuman Thakur'
  const displayEmail = userProfile?.email || 'anshuman@ip-sakti.gov.in'
  const displayPlan = userProfile?.plan || 'Individual'
  const userInitial = (displayName.trim() || 'A').charAt(0).toUpperCase()

  const DEFAULT_LANGS = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'kn', label: 'ಕನ್ನಡ' },
    { code: 'bn', label: 'বাংলা' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'mr', label: 'मराठी' },
    { code: 'gu', label: 'ગુજરાતી' },
    { code: 'ml', label: 'മലയാളം' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  ]
  const allLangs = (languages && languages.length > 0) ? languages : DEFAULT_LANGS
  const activeLang = currentLang || localStorage.getItem('ip_sakti_lang') || 'en'
  const currentLangObj = allLangs.find(l => l.code === activeLang) || allLangs[0]

  return (
    <>
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
          isFullyHidden ? 'ragvyn-sidebar--fully-hidden' : '',
          isMobile() && mobileOpen ? 'ragvyn-sidebar--mobile-open' : '',
          isMobile() && !mobileOpen ? 'ragvyn-sidebar--mobile-hidden' : '',
        ].filter(Boolean).join(' ')}
        aria-label="Main navigation"
        role="navigation"
        aria-hidden={isFullyHidden ? 'true' : undefined}
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

          {/* Search Tasks button */}
          <ul className="ragvyn-sidebar__nav-list" role="list" style={{ marginTop: '2px' }}>
            <li className="ragvyn-sidebar__nav-item">
              <button
                ref={searchBtnRef}
                type="button"
                className={[
                  'ragvyn-sidebar__nav-btn',
                  searchOpen ? 'ragvyn-sidebar__nav-btn--active' : '',
                ].filter(Boolean).join(' ')}
                onClick={toggleSearch}
                title={collapsed && !isMobile() ? 'Search Tasks' : undefined}
                aria-label="Search Tasks"
                aria-expanded={searchOpen}
              >
                <span className="ragvyn-sidebar__nav-icon"><IconSearch size={20} /></span>
                {isExpanded && <span className="ragvyn-sidebar__nav-label">Search Tasks</span>}
              </button>
            </li>
          </ul>
        </nav>

        {/* ---- Search Input (collapsible) ---- */}
        {isExpanded && searchOpen && (
          <div className="ragvyn-sidebar__search-panel" role="search" aria-label="Task search">
            <div className="ragvyn-sidebar__search-input-wrap">
              <span className="ragvyn-sidebar__search-inner-icon" aria-hidden="true">
                <IconSearch size={14} />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                className="ragvyn-sidebar__search-input"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search task history"
                autoComplete="off"
                spellCheck="false"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ragvyn-sidebar__search-clear-btn"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <IconX size={13} />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="ragvyn-sidebar__search-meta">
                <span>{filteredSessions.length} {filteredSessions.length === 1 ? 'task found' : 'tasks found'}</span>
              </div>
            )}
          </div>
        )}

        {/* ---- Recents ---- */}
        {isExpanded && (
          <div className="ragvyn-sidebar__recents">
            <div className="ragvyn-sidebar__recents-heading">
              {searchOpen && searchQuery ? 'Search Results' : 'Recent Tasks'}
            </div>
            <div className="ragvyn-sidebar__recents-list">
              {loadingSessions && (
                <div className="ragvyn-sidebar__recents-empty">Loading…</div>
              )}
              {!loadingSessions && filteredSessions.length === 0 && (
                <div className="ragvyn-sidebar__recents-empty">
                  {searchOpen && searchQuery ? (
                    <div className="ragvyn-sidebar__search-empty-state">
                      <p>No tasks matching &ldquo;{searchQuery}&rdquo;</p>
                      <button
                        type="button"
                        className="ragvyn-sidebar__search-clear-action"
                        onClick={() => {
                          setSearchQuery('')
                          searchInputRef.current?.focus()
                        }}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    'No recent tasks.'
                  )}
                </div>
              )}
              {!loadingSessions && filteredSessions.map(s => (
                <div
                  key={s.id}
                  className={[
                    'ragvyn-sidebar__recent-row',
                    effectiveActiveId === s.id ? 'ragvyn-sidebar__recent-row--active' : '',
                    deletingSessionId === s.id ? 'ragvyn-sidebar__recent-row--deleting' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <button
                    type="button"
                    className={[
                      'ragvyn-sidebar__recent-item',
                      effectiveActiveId === s.id ? 'ragvyn-sidebar__recent-item--active' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleSessionClick(s.id)}
                    title={s.title}
                    aria-label={`Open task: ${s.title}`}
                    aria-current={effectiveActiveId === s.id ? 'true' : undefined}
                    disabled={deletingSessionId === s.id}
                  >
                    <span className="ragvyn-sidebar__recent-icon">
                      <IconMessageSquare size={16} />
                    </span>
                    <span className="ragvyn-sidebar__recent-title">{s.title}</span>
                  </button>

                  <button
                    type="button"
                    className="ragvyn-sidebar__delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      promptDeleteSession(s)
                    }}
                    aria-label={`Delete task: ${s.title}`}
                    title="Delete task"
                    disabled={deletingSessionId === s.id}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsed-mode icon rail removed — sidebar is fully hidden when collapsed */}

        {/* ---- Spacer ---- */}
        <div className="ragvyn-sidebar__spacer" />

        {/* ---- Bottom Section ---- */}
        <div className="ragvyn-sidebar__bottom">
          {/* Bottom icons row */}
          <div className="ragvyn-sidebar__bottom-row">
            {/* User profile trigger */}
            <button
              ref={profileTriggerRef}
              type="button"
              className={`ragvyn-sidebar__profile-trigger ${profileOpen ? 'ragvyn-sidebar__profile-trigger--active' : ''}`}
              onClick={() => setProfileOpen(prev => !prev)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label={`User profile menu for ${displayName}`}
              title={!isExpanded ? `${displayName} (${displayPlan})` : undefined}
            >
              <span className="ragvyn-sidebar__avatar-circle">
                {userInitial}
              </span>
              {isExpanded && (
                <div className="ragvyn-sidebar__user-info">
                  <span className="ragvyn-sidebar__user-name">{displayName}</span>
                  <span className="ragvyn-sidebar__user-role">{displayPlan}</span>
                </div>
              )}
            </button>

            {/* Quick options grid icon (visible when expanded) */}
            {isExpanded && (
              <button
                type="button"
                className="ragvyn-sidebar__bottom-icon-btn"
                title="Options"
                aria-label="Options"
                onClick={() => setProfileOpen(prev => !prev)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
            )}

            {/* Help */}
            <button
              type="button"
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

          {/* Profile Dropdown anchored above lower-left profile area */}
          {profileOpen && (
            <div
              ref={profileDropdownRef}
              className="ragvyn-profile-dropdown"
              role="menu"
              aria-label="User profile options"
            >
              <div className="ragvyn-profile-dropdown__header">
                <div className="ragvyn-profile-dropdown__name">{displayName}</div>
                {displayEmail && (
                  <div className="ragvyn-profile-dropdown__email">{displayEmail}</div>
                )}
                <span className="ragvyn-profile-dropdown__plan-badge">{displayPlan}</span>
              </div>

              <div className="ragvyn-profile-dropdown__divider" />

              <div className="ragvyn-profile-dropdown__menu">
                {/* Credits (informative tier indicator) */}
                <div
                  className="ragvyn-profile-dropdown__item ragvyn-profile-dropdown__item--disabled"
                  role="menuitem"
                  title="Standard AYUSH Institutional Research Tier"
                >
                  <span className="ragvyn-profile-dropdown__icon"><IconZap size={16} /></span>
                  <span className="ragvyn-profile-dropdown__label">Credits</span>
                  <span className="ragvyn-profile-dropdown__badge">Unlimited</span>
                </div>

                {/* Account */}
                <button
                  type="button"
                  className="ragvyn-profile-dropdown__item"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false)
                    navigate('/pricing')
                    if (isMobile()) closeMobile()
                  }}
                >
                  <span className="ragvyn-profile-dropdown__icon"><IconUser size={16} /></span>
                  <span className="ragvyn-profile-dropdown__label">Account</span>
                </button>

                {/* History */}
                <button
                  type="button"
                  className="ragvyn-profile-dropdown__item"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false)
                    navigate('/chat')
                    if (isMobile()) closeMobile()
                  }}
                >
                  <span className="ragvyn-profile-dropdown__icon"><IconScroll size={16} /></span>
                  <span className="ragvyn-profile-dropdown__label">History</span>
                </button>

                {/* Language with right-facing chevron */}
                <div className="ragvyn-profile-dropdown__lang-container">
                  <button
                    type="button"
                    className="ragvyn-profile-dropdown__item"
                    role="menuitem"
                    onClick={() => setShowLangSubmenu(prev => !prev)}
                    aria-expanded={showLangSubmenu}
                  >
                    <span className="ragvyn-profile-dropdown__icon"><IconGlobe size={16} /></span>
                    <span className="ragvyn-profile-dropdown__label">Language</span>
                    <span className="ragvyn-profile-dropdown__sub-value">{currentLangObj?.label || 'English'}</span>
                    <span className={`ragvyn-profile-dropdown__chevron ${showLangSubmenu ? 'open' : ''}`}>
                      <IconChevronRight size={14} />
                    </span>
                  </button>

                  {showLangSubmenu && (
                    <div className="ragvyn-profile-dropdown__lang-submenu">
                      {allLangs.map(l => (
                        <button
                          key={l.code}
                          type="button"
                          className={`ragvyn-profile-dropdown__lang-option ${l.code === activeLang ? 'active' : ''}`}
                          onClick={() => {
                            if (onSetLang) {
                              onSetLang(l.code)
                            } else {
                              localStorage.setItem('ip_sakti_lang', l.code)
                              document.documentElement.setAttribute('lang', l.code)
                            }
                            setShowLangSubmenu(false)
                          }}
                        >
                          <span>{l.label}</span>
                          {l.code === activeLang && <IconCheck size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="ragvyn-profile-dropdown__divider" />

              {/* Logout in red (or Sign in if unauthenticated) */}
              <div className="ragvyn-profile-dropdown__footer">
                {isLoggedIn !== false ? (
                  <button
                    type="button"
                    className="ragvyn-profile-dropdown__item ragvyn-profile-dropdown__item--logout"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false)
                      if (onLogout) onLogout()
                      navigate('/')
                      if (isMobile()) closeMobile()
                    }}
                  >
                    <span className="ragvyn-profile-dropdown__icon"><IconLogout size={16} /></span>
                    <span className="ragvyn-profile-dropdown__label">Logout</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ragvyn-profile-dropdown__item"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false)
                      navigate('/auth')
                      if (isMobile()) closeMobile()
                    }}
                  >
                    <span className="ragvyn-profile-dropdown__icon"><IconLogout size={16} /></span>
                    <span className="ragvyn-profile-dropdown__label">Sign In</span>
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </aside>

      {/* Confirmation Modal */}
      {confirmModal.open && confirmModal.session && (
        <div
          className="ragvyn-delete-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal()
          }}
          role="presentation"
        >
          <div
            ref={dialogRef}
            className="ragvyn-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ragvyn-delete-modal-title"
            aria-describedby="ragvyn-delete-modal-desc"
          >
            <div className="ragvyn-delete-modal__header">
              <div className="ragvyn-delete-modal__icon-wrap" aria-hidden="true">
                <IconTrash size={20} />
              </div>
              <h3 id="ragvyn-delete-modal-title" className="ragvyn-delete-modal__title">
                Delete Task
              </h3>
            </div>

            <div className="ragvyn-delete-modal__body">
              <p id="ragvyn-delete-modal-desc" className="ragvyn-delete-modal__warning">
                Are you sure you want to delete <strong className="ragvyn-delete-modal__task-title">&ldquo;{confirmModal.session.title}&rdquo;</strong>?
              </p>
              <p className="ragvyn-delete-modal__sub-warning">
                Its messages, legal citations, and saved history will be permanently removed. This action cannot be undone.
              </p>

              {confirmModal.error && (
                <div className="ragvyn-delete-modal__error" role="alert">
                  {confirmModal.error}
                </div>
              )}
            </div>

            <div className="ragvyn-delete-modal__actions">
              <button
                ref={cancelBtnRef}
                type="button"
                className="ragvyn-delete-modal__btn ragvyn-delete-modal__btn--cancel"
                onClick={closeDeleteModal}
                disabled={confirmModal.isDeleting}
              >
                Cancel
              </button>
              <button
                ref={deleteBtnRef}
                type="button"
                className="ragvyn-delete-modal__btn ragvyn-delete-modal__btn--delete"
                onClick={executeDelete}
                disabled={confirmModal.isDeleting}
                aria-busy={confirmModal.isDeleting}
              >
                {confirmModal.isDeleting ? (
                  <>
                    <span className="ragvyn-delete-modal__spinner" aria-hidden="true" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transient Success Toast */}
      {toastMessage && (
        <div className="ragvyn-sidebar__toast" role="status" aria-live="polite">
          <IconCheck size={14} />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  )
}
