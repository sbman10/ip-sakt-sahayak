import React, { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'ip_sakti_access_token'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/* ---------- inline icons (no external dependency) ---------- */
const IconCloudUp = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 16l-4-4-4 4" />
    <path d="M12 12v9" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    <path d="M16 16l-4-4-4 4" />
  </svg>
)
const IconPdf = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5" />
  </svg>
)
const IconTrashSm = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
)

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

function statusBadge(status) {
  const map = {
    completed: { label: 'Indexed', bg: '#dcfce7', fg: '#166534' },
    processing: { label: 'Processing', bg: '#fef9c3', fg: '#854d0e' },
    pending: { label: 'Pending', bg: '#e2e8f0', fg: '#475569' },
    failed: { label: 'Failed', bg: '#fee2e2', fg: '#991b1b' },
  }
  return map[status] || map.pending
}

export default function DocumentUpload() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadingName, setUploadingName] = useState('')

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
      setDocuments(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  /* ---------------- upload ---------------- */
  const uploadFile = useCallback((file) => {
    setError('')
    setNotice('')

    // client-side validation
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
  const onDragOver = (e) => { e.preventDefault(); if (!uploading) setDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false) }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = '' // allow re-selecting the same file
  }

  /* ---------------- delete ---------------- */
  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.original_filename}"? Its indexed chunks will be removed.`)) return
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
      setNotice('Document deleted.')
      loadDocuments()
    } catch (e) {
      setError(e.message)
    }
  }

  /* ---------------- render ---------------- */
  return (
    <div className="doc-upload-wrap" style={{ maxWidth: 860, margin: '0 auto', padding: '0 1rem' }}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) inputRef.current?.click() }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        aria-label="Upload a PDF document"
        style={{
          border: `2px dashed ${dragging ? 'var(--color-primary, #143D30)' : '#cbd5e1'}`,
          borderRadius: 16,
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragging ? 'var(--color-primary-light, #eaf2ed)' : 'var(--surface, #f8fafc)',
          transition: 'all .15s ease',
          outline: 'none',
        }}
      >
        <div style={{ color: 'var(--color-primary, #143D30)', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <IconCloudUp size={44} />
        </div>
        {uploading ? (
          <>
            <p style={{ fontWeight: 600, margin: '0 0 10px' }}>Uploading &amp; indexing “{uploadingName}”…</p>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', maxWidth: 420, margin: '0 auto' }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'var(--color-primary, #143D30)', transition: 'width .2s ease',
              }} />
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
              {progress < 100 ? `${progress}%` : 'Processing on server (parsing + embedding)…'}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 600, margin: '0 0 6px' }}>
              Drag &amp; drop a PDF here, or <span style={{ color: 'var(--color-primary, #143D30)', textDecoration: 'underline' }}>browse</span>
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>PDF only · max 10&nbsp;MB · indexed for AI search</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onPick}
          style={{ display: 'none' }}
        />
      </div>

      {/* Alerts */}
      {error && (
        <div role="alert" style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: '#fee2e2', color: '#991b1b', fontSize: 14,
        }}>{error}</div>
      )}
      {notice && !error && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: '#dcfce7', color: '#166534', fontSize: 14,
        }}>{notice}</div>
      )}

      {/* Document list */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
          Your Documents{documents.length ? ` (${documents.length})` : ''}
        </h3>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading…</p>
        ) : documents.length === 0 ? (
          <p style={{ color: '#64748b' }}>No documents uploaded yet. Upload a PDF to make it searchable in your consultations.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {documents.map((doc) => {
              const badge = statusBadge(doc.processing_status)
              return (
                <li key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 12,
                  background: 'var(--surface, #fff)',
                }}>
                  <span style={{ color: '#dc2626', display: 'flex', flexShrink: 0 }}><IconPdf size={24} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }} title={doc.original_filename}>{doc.original_filename}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {formatSize(doc.file_size)} · {doc.chunk_count} chunk{doc.chunk_count === 1 ? '' : 's'}
                      {' · '}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                    background: badge.bg, color: badge.fg, flexShrink: 0,
                  }}>{badge.label}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    aria-label={`Delete ${doc.original_filename}`}
                    title="Delete"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0',
                      background: '#fff', color: '#dc2626', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <IconTrashSm size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
