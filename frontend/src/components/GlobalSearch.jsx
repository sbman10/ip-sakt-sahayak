import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SEARCH_INDEX } from '../data/searchIndex'

/* ─── Search Engine ──────────────────────────────────────────────────────── */
function scoreEntry(entry, query) {
  const q = query.toLowerCase().trim()
  if (!q) return 0

  const terms = q.split(/\s+/)
  const titleL = entry.title.toLowerCase()
  const descL = entry.description.toLowerCase()
  const keywordsL = entry.keywords.map((k) => k.toLowerCase())

  let score = 0
  for (const term of terms) {
    // Exact title match
    if (titleL === term) score += 100
    // Title starts with term
    else if (titleL.startsWith(term)) score += 60
    // Title contains term
    else if (titleL.includes(term)) score += 40
    // Keyword exact match
    const kwExact = keywordsL.find((k) => k === term)
    if (kwExact) score += 50
    // Keyword starts with term
    const kwStart = keywordsL.find((k) => k.startsWith(term))
    if (kwStart && !kwExact) score += 30
    // Keyword contains term
    const kwContains = keywordsL.find((k) => k.includes(term))
    if (kwContains && !kwStart) score += 15
    // Description contains term
    if (descL.includes(term)) score += 8
  }
  return score
}

function runSearch(query) {
  if (!query.trim()) return []
  const scored = SEARCH_INDEX.map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, 8).map(({ entry }) => entry)
}

/* ─── Highlight helper ───────────────────────────────────────────────────── */
function HighlightText({ text, query }) {
  if (!query.trim()) return <span>{text}</span>
  const terms = query.trim().split(/\s+/).filter(Boolean)
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="search-highlight">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

/* ─── Category icons (emoji shorthand) ──────────────────────────────────── */
const CATEGORY_ICONS = {
  'General': '🏠',
  'Home': '📍',
  'AI Assistant': '✨',
  'IP Tools': '⚖️',
  'Services': '📋',
  'Informatics': '📚',
  'Reference': '🔗',
  'Account': '👤',
}

/* ─── GlobalSearch Component ─────────────────────────────────────────────── */
export default function GlobalSearch({ onOpenAbout }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const listRef = useRef(null)

  const navigate = useNavigate()
  const location = useLocation()

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
    setQuery('')
    setMobileExpanded(false)
  }, [location.pathname])

  // Search as user types
  useEffect(() => {
    if (query.trim()) {
      const hits = runSearch(query)
      setResults(hits)
      setIsOpen(true)
      setActiveIndex(-1)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setMobileExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (inputRef.current) {
          inputRef.current.focus()
          setMobileExpanded(true)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  /* ─── Navigation ─────────────────────────────────────────────────────── */
  const NAVBAR_OFFSET = 80 // px

  const handleSelectResult = useCallback((entry) => {
    setIsOpen(false)
    setQuery('')
    setMobileExpanded(false)

    if (entry.type === 'action') {
      if (entry.target === 'openAbout' && onOpenAbout) {
        onOpenAbout()
      }
      return
    }

    if (entry.type === 'scroll') {
      const doScroll = () => {
        const el = document.getElementById(entry.target)
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET
          window.scrollTo({ top, behavior: 'smooth' })
        }
      }

      if (location.pathname !== (entry.scrollRoute || '/')) {
        navigate(entry.scrollRoute || '/', { replace: false })
        // Wait for page to mount then scroll
        setTimeout(doScroll, 350)
      } else {
        doScroll()
      }
      return
    }

    // type === 'route'
    if (location.pathname !== entry.target) {
      navigate(entry.target)
    }
  }, [navigate, location.pathname, onOpenAbout])

  /* ─── Keyboard navigation ────────────────────────────────────────────── */
  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('')
        setIsOpen(false)
        setMobileExpanded(false)
        inputRef.current?.blur()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelectResult(results[activeIndex])
        } else if (results.length > 0) {
          handleSelectResult(results[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setQuery('')
        setMobileExpanded(false)
        inputRef.current?.blur()
        break
      default:
        break
    }
  }

  // Scroll active item into view in dropdown
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className={`gs-container${mobileExpanded ? ' gs-mobile-expanded' : ''}`}
      ref={containerRef}
      role="search"
      aria-label="Global site search"
    >
      {/* Mobile icon trigger (hidden on desktop) */}
      <button
        type="button"
        className="gs-mobile-icon-btn"
        aria-label="Open search"
        onClick={() => {
          setMobileExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
      >
        <SearchIcon />
      </button>

      {/* Search input */}
      <div className="gs-input-wrap">
        <span className="gs-input-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          id="global-search-input"
          type="search"
          className="gs-input"
          placeholder="Search IP-SAKTI..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          aria-label="Search IP-SAKTI Sahayak"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="gs-results-list"
          aria-activedescendant={activeIndex >= 0 ? `gs-result-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length) setIsOpen(true) }}
        />
        {query ? (
          <button
            type="button"
            className="gs-clear-btn"
            aria-label="Clear search"
            onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus() }}
          >
            <ClearIcon />
          </button>
        ) : (
          <span className="gs-kbd-hint" aria-hidden="true">⌘K</span>
        )}
        {mobileExpanded && (
          <button
            type="button"
            className="gs-mobile-close-btn"
            aria-label="Close search"
            onClick={() => {
              setMobileExpanded(false)
              setIsOpen(false)
              setQuery('')
            }}
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="gs-dropdown" role="dialog" aria-label="Search results">
          {results.length > 0 ? (
            <ul
              id="gs-results-list"
              ref={listRef}
              className="gs-results-list"
              role="listbox"
              aria-label="Search results"
            >
              {results.map((entry, idx) => (
                <li
                  key={entry.id}
                  id={`gs-result-${idx}`}
                  data-index={idx}
                  className={`gs-result-item${activeIndex === idx ? ' gs-result-active' : ''}`}
                  role="option"
                  aria-selected={activeIndex === idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(-1)}
                  onClick={() => handleSelectResult(entry)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectResult(entry) }}
                  tabIndex={-1}
                >
                  <div className="gs-result-main">
                    <div className="gs-result-title">
                      <HighlightText text={entry.title} query={query} />
                    </div>
                    <div className="gs-result-desc">
                      <HighlightText text={entry.description} query={query} />
                    </div>
                  </div>
                  <span className="gs-result-category">
                    <span className="gs-category-icon" aria-hidden="true">
                      {CATEGORY_ICONS[entry.category] || '📄'}
                    </span>
                    {entry.category}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="gs-no-results" role="status" aria-live="polite">
              <span className="gs-no-results-icon" aria-hidden="true">🔍</span>
              <p className="gs-no-results-text">No results found for <strong>"{query}"</strong></p>
              <p className="gs-no-results-hint">Try a different keyword</p>
            </div>
          )}
          <div className="gs-dropdown-footer" aria-hidden="true">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Inline SVG icons ───────────────────────────────────────────────────── */
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
