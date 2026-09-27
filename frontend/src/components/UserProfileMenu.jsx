import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// SVGs for menu items
const IconEditProfile = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
)

const IconConsultations = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </svg>
)

const IconStarPro = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const IconLogout = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const IconChevronDown = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export default function UserProfileMenu({
  userName,
  onLogout,
  onOpenEditProfile,
  compact = false,
}) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [imgError, setImgError] = useState(false)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)

  // Load user data from localStorage
  const loadUser = () => {
    try {
      const raw = localStorage.getItem('ip_sakti_user')
      if (raw) {
        const parsed = JSON.parse(raw)
        setUserProfile(parsed)
        return
      }
    } catch {
      // fallback
    }
    const name = localStorage.getItem('ip_sakti_user_name') || userName || ''
    setUserProfile({ full_name: name })
  }

  useEffect(() => {
    loadUser()
  }, [userName])

  // Listen for user updates across components
  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) {
        setUserProfile(e.detail)
        setImgError(false)
      } else {
        loadUser()
      }
    }
    window.addEventListener('ip-sakti-user-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('ip-sakti-user-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const displayName = userProfile?.full_name || userName || 'Innovator'
  const displayEmail = userProfile?.email || userProfile?.organization || 'Account'
  const avatarUrl = userProfile?.avatar_url
  const initial = (displayName.trim() || 'U').charAt(0).toUpperCase()

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
  }

  const handleEditProfile = () => {
    setIsOpen(false)
    if (onOpenEditProfile) {
      onOpenEditProfile()
    }
  }

  const handleMyConsultations = () => {
    setIsOpen(false)
    navigate('/chat')
  }

  const handleUpgradeToPro = () => {
    setIsOpen(false)
    navigate('/pricing')
  }

  const handleLogoutAction = () => {
    setIsOpen(false)
    if (onLogout) {
      onLogout()
    }
  }

  return (
    <div className={`gov-profile-menu-container ${compact ? 'compact' : ''}`} ref={menuRef}>
      {/* Profile Avatar Control */}
      <button
        ref={triggerRef}
        type="button"
        className={`gov-profile-avatar-control ${isOpen ? 'active' : ''} ${compact ? 'compact-control' : ''}`}
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`User profile for ${displayName}`}
        title={`Account: ${displayName}`}
      >
        <div className="gov-profile-avatar-circle">
          {avatarUrl && !imgError ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="gov-profile-avatar-img"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="gov-profile-avatar-initial">{initial}</span>
          )}
        </div>

        {!compact && (
          <div className="gov-profile-avatar-details">
            <span className="gov-profile-avatar-name">{displayName}</span>
            <IconChevronDown size={11} className={`gov-profile-chevron ${isOpen ? 'rotated' : ''}`} />
          </div>
        )}
      </button>

      {/* Profile Dropdown Popover */}
      {isOpen && (
        <div
          className="gov-profile-dropdown"
          role="menu"
          aria-label="User account menu"
        >
          {/* Top User Info Section */}
          <div className="gov-profile-dropdown-header">
            <div className="gov-profile-dropdown-avatar">
              {avatarUrl && !imgError ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="gov-profile-header-img"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="gov-profile-header-initial">{initial}</span>
              )}
            </div>
            <div className="gov-profile-dropdown-user-info">
              <span className="gov-profile-dropdown-name" title={displayName}>
                {displayName}
              </span>
              <span className="gov-profile-dropdown-sub" title={displayEmail}>
                {displayEmail}
              </span>
              <span className="gov-profile-status-badge">
                <span className="status-dot" />
                <span>Ayurveda Innovator</span>
              </span>
            </div>
          </div>

          <div className="gov-profile-menu-divider" />

          {/* Menu Actions */}
          <div className="gov-profile-menu-items">
            {/* Edit Profile */}
            <button
              type="button"
              role="menuitem"
              className="gov-profile-menu-item"
              onClick={handleEditProfile}
            >
              <span className="gov-profile-item-icon">
                <IconEditProfile size={16} />
              </span>
              <span className="gov-profile-item-label">Edit Profile</span>
            </button>

            {/* My Consultations */}
            <button
              type="button"
              role="menuitem"
              className="gov-profile-menu-item"
              onClick={handleMyConsultations}
            >
              <span className="gov-profile-item-icon">
                <IconConsultations size={16} />
              </span>
              <span className="gov-profile-item-label">My Consultations</span>
            </button>

            {/* Upgrade to Pro - Prominently Highlighted Promotional Action */}
            <button
              type="button"
              role="menuitem"
              className="gov-profile-menu-item gov-profile-pro-item"
              onClick={handleUpgradeToPro}
            >
              <div className="gov-profile-pro-left">
                <span className="gov-profile-pro-star">
                  <IconStarPro size={16} />
                </span>
                <span className="gov-profile-pro-label">Upgrade to Pro</span>
              </div>
              <span className="gov-profile-pro-badge">PRO</span>
            </button>
          </div>

          <div className="gov-profile-menu-divider" />

          {/* Logout Action */}
          <div className="gov-profile-menu-footer">
            <button
              type="button"
              role="menuitem"
              className="gov-profile-menu-item gov-profile-logout-item"
              onClick={handleLogoutAction}
            >
              <span className="gov-profile-item-icon">
                <IconLogout size={16} />
              </span>
              <span className="gov-profile-item-label">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
