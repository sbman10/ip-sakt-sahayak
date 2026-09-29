import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MatterCard from './MatterCard'
import MatterTimeline from './MatterTimeline'
import AddMatterModal from './AddMatterModal'
import {
  IconFolder,
  IconZap,
  IconAward,
  IconClock,
  IconAlertTriangle,
  IconCheckCircle,
  IconCheck,
  IconSearch,
  IconX,
  IconPlus,
  IconRefreshCw,
  IconCalendar,
  IconFileText,
  IconEye,
  IconEdit,
  IconTrash,
  IconGlobe,
  IconScroll,
  IconSparkles,
  IconHome,
  IconLeaf,
  IconBook,
  IconChevronRight,
  IconCopy,
} from './Icons'
import { getApiBase } from '../api/config'
import './MatterWorkspace.css'

const API_BASE = getApiBase()
const TOKEN_KEY = 'ip_sakti_access_token'

const STATUS_META = {
  draft: { label: 'Draft', color: '#475569', bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8' },
  filed: { label: 'Filed', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  examination: { label: 'Under Examination', color: '#b45309', bg: '#fef3c7', border: '#fde68a', dot: '#f59e0b' },
  granted: { label: 'Granted', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0', dot: '#16a34a' },
  rejected: { label: 'Rejected / Abandoned', color: '#b91c1c', bg: '#fee2e2', border: '#fecaca', dot: '#ef4444' },
}

const CASE_TYPE_META = {
  patent: { label: 'Patent', color: '#6d35e8', bg: '#f4effe', border: '#d8c7f9', icon: IconFileText },
  trademark: { label: 'Trademark', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: IconAward },
  copyright: { label: 'Copyright', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: IconBook },
  gi: { label: 'GI', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: IconLeaf },
}

const CASE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'patent', label: 'Patent' },
  { value: 'trademark', label: 'Trademark' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'gi', label: 'GI (Geographical Indication)' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'filed', label: 'Filed' },
  { value: 'examination', label: 'Under Examination' },
  { value: 'granted', label: 'Granted' },
  { value: 'rejected', label: 'Rejected' },
]

const JURISDICTION_OPTIONS = [
  { value: 'all', label: 'All Jurisdictions' },
  { value: 'IN', label: 'India (IPO)' },
  { value: 'PCT', label: 'PCT / WIPO' },
  { value: 'US', label: 'United States (USPTO)' },
  { value: 'EP', label: 'European Patent Office (EPO)' },
]

const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'filing_date', label: 'Filing Date (Newest)' },
  { value: 'filing_date_asc', label: 'Filing Date (Oldest)' },
  { value: 'deadline', label: 'Upcoming Deadline' },
  { value: 'title', label: 'Matter Title (A-Z)' },
]

const EVENT_TYPES = ['filing', 'office_action', 'response', 'deadline', 'grant', 'note']

function authHeaders() {
  const token = typeof window !== 'undefined' ? (sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)) : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, { headers: authHeaders(), ...options })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try { const j = await res.json(); detail = j.detail || detail } catch { /* noop */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  if (res.status === 204) return null
  return res.json()
}

function getJurisdiction(appNumber) {
  if (!appNumber) return { code: 'IN', label: 'India' }
  const u = appNumber.toUpperCase()
  if (u.startsWith('PCT') || u.startsWith('WO')) return { code: 'PCT', label: 'PCT / WIPO' }
  if (u.startsWith('US')) return { code: 'US', label: 'United States' }
  if (u.startsWith('EP')) return { code: 'EP', label: 'EPO (Europe)' }
  if (u.startsWith('GB')) return { code: 'GB', label: 'United Kingdom' }
  if (u.startsWith('JP')) return { code: 'JP', label: 'Japan' }
  return { code: 'IN', label: 'India' }
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return '—' }
}

function formatRelativeTime(value) {
  if (!value) return '—'
  try {
    const diff = (new Date() - new Date(value)) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
    return formatDate(value)
  } catch { return '—' }
}

const STORAGE_KEY_MATTERS = 'ip_sakti_matters_cache'

const DEFAULT_SAMPLE_MATTERS = [
  {
    id: 'mat_sample_1',
    title: 'Patent Filing – Herbal Composition for Anti-Inflammatory Therapeutics',
    case_type: 'patent',
    application_number: 'IN202341023456',
    filing_date: '2023-10-12T00:00:00.000Z',
    status: 'examination',
    notes: 'Prior art search against TKDL database completed. Section 3(p) compliance documentation submitted with CSIR references.',
    created_at: '2023-10-12T10:00:00.000Z',
    updated_at: new Date().toISOString(),
    event_count: 3,
    events: [
      {
        id: 'ev_sample_1',
        matter_id: 'mat_sample_1',
        event_type: 'filing',
        event_date: '2023-10-12T00:00:00.000Z',
        description: 'Complete specification filed under Form 1 & Form 2 at IPO Chennai.',
        created_at: '2023-10-12T10:00:00.000Z',
      },
      {
        id: 'ev_sample_2',
        matter_id: 'mat_sample_1',
        event_type: 'office_action',
        event_date: '2024-03-15T00:00:00.000Z',
        description: 'First Examination Report (FER) issued citing Section 3(e) synergistic efficacy query.',
        created_at: '2024-03-15T11:30:00.000Z',
      },
      {
        id: 'ev_sample_3',
        matter_id: 'mat_sample_1',
        event_type: 'deadline',
        event_date: new Date(Date.now() + 6 * 86400000).toISOString(),
        reminder_date: new Date(Date.now() + 6 * 86400000).toISOString(),
        description: 'Examination response due for Section 3(p) TKDL citations.',
        created_at: '2024-03-16T09:00:00.000Z',
      },
    ],
  },
  {
    id: 'mat_sample_2',
    title: 'Improved Solvent Extraction Method for Plant Alkaloids',
    case_type: 'patent',
    application_number: 'IN202341034521',
    filing_date: '2023-11-20T00:00:00.000Z',
    status: 'filed',
    notes: 'Provisional specification filed. Request for Early Publication (Form 9) submitted.',
    created_at: '2023-11-20T14:00:00.000Z',
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    event_count: 1,
    events: [
      {
        id: 'ev_sample_4',
        matter_id: 'mat_sample_2',
        event_type: 'filing',
        event_date: '2023-11-20T00:00:00.000Z',
        description: 'Provisional specification filed with IPO Delhi.',
        created_at: '2023-11-20T14:00:00.000Z',
      },
    ],
  },
  {
    id: 'mat_sample_3',
    title: 'Standardized Ayurvedic Formulation with TKDL Compliance',
    case_type: 'patent',
    application_number: 'IN202241012345',
    filing_date: '2022-06-08T00:00:00.000Z',
    status: 'granted',
    notes: 'Patent Certificate No. 439218 issued. Form 27 working statement due annually.',
    created_at: '2022-06-08T10:00:00.000Z',
    updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    event_count: 2,
    events: [
      {
        id: 'ev_sample_5',
        matter_id: 'mat_sample_3',
        event_type: 'filing',
        event_date: '2022-06-08T00:00:00.000Z',
        description: 'Complete specification filed.',
        created_at: '2022-06-08T10:00:00.000Z',
      },
      {
        id: 'ev_sample_6',
        matter_id: 'mat_sample_3',
        event_type: 'grant',
        event_date: '2024-01-10T00:00:00.000Z',
        description: 'Patent Granted under Letter Patent Document 439218.',
        created_at: '2024-01-10T12:00:00.000Z',
      },
    ],
  },
]

