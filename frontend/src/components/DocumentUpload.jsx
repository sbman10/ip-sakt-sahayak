import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconHome,
  IconFolder,
  IconScroll,
  IconLock,
  IconX,
  IconChevronRight,
} from './Icons'
import { getApiBase } from '../api/config'
import './DocumentUpload.css'

const API_BASE = getApiBase()
const TOKEN_KEY = 'ip_sakti_access_token'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/* ============================================================
   INLINE SVG ICONS (NO EXTERNAL RUNTIME DEPENDENCY)
   ============================================================ */
const IconLibrary = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h6" /><path d="M8 11h8" />
  </svg>
)

const IconCloudUp = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 16l-4-4-4 4" />
    <path d="M12 12v9" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
)

const IconPdf = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 15h2a1.5 1.5 0 0 0 0-3H9v6" />
  </svg>
)

const IconTrash = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const IconRefresh = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const IconSearch = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const IconCheckCircle = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const IconAlertTriangle = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const IconClock = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const IconDatabase = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
)

const IconSparkles = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
)

const IconGrid = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
)

const IconList = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const IconFileText = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
)

/* ============================================================
   HELPER UTILITIES
   ============================================================ */
function authHeaders(json = true) {
  const token = localStorage.getItem(TOKEN_KEY)
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
}

function formatDate(isoString) {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return isoString
  }
}

function getStatusDetails(status) {
  switch (status) {
    case 'completed':
      return {
        label: 'Indexed',
        className: 'completed',
        icon: <IconCheckCircle size={13} />,
      }
    case 'processing':
      return {
        label: 'Processing',
        className: 'processing',
        icon: <span className="doc-loading-spinner" style={{ width: 11, height: 11, borderWidth: 2 }} />,
      }
    case 'failed':
      return {
        label: 'Failed',
        className: 'failed',
        icon: <IconAlertTriangle size={13} />,
      }
    default:
      return {
        label: 'Pending',
        className: 'pending',
        icon: <IconClock size={13} />,
      }
  }
}

/* ============================================================
   MAIN COMPONENT: DOCUMENT UPLOAD / PRIVATE IP DOCUMENT LIBRARY
   ============================================================ */
