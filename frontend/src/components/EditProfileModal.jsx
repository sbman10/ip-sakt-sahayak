import React, { useState, useEffect } from 'react'
import { getApiBase } from '../api/config'

export default function EditProfileModal({ isOpen, onClose, onUserUpdated }) {
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [organization, setOrganization] = useState('')
  const [phone, setPhone] = useState('')
  const [previewError, setPreviewError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  useEffect(() => {
    if (!isOpen) return

    // Load current user data from localStorage
    try {
      const rawUser = localStorage.getItem('ip_sakti_user')
      const storedName = localStorage.getItem('ip_sakti_user_name') || ''
      if (rawUser) {
        const u = JSON.parse(rawUser)
        setFullName(u.full_name || storedName || '')
        setAvatarUrl(u.avatar_url || '')
        setOrganization(u.organization || '')
        setPhone(u.phone || '')
      } else {
        setFullName(storedName || '')
        setAvatarUrl('')
        setOrganization('')
        setPhone('')
      }
    } catch {
      setFullName(localStorage.getItem('ip_sakti_user_name') || '')
    }

    setPreviewError(false)
    setStatusMessage(null)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getInitial = () => {
    return (fullName.trim() || 'U').charAt(0).toUpperCase()
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setStatusMessage({ type: 'error', text: 'Name is required' })
      return
    }

    setSaving(true)
    setStatusMessage(null)

    const finalName = fullName.trim()
    const finalAvatar = avatarUrl.trim() || null
    const finalOrg = organization.trim() || null
    const finalPhone = phone.trim() || null

    try {
      // 1. Update localStorage
      localStorage.setItem('ip_sakti_user_name', finalName)

      let currentUser = {}
      try {
        const raw = localStorage.getItem('ip_sakti_user')
        if (raw) currentUser = JSON.parse(raw)
      } catch {
        currentUser = {}
      }

      const updatedUser = {
        ...currentUser,
        full_name: finalName,
        avatar_url: finalAvatar,
        organization: finalOrg,
        phone: finalPhone,
      }
      const serialized = JSON.stringify(updatedUser)
      if (sessionStorage.getItem('ip_sakti_user')) {
        sessionStorage.setItem('ip_sakti_user', serialized)
      }
      if (localStorage.getItem('ip_sakti_user') || localStorage.getItem('ragvyn_remember_me') === 'true') {
        localStorage.setItem('ip_sakti_user', serialized)
      }

      // 2. If access token exists, update backend profile & user
      const token = sessionStorage.getItem('ip_sakti_access_token') || localStorage.getItem('ip_sakti_access_token')
      if (token) {
        try {
          const API_BASE = getApiBase()
          // Update database Profile model
          await fetch(`${API_BASE}/api/profile`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              full_name: finalName,
              avatar_url: finalAvatar,
            }),
          }).catch(() => {})

          // Update legacy User model for backward compatibility
          await fetch(`${API_BASE}/api/auth/me`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              full_name: finalName,
              avatar_url: finalAvatar,
              organization: finalOrg,
              phone: finalPhone,
            }),
          }).catch(() => {})
        } catch (apiErr) {
          console.warn('Backend profile patch failed, saved locally:', apiErr)
        }
      }

      // 3. Dispatch global sync event
      window.dispatchEvent(
        new CustomEvent('ip-sakti-user-updated', {
          detail: updatedUser,
        })
      )

      if (onUserUpdated) {
        onUserUpdated(updatedUser)
      }

      setStatusMessage({ type: 'success', text: 'Profile updated successfully!' })
      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setStatusMessage({ type: 'error', text: 'Failed to save changes. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="gov-profile-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <div className="gov-profile-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="gov-profile-modal-header">
          <div className="gov-profile-modal-title-group">
            <h3 id="edit-profile-title" className="gov-profile-modal-title">Edit Profile</h3>
            <span className="gov-profile-modal-subtitle">Manage your personal details and avatar</span>
          </div>
          <button
            type="button"
            className="gov-profile-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Live Avatar Preview */}
        <div className="gov-profile-preview-card">
          <div className="gov-profile-preview-avatar-wrap">
            {avatarUrl.trim() && !previewError ? (
              <img
                src={avatarUrl.trim()}
                alt={fullName || 'Avatar preview'}
                className="gov-profile-preview-img"
                onError={() => setPreviewError(true)}
              />
            ) : (
              <div className="gov-profile-preview-fallback">
                {getInitial()}
              </div>
            )}
          </div>
          <div className="gov-profile-preview-info">
            <span className="gov-profile-preview-name">{fullName.trim() || 'Innovator Name'}</span>
            <span className="gov-profile-preview-sub">
              {organization.trim() ? organization.trim() : 'Ayurveda IP Innovator'}
            </span>
            {avatarUrl.trim() && (
              <button
                type="button"
                className="gov-profile-remove-avatar-btn"
                onClick={() => {
                  setAvatarUrl('')
                  setPreviewError(false)
                }}
              >
                Reset to Initial Fallback
              </button>
            )}
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`gov-profile-status-alert ${statusMessage.type}`}>
            {statusMessage.type === 'success' ? '✓ ' : '⚠ '}
            {statusMessage.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="gov-profile-modal-form">
          <div className="gov-profile-form-group">
            <label htmlFor="gov-profile-name">
              Full Name <span className="gov-profile-required">*</span>
            </label>
            <input
              id="gov-profile-name"
              type="text"
              className="gov-profile-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Gautam Sharma"
              required
              disabled={saving}
            />
          </div>

          <div className="gov-profile-form-group">
            <label htmlFor="gov-profile-avatar">
              Profile Image URL
            </label>
            <input
              id="gov-profile-avatar"
              type="url"
              className="gov-profile-input"
              value={avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value)
                setPreviewError(false)
              }}
              placeholder="https://example.com/avatar.jpg"
              disabled={saving}
            />
            <span className="gov-profile-field-hint">
              Paste a public image link (PNG, JPG, or WebP). If left empty, your initials will be displayed.
            </span>
          </div>

          <div className="gov-profile-form-row">
            <div className="gov-profile-form-group">
              <label htmlFor="gov-profile-org">Organization / Firm</label>
              <input
                id="gov-profile-org"
                type="text"
                className="gov-profile-input"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. AYUSH Research Labs"
                disabled={saving}
              />
            </div>

            <div className="gov-profile-form-group">
              <label htmlFor="gov-profile-phone">Phone Number</label>
              <input
                id="gov-profile-phone"
                type="tel"
                className="gov-profile-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                disabled={saving}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="gov-profile-modal-actions">
            <button
              type="button"
              className="gov-profile-btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="gov-profile-btn-save"
              disabled={saving || !fullName.trim()}
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