function getLocalMatters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MATTERS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* noop */ }
  return DEFAULT_SAMPLE_MATTERS
}

function setLocalMatters(list) {
  try {
    localStorage.setItem(STORAGE_KEY_MATTERS, JSON.stringify(list))
  } catch { /* noop */ }
}

export default function MatterWorkspace() {
  const [matters, setMatters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [backendConnected, setBackendConnected] = useState(false)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [caseTypeFilter, setCaseTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [jurisdictionFilter, setJurisdictionFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [summaryFilter, setSummaryFilter] = useState('all') // 'total', 'active', 'granted', 'pending', 'attention'
  const [viewMode, setViewMode] = useState('table') // 'table' | 'kanban'

  // Modal & Edit
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMatter, setEditingMatter] = useState(null)
  const [saving, setSaving] = useState(false)

  // Detail Drawer
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Deadlines
  const [upcoming, setUpcoming] = useState([])
  const [lastSyncTime, setLastSyncTime] = useState(new Date())

  // Three-dot action menu tracking
  const [activeMenuId, setActiveMenuId] = useState(null)
  const searchInputRef = useRef(null)

  // Show transient toast notification
  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Global keyboard shortcuts (Ctrl+K to focus search, Esc to close menus)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setActiveMenuId(null)
        if (selected) setSelected(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected])

  // Dismiss action menu on click outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // ---- Data loading -------------------------------------------------------
  const loadMatters = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: '1', page_size: '100' })
      if (caseTypeFilter && caseTypeFilter !== 'all') params.set('case_type', caseTypeFilter)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())

      const data = await api(`/matters?${params.toString()}`)
      if (data && Array.isArray(data.items)) {
        setMatters(data.items)
        setLocalMatters(data.items)
        setBackendConnected(true)
      } else {
        throw new Error('Invalid response from server')
      }
    } catch {
      // Backend unavailable or unauthorized: fall back gracefully to local storage
      const cached = getLocalMatters()
      setMatters(cached)
      setBackendConnected(false)
    } finally {
      setLoading(false)
      setLastSyncTime(new Date())
    }
  }, [caseTypeFilter, statusFilter, debouncedSearch])

  const loadUpcoming = useCallback(async () => {
    try {
      const data = await api('/matters/upcoming?days=30&include_overdue=true')
      if (Array.isArray(data)) {
        setUpcoming(data)
        return
      }
    } catch { /* non-fatal */ }

    // Fallback: extract upcoming reminders from cached matters
    const all = getLocalMatters()
    const extracted = []
    const now = new Date()
    for (const m of all) {
      for (const ev of (m.events || [])) {
        if (ev.reminder_date) {
          const rDate = new Date(ev.reminder_date)
          const diffDays = Math.ceil((rDate - now) / 86400000)
          if (diffDays <= 45) {
            extracted.push({
              event_id: ev.id,
              matter_id: m.id,
              matter_title: m.title,
              application_number: m.application_number,
              event_type: ev.event_type,
              event_date: ev.event_date,
              reminder_date: ev.reminder_date,
              days_remaining: diffDays,
              description: ev.description,
            })
          }
        }
      }
    }
    extracted.sort((a, b) => a.days_remaining - b.days_remaining)
    setUpcoming(extracted)
  }, [])

  useEffect(() => {
    let ignore = false
    const init = async () => {
      try {
        const params = new URLSearchParams({ page: '1', page_size: '100' })
        if (caseTypeFilter && caseTypeFilter !== 'all') params.set('case_type', caseTypeFilter)
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
        if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())

        const data = await api(`/matters?${params.toString()}`)
        if (!ignore) {
          if (data && Array.isArray(data.items)) {
            setMatters(data.items)
            setLocalMatters(data.items)
            setBackendConnected(true)
          } else {
            throw new Error('Invalid response')
          }
        }
      } catch {
        if (!ignore) {
          setMatters(getLocalMatters())
          setBackendConnected(false)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
          setLastSyncTime(new Date())
        }
      }
    }
    init()
    return () => { ignore = true }
  }, [caseTypeFilter, statusFilter, debouncedSearch])

  useEffect(() => {
    let ignore = false
    const initUpcoming = async () => {
      try {
        const data = await api('/matters/upcoming?days=30&include_overdue=true')
        if (!ignore && Array.isArray(data)) {
          setUpcoming(data)
          return
        }
      } catch { /* fallback */ }

      if (!ignore) {
        const all = getLocalMatters()
        const extracted = []
        const now = new Date()
        for (const m of all) {
          for (const ev of (m.events || [])) {
            if (ev.reminder_date) {
              const rDate = new Date(ev.reminder_date)
              const diffDays = Math.ceil((rDate - now) / 86400000)
              if (diffDays <= 45) {
                extracted.push({
                  event_id: ev.id,
                  matter_id: m.id,
                  matter_title: m.title,
                  application_number: m.application_number,
                  event_type: ev.event_type,
                  event_date: ev.event_date,
                  reminder_date: ev.reminder_date,
                  days_remaining: diffDays,
                  description: ev.description,
                })
              }
            }
          }
        }
        extracted.sort((a, b) => a.days_remaining - b.days_remaining)
        setUpcoming(extracted)
      }
    }
    initUpcoming()
    return () => { ignore = true }
  }, [])

  // ---- Mutations ----------------------------------------------------------
  const handleCreateOrUpdate = async (payload) => {
    setSaving(true)
    setError('')
    try {
      let saved = null
      let syncedWithBackend = false

      // 1. Try to persist to backend
      try {
        if (editingMatter) {
          saved = await api(`/matters/${editingMatter.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        } else {
          saved = await api('/matters', { method: 'POST', body: JSON.stringify(payload) })
        }
        syncedWithBackend = true
      } catch (apiErr) {
        console.warn('Backend unavailable, saving matter locally:', apiErr.message)
      }

      // 2. If backend didn't return or was offline, construct local matter object
      if (!saved) {
        const id = editingMatter?.id || `mat_${Date.now()}`
        saved = {
          id,
          title: payload.title,
          case_type: payload.case_type,
          application_number: payload.application_number || null,
          filing_date: payload.filing_date || null,
          status: payload.status,
          notes: payload.notes || null,
          created_at: editingMatter?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          event_count: editingMatter?.event_count || (payload.filing_date ? 1 : 0),
          events: editingMatter?.events || (payload.filing_date ? [{
            id: `ev_${Date.now()}`,
            matter_id: id,
            event_type: 'filing',
            event_date: payload.filing_date,
            description: 'Application filing record created.',
            created_at: new Date().toISOString(),
          }] : []),
        }
      }

      // 3. Update local cache and in-memory state
      const current = getLocalMatters()
      let updated
      if (editingMatter) {
        updated = current.map((m) => (m.id === editingMatter.id ? { ...m, ...saved } : m))
      } else {
        updated = [saved, ...current]
      }
      setLocalMatters(updated)
      setMatters(updated)

      setModalOpen(false)
      setEditingMatter(null)
      await loadUpcoming()

      showToast(
        editingMatter
          ? 'Patent matter updated successfully.'
          : syncedWithBackend
          ? 'New patent matter created and synchronized with cloud.'
          : 'New patent matter added to workspace.'
      )
    } catch (e) {
      setError(e.message || 'Failed to save matter.')
      throw e
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (matter) => {
    if (!window.confirm(`Are you sure you want to delete "${matter.title}"? This permanently removes all timeline events.`)) return
    try {
      try {
        await api(`/matters/${matter.id}`, { method: 'DELETE' })
      } catch (err) {
        console.warn('Backend delete failed, removing locally:', err.message)
      }
      const updated = getLocalMatters().filter((m) => m.id !== matter.id)
      setLocalMatters(updated)
      setMatters(updated)
      if (selected?.id === matter.id) setSelected(null)
      showToast(`Matter "${matter.title}" deleted.`)
      await loadUpcoming()
    } catch (e) {
      setError(e.message)
    }
  }

  const openDetail = async (matter) => {
    setDetailLoading(true)
    setSelected(matter)
    try {
      const full = await api(`/matters/${matter.id}`)
      if (full) {
        setSelected(full)
        const current = getLocalMatters()
        setLocalMatters(current.map((m) => (m.id === full.id ? full : m)))
      }
    } catch {
      // Backend offline: find in local storage
      const found = getLocalMatters().find((m) => m.id === matter.id)
      if (found) setSelected(found)
    } finally {
      setDetailLoading(false)
    }
  }

  // ---- Metrics Calculation (Never Hardcoded) ------------------------------
  const metrics = useMemo(() => {
    const total = matters.length
    const active = matters.filter((m) => m.status === 'filed' || m.status === 'examination').length
    const granted = matters.filter((m) => m.status === 'granted').length
    const pending = matters.filter((m) => m.status === 'draft' || m.status === 'filed').length
    const attention = upcoming.filter((u) => u.days_remaining <= 14).length

    return { total, active, granted, pending, attention }
  }, [matters, upcoming])

  // Map matters to next upcoming deadline for quick lookup in table
  const nextDeadlinesByMatter = useMemo(() => {
    const map = {}
    for (const u of upcoming) {
      if (!map[u.matter_id] || u.days_remaining < map[u.matter_id].days_remaining) {
        map[u.matter_id] = u
      }
    }
    return map
  }, [upcoming])

  // ---- Client-side Filter & Sort -----------------------------------------
  const filteredMatters = useMemo(() => {
    let result = [...matters]

    // Summary Card Quick Filter
    if (summaryFilter === 'active') {
      result = result.filter((m) => m.status === 'filed' || m.status === 'examination')
    } else if (summaryFilter === 'granted') {
      result = result.filter((m) => m.status === 'granted')
    } else if (summaryFilter === 'pending') {
      result = result.filter((m) => m.status === 'draft' || m.status === 'filed')
    } else if (summaryFilter === 'attention') {
      const attentionMatterIds = new Set(upcoming.filter((u) => u.days_remaining <= 14).map((u) => u.matter_id))
      result = result.filter((m) => attentionMatterIds.has(m.id))
    }

    // Jurisdiction Filter
    if (jurisdictionFilter !== 'all') {
      result = result.filter((m) => {
        const j = getJurisdiction(m.application_number)
        return j.code === jurisdictionFilter
      })
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'updated') {
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
      }
      if (sortBy === 'filing_date') {
        return new Date(b.filing_date || 0) - new Date(a.filing_date || 0)
      }
      if (sortBy === 'filing_date_asc') {
        return new Date(a.filing_date || 0) - new Date(b.filing_date || 0)
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '')
      }
      if (sortBy === 'deadline') {
        const ad = nextDeadlinesByMatter[a.id]?.days_remaining ?? 99999
        const bd = nextDeadlinesByMatter[b.id]?.days_remaining ?? 99999
        return ad - bd
      }
      return 0
    })

    return result
  }, [matters, summaryFilter, jurisdictionFilter, sortBy, upcoming, nextDeadlinesByMatter])

  // Kanban grouped columns
  const kanbanColumns = useMemo(() => {
    const grouped = { draft: [], filed: [], examination: [], granted: [], rejected: [] }
    for (const m of filteredMatters) {
      if (grouped[m.status]) grouped[m.status].push(m)
      else grouped.draft.push(m)
    }
    return grouped
  }, [filteredMatters])

  const hasActiveFilters = search || caseTypeFilter !== 'all' || statusFilter !== 'all' || jurisdictionFilter !== 'all' || summaryFilter !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setCaseTypeFilter('all')
    setStatusFilter('all')
    setJurisdictionFilter('all')
    setSummaryFilter('all')
  }

  return (
    <div className="mw-container">
      {/* Top Utility Strip */}
      <div className="mw-top-strip">
        <div className="mw-breadcrumbs">
          <Link to="/" className="mw-breadcrumb-link">
            <IconHome size={14} />
            <span>IP-SAKTI Portal</span>
          </Link>
          <span className="mw-breadcrumb-sep">/</span>
          <span className="mw-breadcrumb-active">Matter Workspace</span>
        </div>
        <div className="mw-top-actions">
          <Link to="/chat" className="mw-portal-link" title="Consult RagVyn AI">
            <IconSparkles size={14} />
            <span>Ask RagVyn AI</span>
          </Link>
          <Link to="/documents" className="mw-portal-link" title="Document Library">
            <IconFileText size={14} />
            <span>Documents</span>
          </Link>
        </div>
      </div>

      <div className="mw-content">
        {/* Top Header */}
        <header className="mw-header">
          <div className="mw-header-left">
            <div className="mw-header-icon-box" aria-hidden="true">
              <IconFolder size={22} />
            </div>
            <div className="mw-header-titles">
              <h1>Matter Workspace</h1>
              <p className="mw-header-subtitle">
                Track your patents, filings, deadlines and IP activity.
              </p>
              <div className="mw-header-sync">
                <span className="mw-pulse-dot" style={{ background: backendConnected ? '#10b981' : '#64748b' }} />
                <span>Last synchronized: {formatRelativeTime(lastSyncTime)}</span>
                <span style={{
                  marginLeft: 8,
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontWeight: 600,
                  background: backendConnected ? '#dcfce7' : '#f1f5f9',
                  color: backendConnected ? '#15803d' : '#475569',
                  border: `1px solid ${backendConnected ? '#bbf7d0' : '#e2e8f0'}`,
                }}>
                  {backendConnected ? '● Cloud Connected' : '● Local Cache'}
                </span>
              </div>
            </div>
          </div>

          <div className="mw-header-right">
            <button
              type="button"
              className="mw-btn-refresh"
              onClick={() => { loadMatters(); loadUpcoming(); }}
              title="Refresh workspace matters and upcoming deadlines"
              aria-label="Refresh"
            >
              <IconRefreshCw size={15} />
            </button>
            <button
              type="button"
              className="mw-btn-primary"
              id="mw-new-matter-btn"
              onClick={() => { setEditingMatter(null); setModalOpen(true) }}
            >
              <IconPlus size={15} />
              <span>New Matter</span>
            </button>
          </div>
        </header>

        {/* Portfolio Summary Cards */}
        {loading && matters.length === 0 ? (
          <div className="mw-summary-grid">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mw-summary-card mw-skeleton mw-skeleton-card" />
            ))}
          </div>
        ) : (
          <div className="mw-summary-grid">
            {/* Total Matters */}
            <div
              className={`mw-summary-card ${summaryFilter === 'all' ? 'active-filter' : ''}`}
              onClick={() => setSummaryFilter('all')}
              title="Click to show all matters"
            >
              <div className="mw-summary-card-top">
                <span className="mw-summary-icon mw-icon-total"><IconFolder size={18} /></span>
                <span className="mw-summary-number">{metrics.total}</span>
              </div>
              <div className="mw-summary-label">Total Matters</div>
              <div className="mw-summary-desc">All patent & IP matters</div>
            </div>

            {/* Active */}
            <div
              className={`mw-summary-card ${summaryFilter === 'active' ? 'active-filter' : ''}`}
              onClick={() => setSummaryFilter(summaryFilter === 'active' ? 'all' : 'active')}
              title="Click to filter by active matters"
            >
              <div className="mw-summary-card-top">
                <span className="mw-summary-icon mw-icon-active"><IconZap size={18} /></span>
                <span className="mw-summary-number">{metrics.active}</span>
              </div>
              <div className="mw-summary-label">Active</div>
              <div className="mw-summary-desc">Currently in progress</div>
            </div>

            {/* Granted */}
            <div
              className={`mw-summary-card ${summaryFilter === 'granted' ? 'active-filter' : ''}`}
              onClick={() => setSummaryFilter(summaryFilter === 'granted' ? 'all' : 'granted')}
              title="Click to filter by granted patents"
            >
              <div className="mw-summary-card-top">
                <span className="mw-summary-icon mw-icon-granted"><IconAward size={18} /></span>
                <span className="mw-summary-number">{metrics.granted}</span>
              </div>
              <div className="mw-summary-label">Granted</div>
              <div className="mw-summary-desc">Granted patent rights</div>
            </div>

            {/* Pending */}
            <div
              className={`mw-summary-card ${summaryFilter === 'pending' ? 'active-filter' : ''}`}
              onClick={() => setSummaryFilter(summaryFilter === 'pending' ? 'all' : 'pending')}
              title="Click to filter by pending examination"
            >
              <div className="mw-summary-card-top">
                <span className="mw-summary-icon mw-icon-pending"><IconClock size={18} /></span>
                <span className="mw-summary-number">{metrics.pending}</span>
              </div>
              <div className="mw-summary-label">Pending</div>
              <div className="mw-summary-desc">Awaiting examination</div>
            </div>

            {/* Attention Required */}
            <div
              className={`mw-summary-card mw-card-attention ${summaryFilter === 'attention' ? 'active-filter' : ''}`}
              onClick={() => setSummaryFilter(summaryFilter === 'attention' ? 'all' : 'attention')}
              title="Click to filter by matters with upcoming deadlines"
            >
              <div className="mw-summary-card-top">
                <span className="mw-summary-icon mw-icon-attention"><IconAlertTriangle size={18} /></span>
                <span className="mw-summary-number" style={{ color: '#d97706' }}>{metrics.attention}</span>
              </div>
              <div className="mw-summary-label">Needs Attention</div>
              <div className="mw-summary-desc">Deadlines due soon</div>
            </div>
          </div>
        )}

        {/* Needs Attention / Upcoming Deadlines Section */}
        <section className="mw-deadlines-section">
          <div className="mw-deadlines-header">
            <div className="mw-deadlines-title-row">
              <IconAlertTriangle size={18} color="#d97706" />
              <h2>Needs Attention</h2>
              {upcoming.length > 0 && (
                <span className="mw-deadlines-count-badge">
                  {upcoming.length} action{upcoming.length === 1 ? '' : 's'} scheduled
                </span>
              )}
            </div>
          </div>

          {upcoming.length > 0 ? (
            <div className="mw-deadlines-grid">
              {upcoming.map((u) => {
                const isOverdue = u.days_remaining < 0
                const isUrgent = u.days_remaining >= 0 && u.days_remaining <= 7
                const urgencyClass = isOverdue ? 'urgency-overdue' : isUrgent ? 'urgency-soon' : 'urgency-normal'
                const urgencyText = isOverdue
                  ? `${Math.abs(u.days_remaining)}d overdue`
                  : u.days_remaining === 0
                  ? 'Due today'
                  : `Due in ${u.days_remaining}d`

                return (
                  <div key={u.event_id} className={`mw-deadline-card ${urgencyClass}`}>
                    <div>
                      <div className="mw-deadline-top">
                        <span className="mw-deadline-badge">{urgencyText}</span>
                        <span style={{ fontSize: 11, color: 'var(--mw-text-muted)' }}>
                          {String(u.event_type).replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="mw-deadline-matter-title" title={u.matter_title}>
                        {u.matter_title}
                      </div>
                      <div className="mw-deadline-app-no">
                        {u.description ? u.description : 'Action or response deadline recorded'}
                      </div>
                    </div>

                    <div className="mw-deadline-footer">
                      <span className="mw-deadline-due-date">
                        <IconCalendar size={13} style={{ marginRight: 4 }} />
                        {formatDate(u.reminder_date)}
                      </span>
                      <button
                        type="button"
                        className="mw-deadline-btn"
                        onClick={() => openDetail(matters.find((m) => m.id === u.matter_id) || { id: u.matter_id, title: u.matter_title })}
                      >
                        <span>View Matter</span>
                        <IconChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mw-deadlines-empty">
              <div className="mw-deadlines-empty-icon">
                <IconCheckCircle size={24} style={{ color: '#16A34A' }} />
              </div>
              <div className="mw-deadlines-empty-text">
                <h4>You're all caught up</h4>
                <p>No upcoming patent actions, FER replies, or statutory hearings require urgent attention.</p>
              </div>
            </div>
          )}
        </section>

        {/* Global Error Banner if any */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconAlertTriangle size={15} />
              {error}
            </span>
            <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
              <IconX size={15} />
            </button>
          </div>
        )}

        {/* Main Workspace Panel */}
        <div className="mw-main-panel">
          {/* Toolbar */}
          <div className="mw-panel-toolbar">
            <div className="mw-panel-title-area">
              <h2 className="mw-panel-title">Your Matters</h2>
              <span className="mw-count-pill">
                {filteredMatters.length} {filteredMatters.length === 1 ? 'matter' : 'matters'}
              </span>
            </div>

            <div className="mw-filter-bar">
              {/* Search */}
              <div className="mw-search-wrapper">
                <span className="mw-search-icon" aria-hidden="true">
                  <IconSearch size={15} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="mw-search-input"
                  placeholder="Search title, application no. (⌘K)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="mw-search-clear"
                    onClick={() => setSearch('')}
                    title="Clear search"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                className="mw-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Case Type Filter */}
              <select
                className="mw-select"
                value={caseTypeFilter}
                onChange={(e) => setCaseTypeFilter(e.target.value)}
                aria-label="Filter by case type"
              >
                {CASE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Jurisdiction Filter */}
              <select
                className="mw-select"
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
                aria-label="Filter by jurisdiction"
              >
                {JURISDICTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Sort By */}
              <select
                className="mw-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort matters"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="mw-view-toggle">
                <button
                  type="button"
                  className={`mw-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Table List View"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span>List</span>
                </button>
                <button
                  type="button"
                  className={`mw-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                  onClick={() => setViewMode('kanban')}
                  title="Kanban Board View"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="18" rx="1" />
                    <rect x="14" y="3" width="7" height="11" rx="1" />
                  </svg>
                  <span>Board</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Tags */}
          {hasActiveFilters && (
            <div className="mw-active-filters-row">
              <span style={{ color: 'var(--mw-text-muted)', fontWeight: 600 }}>Active Filters:</span>
              {search && (
                <span className="mw-filter-tag">
                  <span>Query: "{search}"</span>
                  <button type="button" className="mw-tag-remove" onClick={() => setSearch('')}>
                    <IconX size={12} />
                  </button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="mw-filter-tag">
                  <span>Status: {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}</span>
                  <button type="button" className="mw-tag-remove" onClick={() => setStatusFilter('all')}>
                    <IconX size={12} />
                  </button>
                </span>
              )}
              {caseTypeFilter !== 'all' && (
                <span className="mw-filter-tag">
                  <span>Type: {CASE_TYPE_OPTIONS.find((o) => o.value === caseTypeFilter)?.label}</span>
                  <button type="button" className="mw-tag-remove" onClick={() => setCaseTypeFilter('all')}>
                    <IconX size={12} />
                  </button>
                </span>
              )}
              {jurisdictionFilter !== 'all' && (
                <span className="mw-filter-tag">
                  <span>Jurisdiction: {JURISDICTION_OPTIONS.find((o) => o.value === jurisdictionFilter)?.label}</span>
                  <button type="button" className="mw-tag-remove" onClick={() => setJurisdictionFilter('all')}>
                    <IconX size={12} />
                  </button>
                </span>
              )}
              {summaryFilter !== 'all' && (
                <span className="mw-filter-tag">
                  <span>Group: {summaryFilter}</span>
                  <button type="button" className="mw-tag-remove" onClick={() => setSummaryFilter('all')}>
                    <IconX size={12} />
                  </button>
                </span>
              )}
              <button type="button" className="mw-btn-clear-all" onClick={clearAllFilters}>
                Clear all filters
              </button>
            </div>
          )}

          {/* Content Area: Loading vs Empty vs Table/Kanban */}
          {loading ? (
            <div className="mw-table-wrapper">
              <table className="mw-table">
                <thead>
                  <tr>
                    <th>Matter / Patent</th>
                    <th>Application No.</th>
                    <th>Jurisdiction</th>
                    <th>Status</th>
                    <th>Filing Date</th>
                    <th>Next Deadline</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <tr key={i} className="mw-skeleton-row">
                      <td><div className="mw-skeleton" style={{ height: 16, width: '75%', marginBottom: 6 }} /><div className="mw-skeleton" style={{ height: 12, width: '40%' }} /></td>
                      <td><div className="mw-skeleton" style={{ height: 14, width: 100 }} /></td>
                      <td><div className="mw-skeleton" style={{ height: 14, width: 70 }} /></td>
                      <td><div className="mw-skeleton" style={{ height: 20, width: 85, borderRadius: 999 }} /></td>
                      <td><div className="mw-skeleton" style={{ height: 14, width: 80 }} /></td>
                      <td><div className="mw-skeleton" style={{ height: 14, width: 90 }} /></td>
                      <td><div className="mw-skeleton" style={{ height: 16, width: 24, marginLeft: 'auto' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : matters.length === 0 ? (
            /* Purposeful Empty State for Fresh Workspace */
            <div className="mw-empty-state">
              <div className="mw-empty-icon-circle">
                <IconFolder size={28} />
              </div>
              <h3>No patent matters yet</h3>
              <p>
                Create your first matter to start tracking applications, statutory deadlines,
                office actions, TKDL considerations, and filing history.
              </p>
              <button
                type="button"
                className="mw-btn-primary"
                onClick={() => { setEditingMatter(null); setModalOpen(true) }}
              >
                <IconPlus size={15} style={{ marginRight: 6 }} />
                Create First Matter
              </button>
            </div>
          ) : filteredMatters.length === 0 ? (
            /* No Filter Matches */
            <div className="mw-empty-state">
              <div className="mw-empty-icon-circle">
                <IconSearch size={26} />
              </div>
              <h3>No matters match your filter</h3>
              <p>
                No patent matters found matching your selected search query or criteria.
                Try relaxing the filters to see more results.
              </p>
              <button type="button" className="mw-btn-primary" onClick={clearAllFilters}>
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'table' ? (
            /* Main List / Table Hybrid */
            <div className="mw-table-wrapper">
              <table className="mw-table">
                <thead>
                  <tr>
                    <th>Matter / Patent</th>
                    <th>Application No.</th>
                    <th className="mw-col-jurisdiction">Jurisdiction</th>
                    <th>Status</th>
                    <th className="mw-col-date">Filing Date</th>
                    <th>Next Deadline</th>
                    <th className="mw-col-events">Events</th>
                    <th className="mw-col-updated">Updated</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatters.map((m) => {
                    const statusMeta = STATUS_META[m.status] || STATUS_META.draft
                    const caseMeta = CASE_TYPE_META[m.case_type] || CASE_TYPE_META.patent
                    const jur = getJurisdiction(m.application_number)
                    const deadline = nextDeadlinesByMatter[m.id]
                    const CaseIcon = caseMeta.icon

                    return (
                      <tr
                        key={m.id}
                        className="mw-table-row"
                        onClick={() => openDetail(m)}
                      >
                        {/* Title & Metadata */}
                        <td className="mw-cell-matter">
                          <span className="mw-matter-title-line">
                            {m.title}
                          </span>
                          <div className="mw-matter-meta-row">
                            <span
                              className="mw-case-type-badge"
                              style={{
                                color: caseMeta.color,
                                background: caseMeta.bg,
                                borderColor: caseMeta.border,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {CaseIcon && <CaseIcon size={12} />}
                              <span>{caseMeta.label}</span>
                            </span>
                            {m.notes && (
                              <span style={{ fontSize: 11, color: 'var(--mw-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                {m.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Application Number */}
                        <td className="mw-cell-app-no">
                          {m.application_number ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span>#{m.application_number}</span>
                            </span>
                          ) : (
                            <span style={{ opacity: 0.4 }}>—</span>
                          )}
                        </td>

                        {/* Jurisdiction */}
                        <td className="mw-col-jurisdiction mw-cell-jurisdiction">
                          <span className="mw-jurisdiction-badge" title={jur.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <IconGlobe size={12} />
                            <span>{jur.label}</span>
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td>
                          <span
                            className="mw-status-pill"
                            style={{
                              color: statusMeta.color,
                              background: statusMeta.bg,
                              borderColor: statusMeta.border,
                            }}
                          >
                            <span className="mw-status-dot" style={{ background: statusMeta.dot }} />
                            <span>{statusMeta.label}</span>
                          </span>
                        </td>

                        {/* Filing Date */}
                        <td className="mw-col-date mw-cell-date">
                          {formatDate(m.filing_date)}
                        </td>

                        {/* Next Deadline */}
                        <td className="mw-cell-deadline">
                          {deadline ? (
                            <span className="mw-deadline-inline">
                              <span
                                className="mw-deadline-inline-badge"
                                style={{
                                   background: deadline.days_remaining < 0 ? '#fee2e2' : deadline.days_remaining <= 7 ? '#fef3c7' : '#dbeafe',
                                   color: deadline.days_remaining < 0 ? '#b91c1c' : deadline.days_remaining <= 7 ? '#b45309' : '#1d4ed8',
                                }}
                              >
                                {deadline.days_remaining < 0
                                  ? `${Math.abs(deadline.days_remaining)}d overdue`
                                  : deadline.days_remaining === 0
                                  ? 'Due today'
                                  : `in ${deadline.days_remaining}d`}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--mw-text-main)' }}>
                                {formatDate(deadline.reminder_date)}
                              </span>
                            </span>
                          ) : (
                            <span style={{ opacity: 0.4 }}>—</span>
                          )}
                        </td>

                        {/* Events Count */}
                        <td className="mw-col-events mw-cell-events">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <IconCalendar size={13} style={{ color: 'var(--mw-text-muted)' }} />
                            <span>{m.event_count ?? 0}</span>
                          </span>
                        </td>

                        {/* Last Updated */}
                        <td className="mw-col-updated mw-cell-updated">
                          {formatRelativeTime(m.updated_at)}
                        </td>

                        {/* Actions Menu */}
                        <td className="mw-cell-actions" onClick={(e) => e.stopPropagation()}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className="mw-action-menu-btn"
                              title="Actions"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveMenuId(activeMenuId === m.id ? null : m.id)
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === m.id && (
                              <div className="mw-dropdown-menu">
                                <button
                                  type="button"
                                  className="mw-dropdown-item"
                                  onClick={() => { setActiveMenuId(null); openDetail(m); }}
                                >
                                  <IconEye size={14} />
                                  <span>Open Details</span>
                                </button>
                                <button
                                  type="button"
                                  className="mw-dropdown-item"
                                  onClick={() => { setActiveMenuId(null); setEditingMatter(m); setModalOpen(true); }}
                                >
                                  <IconEdit size={14} />
                                  <span>Edit Matter</span>
                                </button>
                                <button
                                  type="button"
                                  className="mw-dropdown-item"
                                  onClick={() => { setActiveMenuId(null); openDetail(m); }}
                                >
                                  <IconPlus size={14} />
                                  <span>Add Event</span>
                                </button>
                                <div style={{ height: 1, background: 'var(--mw-card-border)', margin: '4px 0' }} />
                                <button
                                  type="button"
                                  className="mw-dropdown-item danger"
                                  onClick={() => { setActiveMenuId(null); handleDelete(m); }}
                                >
                                  <IconTrash size={14} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Kanban Board View */
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
              {Object.keys(kanbanColumns).map((statusKey) => {
                const colMeta = STATUS_META[statusKey] || STATUS_META.draft
                const colMatters = kanbanColumns[statusKey] || []
                return (
                  <div
                    key={statusKey}
                    style={{
                      background: 'var(--mw-bg, #f8fafc)',
                      borderRadius: 12,
                      padding: 12,
                      border: '1px solid var(--mw-card-border, #e2e8f0)',
                      minHeight: 180,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: colMeta.dot }} />
                        <strong style={{ fontSize: 13, color: 'var(--mw-text-main)' }}>{colMeta.label}</strong>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--mw-text-muted)', fontWeight: 600 }}>
                        {colMatters.length}
                      </span>
                    </div>

                    {colMatters.length === 0 ? (
                      <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--mw-text-subtle)', fontSize: 12 }}>
                        No matters in {colMeta.label.toLowerCase()}
                      </div>
                    ) : (
                      colMatters.map((m) => (
                        <MatterCard
                          key={m.id}
                          matter={m}
                          onOpen={openDetail}
                          onEdit={(mm) => { setEditingMatter(mm); setModalOpen(true) }}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <AddMatterModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingMatter(null); setError('') }}
        onSubmit={handleCreateOrUpdate}
        matter={editingMatter}
        saving={saving}
        error={error}
      />

      {/* Detail Drawer with Timeline */}
      {selected && (
        <MatterDetailDrawer
          matter={selected}
          loading={detailLoading}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditingMatter(selected); setModalOpen(true) }}
          onDelete={() => handleDelete(selected)}
          onEventAdded={async (newEvent) => {
            if (newEvent) {
              const current = getLocalMatters()
              const updated = current.map((m) => {
                if (m.id === selected.id) {
                  const evs = [...(m.events || []), newEvent]
                  return { ...m, events: evs, event_count: evs.length, updated_at: new Date().toISOString() }
                }
                return m
              })
              setLocalMatters(updated)
              setMatters(updated)
              setSelected((prev) => prev ? {
                ...prev,
                events: [...(prev.events || []), newEvent],
                event_count: (prev.events || []).length + 1,
              } : null)
            } else {
              await openDetail(selected)
              await loadMatters()
            }
            await loadUpcoming()
            showToast('Timeline event added.')
          }}
        />
      )}

      {/* Transient Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--mw-text-main, #0f172a)',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: 'var(--mw-shadow-lg)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          animation: 'mw-fade-in 0.2s ease',
        }}>
          <IconCheck size={14} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail Drawer (Single matter overview, lifecycle pipeline & event timeline)
// ---------------------------------------------------------------------------
function MatterDetailDrawer({ matter, loading, onClose, onEdit, onDelete, onEventAdded }) {
  const [ev, setEv] = useState({ event_type: 'note', event_date: '', description: '', reminder_date: '' })
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const jur = getJurisdiction(matter.application_number)
  const statusMeta = STATUS_META[matter.status] || STATUS_META.draft
  const caseMeta = CASE_TYPE_META[matter.case_type] || CASE_TYPE_META.patent
  const DrawerCaseIcon = caseMeta.icon

  const copyAppNumber = () => {
    if (!matter.application_number) return
    navigator.clipboard.writeText(matter.application_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addEvent = async (e) => {
    e.preventDefault()
    setAdding(true)
    setErr('')
    const eventPayload = {
      event_type: ev.event_type,
      event_date: ev.event_date ? new Date(ev.event_date).toISOString() : null,
      description: ev.description.trim() || null,
      reminder_date: ev.reminder_date ? new Date(ev.reminder_date).toISOString() : null,
    }
    try {
      let createdEvent = null
      try {
        createdEvent = await api(`/matters/${matter.id}/events`, {
          method: 'POST',
          body: JSON.stringify(eventPayload),
        })
      } catch (apiErr) {
        console.warn('Backend event creation unavailable, recording event locally:', apiErr.message)
      }

      if (!createdEvent) {
        createdEvent = {
          id: `ev_${Date.now()}`,
          matter_id: matter.id,
          ...eventPayload,
          created_at: new Date().toISOString(),
        }
      }

      setEv({ event_type: 'note', event_date: '', description: '', reminder_date: '' })
      await onEventAdded?.(createdEvent)
    } catch (e2) {
      setErr(e2.message || 'Failed to record event.')
    } finally {
      setAdding(false)
    }
  }

  // Lifecycle stage progression
  const STAGES = ['draft', 'filed', 'examination', 'granted']
  const currentStageIndex = STAGES.indexOf(matter.status) >= 0 ? STAGES.indexOf(matter.status) : 0

  return (
    <div className="mw-drawer-backdrop" onClick={onClose}>
      <div className="mw-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mw-drawer-header">
          <div className="mw-drawer-title-area">
            <h2 className="mw-drawer-title">{matter.title || 'Patent Matter'}</h2>
            <div className="mw-drawer-badges">
              <span
                className="mw-status-pill"
                style={{
                  color: statusMeta.color,
                  background: statusMeta.bg,
                  borderColor: statusMeta.border,
                }}
              >
                <span className="mw-status-dot" style={{ background: statusMeta.dot }} />
                <span>{statusMeta.label}</span>
              </span>

              <span
                className="mw-case-type-badge"
                style={{
                  color: caseMeta.color,
                  background: caseMeta.bg,
                  borderColor: caseMeta.border,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {DrawerCaseIcon && <DrawerCaseIcon size={12} />}
                <span>{caseMeta.label}</span>
              </span>

              <span className="mw-jurisdiction-badge" title={jur.label} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconGlobe size={12} />
                <span>{jur.label}</span>
              </span>

              {matter.application_number && (
                <button
                  type="button"
                  onClick={copyAppNumber}
                  style={{
                    background: 'var(--mw-bg)',
                    border: '1px solid var(--mw-card-border)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--mw-text-main)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Click to copy application number"
                >
                  <span>#{matter.application_number}</span>
                  <span style={{ fontSize: 10, opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {copied ? <><IconCheck size={11} /> Copied</> : <IconCopy size={11} />}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="mw-drawer-close-btn"
              onClick={onEdit}
              title="Edit Matter"
            >
              <IconEdit size={14} />
            </button>
            <button
              type="button"
              className="mw-drawer-close-btn"
              onClick={onClose}
              title="Close Drawer"
            >
              <IconX size={15} />
            </button>
          </div>
        </div>

        {/* Overview Metadata Grid */}
        <div className="mw-drawer-grid">
          <div>
            <div className="mw-grid-item-label">Filing Date</div>
            <div className="mw-grid-item-value">{formatDate(matter.filing_date)}</div>
          </div>
          <div>
            <div className="mw-grid-item-label">Jurisdiction</div>
            <div className="mw-grid-item-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconGlobe size={13} /> {jur.label}
            </div>
          </div>
          <div>
            <div className="mw-grid-item-label">Timeline Events</div>
            <div className="mw-grid-item-value">{matter.events?.length ?? matter.event_count ?? 0} recorded</div>
          </div>
          <div>
            <div className="mw-grid-item-label">Last Modified</div>
            <div className="mw-grid-item-value">{formatRelativeTime(matter.updated_at)}</div>
          </div>
        </div>

        {/* Patent Lifecycle Milestone Bar */}
        <div className="mw-stages-bar">
          <div className="mw-stages-label">Patent Lifecycle Progress</div>
          <div className="mw-stages-steps">
            {STAGES.map((s, idx) => {
              const isCompleted = idx < currentStageIndex || matter.status === 'granted'
              const isCurrent = idx === currentStageIndex && matter.status !== 'granted'
              return (
                <div key={s} className={`mw-stage-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                  <div className="mw-stage-dot" />
                  <span className="mw-stage-name">{STATUS_META[s]?.label || s}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Case Notes & Strategy */}
        {matter.notes && (
          <div className="mw-drawer-notes">
            <div className="mw-notes-label">Strategy & Examination Notes</div>
            <p className="mw-notes-content">{matter.notes}</p>
          </div>
        )}

        {/* Event Timeline */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--mw-text-main)' }}>
            Filing & Prosecution History
          </h3>
          <span style={{ fontSize: 12, color: 'var(--mw-text-muted)' }}>
            {(matter.events || []).length} events
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--mw-text-muted)', fontSize: 13 }}>
            Loading timeline events…
          </div>
        ) : (
          <MatterTimeline events={matter.events || []} />
        )}

        {/* Add Event Form */}
        <form onSubmit={addEvent} className="mw-add-event-box">
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--mw-text-main)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconPlus size={14} /> Add Timeline Event / Reminder
          </h4>

          <div className="mw-form-group">
            <label className="mw-form-label">Event Category *</label>
            <select
              className="mw-form-select"
              value={ev.event_type}
              onChange={(e) => setEv({ ...ev, event_type: e.target.value })}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="mw-form-group" style={{ flex: 1 }}>
              <label className="mw-form-label">Event Date</label>
              <input
                type="date"
                className="mw-form-input"
                value={ev.event_date}
                onChange={(e) => setEv({ ...ev, event_date: e.target.value })}
              />
            </div>
            <div className="mw-form-group" style={{ flex: 1 }}>
              <label className="mw-form-label">Action Reminder Date</label>
              <input
                type="date"
                className="mw-form-input"
                value={ev.reminder_date}
                onChange={(e) => setEv({ ...ev, reminder_date: e.target.value })}
              />
            </div>
          </div>

          <div className="mw-form-group">
            <label className="mw-form-label">Description / Remarks</label>
            <textarea
              className="mw-form-textarea"
              rows={2}
              placeholder="e.g. Received First Examination Report (FER) citing Section 3(p)..."
              value={ev.description}
              onChange={(e) => setEv({ ...ev, description: e.target.value })}
            />
          </div>

          {err && (
            <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={adding}
            className="mw-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {adding ? 'Recording Event…' : 'Record to Timeline'}
          </button>
        </form>

        {/* Drawer Footer Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--mw-card-border)' }}>
          <button
            type="button"
            onClick={onDelete}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete Matter
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onEdit}
              className="mw-btn-primary"
              style={{ background: 'var(--mw-card-bg)', color: 'var(--mw-text-main) !important', border: '1px solid var(--mw-card-border)', boxShadow: 'var(--mw-shadow-sm)' }}
            >
              Edit Details
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mw-btn-primary"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