export default function DocumentUpload() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastSync, setLastSync] = useState('Just now')

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadingName, setUploadingName] = useState('')

  /* Workspace Filters & View state */
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'

  const inputRef = useRef(null)

  /* ---------------- data loading ---------------- */
  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/documents`, { headers: authHeaders() })
      if (!res.ok) {
        let detail = `Failed to load documents (${res.status})`
        try { const j = await res.json(); detail = j.detail || detail } catch { /* noop */ }
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  /* ---------------- upload handler ---------------- */
  const uploadFile = useCallback((file) => {
    setError('')
    setNotice('')

    // Client-side validation
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Only PDF files are accepted.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 10MB.')
      return
    }

    setUploading(true)
    setUploadingName(file.name)
    setProgress(0)

    const form = new FormData()
    form.append('file', file)

    // XHR is used (not fetch) so we get a real upload progress bar
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/documents/upload`)
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    }

    xhr.onload = () => {
      setUploading(false)
      setUploadingName('')
      setProgress(0)
      if (xhr.status >= 200 && xhr.status < 300) {
        let msg = 'Document ingested successfully.'
        try { const j = JSON.parse(xhr.responseText); msg = j.message || msg } catch { /* noop */ }
        setNotice(msg)
        loadDocuments()
      } else {
        let detail = `Upload failed (${xhr.status})`
        try { const j = JSON.parse(xhr.responseText); detail = j.detail || detail } catch { /* noop */ }
        setError(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setUploadingName('')
      setProgress(0)
      setError('Network error during upload. Is the backend running?')
    }

    xhr.send(form)
  }, [loadDocuments])

  /* ---------------- drag & drop handlers ---------------- */
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    if (!uploading) setDragging(true)
  }

  const onDragLeave = (e) => {
    e.preventDefault()
    setDragging(false)
  }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = '' // allow re-selecting same file
  }

  /* ---------------- delete handler ---------------- */
  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.original_filename}"? Its indexed chunks will be removed from your AI knowledge base.`)) {
      return
    }
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/documents/${doc.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) {
        let detail = `Delete failed (${res.status})`
        try { const j = await res.json(); detail = j.detail || detail } catch { /* noop */ }
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
      }
      setNotice(`"${doc.original_filename}" deleted successfully.`)
      loadDocuments()
    } catch (e) {
      setError(e.message)
    }
  }

  /* ---------------- derived metrics ---------------- */
  const metrics = useMemo(() => {
    const total = documents.length
    const indexed = documents.filter((d) => d.processing_status === 'completed').length
    const processing = documents.filter(
      (d) => d.processing_status === 'processing' || d.processing_status === 'pending'
    ).length
    const failed = documents.filter((d) => d.processing_status === 'failed').length
    const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0)

    return { total, indexed, processing, failed, totalChunks }
  }, [documents])

  /* ---------------- filtered & sorted documents ---------------- */
  const filteredDocuments = useMemo(() => {
    let result = [...documents]

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((d) => d.processing_status === statusFilter)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((d) =>
        (d.original_filename || '').toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0)
      }
      if (sortBy === 'name') {
        return (a.original_filename || '').localeCompare(b.original_filename || '')
      }
      if (sortBy === 'size') {
        return (b.file_size || 0) - (a.file_size || 0)
      }
      return 0
    })

    return result
  }, [documents, statusFilter, searchQuery, sortBy])

  /* ---------------- render ---------------- */
  return (
    <div className="doc-page">
      {/* Top Utility Strip */}
      <div className="doc-top-strip">
        <div className="doc-breadcrumbs">
          <Link to="/" className="doc-breadcrumb-link">
            <IconHome size={14} />
            <span>IP-SAKTI Portal</span>
          </Link>
          <span className="doc-breadcrumb-sep">/</span>
          <span className="doc-breadcrumb-active">My Documents</span>
        </div>
        <div className="doc-top-actions">
          <Link to="/workspace" className="doc-portal-link" title="Matter Workspace">
            <IconFolder size={14} />
            <span>Matter Workspace</span>
          </Link>
          <Link to="/drafts" className="doc-portal-link" title="Draft Generator">
            <IconScroll size={14} />
            <span>Draft Generator</span>
          </Link>
          <Link to="/chat" className="doc-portal-link" title="Ask RagVyn AI">
            <IconSparkles size={14} />
            <span>Ask RagVyn AI</span>
          </Link>
        </div>
      </div>

      <div className="doc-container">
        {/* 1. PAGE HEADER */}
        <header className="doc-header">
          <div className="doc-header-left">
            <div className="doc-header-icon-box" title="Private Document Library">
              <IconLibrary size={24} />
            </div>
            <div className="doc-header-titles">
              <h1>My Documents</h1>
              <p className="doc-header-subtitle">
                Upload and manage your private IP documents for AI-powered search, prior-art validation, and consultation.
              </p>
              <div className="doc-header-sync">
                <span className="doc-pulse-dot" />
                <span>Last synchronized: {lastSync}</span>
              </div>
            </div>
          </div>

          <div className="doc-header-right">
            <button
              type="button"
              className={`doc-btn-refresh ${loading ? 'spinning' : ''}`}
              onClick={loadDocuments}
              title="Refresh document library"
              aria-label="Refresh document library"
            >
              <IconRefresh size={18} />
            </button>
            <button
              type="button"
              className="doc-btn-primary"
              onClick={() => !uploading && inputRef.current?.click()}
              title="Upload PDF Document"
            >
              <IconPlus size={16} />
              <span>Upload Document</span>
            </button>
          </div>
        </header>

        {/* 2. SUMMARY METRICS ROW */}
        <section className="doc-summary-grid" aria-label="Library Overview Statistics">
          {/* Card 1: Total Documents */}
          <div
            className={`doc-stat-card ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
            role="button"
            tabIndex={0}
            title="Show all documents"
          >
            <div className="doc-stat-header">
              <span className="doc-stat-label">Total Documents</span>
              <div className="doc-stat-icon-wrap purple">
                <IconLibrary size={16} />
              </div>
            </div>
            <div className="doc-stat-value">{metrics.total}</div>
            <div className="doc-stat-subtext">
              <span>Private library documents</span>
            </div>
          </div>

          {/* Card 2: Indexed */}
          <div
            className={`doc-stat-card ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
            role="button"
            tabIndex={0}
            title="Filter by Indexed documents"
          >
            <div className="doc-stat-header">
              <span className="doc-stat-label">Indexed for AI</span>
              <div className="doc-stat-icon-wrap green">
                <IconCheckCircle size={16} />
              </div>
            </div>
            <div className="doc-stat-value">{metrics.indexed}</div>
            <div className="doc-stat-subtext">
              <span>Ready for vector retrieval</span>
            </div>
          </div>

          {/* Card 3: Processing */}
          <div
            className={`doc-stat-card ${statusFilter === 'processing' ? 'active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'processing' ? 'all' : 'processing')}
            role="button"
            tabIndex={0}
            title="Filter by Processing documents"
          >
            <div className="doc-stat-header">
              <span className="doc-stat-label">Processing</span>
              <div className="doc-stat-icon-wrap amber">
                <IconClock size={16} />
              </div>
            </div>
            <div className="doc-stat-value">{metrics.processing}</div>
            <div className="doc-stat-subtext">
              <span>Parsing or embedding</span>
            </div>
          </div>

          {/* Card 4: Indexed Chunks or Needs Attention */}
          {metrics.failed > 0 ? (
            <div
              className={`doc-stat-card ${statusFilter === 'failed' ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
              role="button"
              tabIndex={0}
              title="Filter by Failed documents"
            >
              <div className="doc-stat-header">
                <span className="doc-stat-label">Needs Attention</span>
                <div className="doc-stat-icon-wrap red">
                  <IconAlertTriangle size={16} />
                </div>
              </div>
              <div className="doc-stat-value">{metrics.failed}</div>
              <div className="doc-stat-subtext">
                <span>Failed or unreadable PDFs</span>
              </div>
            </div>
          ) : (
            <div className="doc-stat-card" style={{ cursor: 'default' }}>
              <div className="doc-stat-header">
                <span className="doc-stat-label">Indexed Chunks</span>
                <div className="doc-stat-icon-wrap blue">
                  <IconDatabase size={16} />
                </div>
              </div>
              <div className="doc-stat-value">{metrics.totalChunks}</div>
              <div className="doc-stat-subtext">
                <span>Total vector knowledge segments</span>
              </div>
            </div>
          )}
        </section>

        {/* 3. UPLOAD AREA (PREMIUM UPLOAD CARD) */}
        <section className="doc-upload-section">
          <div
            className={`doc-upload-card ${dragging ? 'dragging' : ''} ${uploading ? 'uploading-state' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                inputRef.current?.click()
              }
            }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            aria-label="Upload a PDF document"
          >
            {uploading ? (
              <div className="doc-progress-box">
                <div className="doc-progress-file-info">
                  <IconPdf size={18} />
                  <span className="doc-progress-filename">{uploadingName}</span>
                </div>
                <div className="doc-progress-bar-track">
                  <div
                    className="doc-progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="doc-progress-status-row">
                  <span>
                    {progress < 100
                      ? 'Uploading document to secure vault…'
                      : 'Processing on server (parsing text + generating vector embeddings)…'}
                  </span>
                  <span>{progress}%</span>
                </div>
              </div>
            ) : (
              <>
                <div className="doc-upload-icon-container">
                  <IconCloudUp size={36} />
                </div>
                <h3 className="doc-upload-title">Upload your documents</h3>
                <p className="doc-upload-desc">
                  Drag &amp; drop a PDF here, or <span className="doc-upload-browse-btn">browse from your device</span>
                </p>
                <div className="doc-upload-restrictions">
                  <span>PDF only</span>
                  <span>•</span>
                  <span>Maximum 10 MB</span>
                  <span>•</span>
                  <span>Indexed for AI search</span>
                </div>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={onPick}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="doc-alert error" role="alert">
              <span className="doc-alert-icon">
                <IconAlertTriangle size={18} />
              </span>
              <div className="doc-alert-content">{error}</div>
              <button
                type="button"
                className="doc-alert-close"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <IconX size={14} />
              </button>
            </div>
          )}

          {notice && !error && (
            <div className="doc-alert success" role="status">
              <span className="doc-alert-icon">
                <IconCheckCircle size={18} />
              </span>
              <div className="doc-alert-content">{notice}</div>
              <button
                type="button"
                className="doc-alert-close"
                onClick={() => setNotice('')}
                aria-label="Dismiss notification"
              >
                <IconX size={14} />
              </button>
            </div>
          )}
        </section>

        {/* 8. AI KNOWLEDGE CONNECTION (INFO CARD) */}
        <section className="doc-ai-info-card" aria-label="AI Knowledge Base Information">
          <div className="doc-ai-info-icon">
            <IconSparkles size={20} />
          </div>
          <div className="doc-ai-info-text">
            <h4 className="doc-ai-info-title">
              Your Private AI Knowledge Base
            </h4>
            <p className="doc-ai-info-desc">
              Uploaded documents are parsed, chunked with semantic sliding windows, and embedded into a private vector collection scoped exclusively to your account. They are securely referenced during AI consultations and draft generation to provide grounded, citation-backed legal responses.
            </p>
            <div className="doc-ai-pills">
              <span className="doc-ai-pill">
                <IconLock size={12} style={{ marginRight: 4 }} />
                <span>End-to-End Private</span>
              </span>
              <span className="doc-ai-pill">
                <IconSparkles size={12} style={{ marginRight: 4 }} />
                <span>Semantic Chunking</span>
              </span>
              <span className="doc-ai-pill">
                <IconCheckCircle size={12} style={{ marginRight: 4 }} />
                <span>Bi-Encoder Vector Embeddings</span>
              </span>
            </div>
          </div>
        </section>

        {/* 4. WORKSPACE DOCUMENT SECTION */}
        <section className="doc-section" aria-label="Document Workspace">
          <div className="doc-section-header">
            <div className="doc-section-title-wrap">
              <h2 className="doc-section-title">Your Documents</h2>
              <span className="doc-count-badge">
                {filteredDocuments.length}{filteredDocuments.length !== documents.length ? ` of ${documents.length}` : ''}
              </span>
            </div>

            {/* Workspace Controls: Search, Filter, Sort, View Toggle */}
            <div className="doc-toolbar">
              <div className="doc-search-box">
                <span className="doc-search-icon">
                  <IconSearch size={15} />
                </span>
                <input
                  type="text"
                  className="doc-search-input"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search documents by name"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="doc-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>

              <select
                className="doc-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter documents by status"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Indexed</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>

              <select
                className="doc-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort documents"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name (A–Z)</option>
                <option value="size">File Size</option>
              </select>

              <div className="doc-view-toggle">
                <button
                  type="button"
                  className={`doc-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <IconGrid size={16} />
                </button>
                <button
                  type="button"
                  className={`doc-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                  aria-label="List view"
                >
                  <IconList size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* 5, 6 & 7. DOCUMENT PRESENTATION & EMPTY STATES */}
          {loading ? (
            <div className="doc-loading-state">
              <div className="doc-loading-spinner" />
              <span>Loading documents…</span>
            </div>
          ) : documents.length === 0 ? (
            /* 7. EMPTY STATE - NO DOCUMENTS UPLOADED */
            <div className="doc-empty-card">
              <div className="doc-empty-icon-wrap">
                <IconLibrary size={32} />
              </div>
              <h3 className="doc-empty-title">Your document library is empty</h3>
              <p className="doc-empty-desc">
                Upload your first IP document to make it searchable during your AI consultations and matter analysis.
              </p>
              <button
                type="button"
                className="doc-btn-primary"
                onClick={() => !uploading && inputRef.current?.click()}
              >
                <IconPlus size={16} />
                <span>Upload your first document</span>
              </button>
              <div className="doc-empty-guidelines">
                PDF only • Maximum 10 MB • Instant text extraction &amp; vector indexing
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            /* EMPTY STATE - NO MATCHES FOR SEARCH/FILTER */
            <div className="doc-empty-card" style={{ padding: '40px 20px' }}>
              <div className="doc-empty-icon-wrap" style={{ width: 50, height: 50 }}>
                <IconSearch size={24} />
              </div>
              <h3 className="doc-empty-title" style={{ fontSize: 18 }}>No documents found</h3>
              <p className="doc-empty-desc">
                No documents match your current search query or filter selection.
              </p>
              <button
                type="button"
                className="doc-btn-primary"
                style={{ padding: '8px 18px', fontSize: 13 }}
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
              >
                Reset filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* 6. DOCUMENT GRID VIEW */
            <div className="doc-grid">
              {filteredDocuments.map((doc) => {
                const status = getStatusDetails(doc.processing_status)
                return (
                  <article key={doc.id} className="doc-card">
                    <div>
                      <div className="doc-card-top">
                        <div className="doc-pdf-badge" title="PDF Document">
                          <IconPdf size={22} />
                        </div>
                        <span className={`doc-status-badge ${status.className}`}>
                          {status.icon}
                          <span>{status.label}</span>
                        </span>
                      </div>

                      <h3 className="doc-card-name" title={doc.original_filename}>
                        {doc.original_filename}
                      </h3>

                      <div className="doc-card-meta-list">
                        <span className="doc-meta-item">
                          {formatSize(doc.file_size)}
                        </span>
                        <span className="doc-chunk-chip">
                          <IconDatabase size={11} />
                          <span>{doc.chunk_count || 0} chunk{doc.chunk_count === 1 ? '' : 's'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="doc-card-footer">
                      <div className="doc-added-time" title={`Uploaded: ${doc.created_at}`}>
                        <IconClock size={12} />
                        <span>Added {formatDate(doc.created_at)}</span>
                      </div>

                      <div className="doc-actions">
                        <button
                          type="button"
                          className="doc-btn-delete"
                          onClick={() => handleDelete(doc)}
                          title={`Delete ${doc.original_filename}`}
                          aria-label={`Delete ${doc.original_filename}`}
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            /* 5. DOCUMENT LIST VIEW (ROWS) */
            <div className="doc-list">
              {filteredDocuments.map((doc) => {
                const status = getStatusDetails(doc.processing_status)
                return (
                  <div key={doc.id} className="doc-row">
                    <div className="doc-row-icon" title="PDF Document">
                      <IconPdf size={20} />
                    </div>

                    <div className="doc-row-main">
                      <div className="doc-row-title" title={doc.original_filename}>
                        {doc.original_filename}
                      </div>
                      <div className="doc-row-subtext">
                        <span>{formatSize(doc.file_size)}</span>
                        <span>•</span>
                        <span className="doc-chunk-chip">
                          <IconDatabase size={11} />
                          <span>{doc.chunk_count || 0} chunk{doc.chunk_count === 1 ? '' : 's'}</span>
                        </span>
                        <span>•</span>
                        <span>Added {formatDate(doc.created_at)}</span>
                      </div>
                    </div>

                    <div className="doc-row-status">
                      <span className={`doc-status-badge ${status.className}`}>
                        {status.icon}
                        <span>{status.label}</span>
                      </span>
                    </div>

                    <div className="doc-row-actions">
                      <button
                        type="button"
                        className="doc-btn-delete"
                        onClick={() => handleDelete(doc)}
                        title={`Delete ${doc.original_filename}`}
                        aria-label={`Delete ${doc.original_filename}`}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
