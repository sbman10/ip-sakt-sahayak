import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SITEMAP_ROUTES, SITEMAP_GROUPS } from '../config/siteMap'
import {
  IconHome,
  IconSearch,
  IconX,
  IconChevronRight,
  IconShieldCheck,
  IconLock,
} from './Icons'
import './SitemapPage.css'

export default function SitemapPage() {
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter routes based on selected category and text search
  const filteredRoutes = useMemo(() => {
    return SITEMAP_ROUTES.filter(route => {
      const matchesGroup = selectedGroup === 'all' || route.group === selectedGroup
      const query = searchQuery.trim().toLowerCase()
      if (!query) return matchesGroup

      const matchesSearch =
        route.title.toLowerCase().includes(query) ||
        route.description.toLowerCase().includes(query) ||
        route.path.toLowerCase().includes(query)

      return matchesGroup && matchesSearch
    })
  }, [selectedGroup, searchQuery])

  // Group filtered routes by SITEMAP_GROUPS
  const groupedData = useMemo(() => {
    return SITEMAP_GROUPS.map(group => {
      const routesInGroup = filteredRoutes.filter(r => r.group === group.id)
      return {
        ...group,
        routes: routesInGroup,
      }
    }).filter(group => group.routes.length > 0)
  }, [filteredRoutes])

  return (
    <div className="sm-page">
      {/* Top Breadcrumb Navigation */}
      <div className="sm-top-strip">
        <nav className="sm-breadcrumbs" aria-label="Breadcrumb navigation">
          <Link to="/" className="sm-breadcrumb-link">
            <IconHome size={13} />
            <span>Portal Home</span>
          </Link>
          <span className="sm-breadcrumb-sep">/</span>
          <span className="sm-breadcrumb-active">Sitemap</span>
        </nav>
      </div>

      <div className="sm-container">
        {/* Header */}
        <header className="sm-header">
          <div className="sm-badge">
            <IconShieldCheck size={13} />
            <span>Official Institutional Directory</span>
          </div>
          <h1 className="sm-title">Complete System Sitemap</h1>
          <p className="sm-subtitle">
            Comprehensive directory of accessible statutory tools, regulatory engines, pharmacopoeia corpora, and practitioner workspaces across IP-SAKTI / RAGVYN.
          </p>
        </header>

        {/* Toolbar: Category Filter & Search Box */}
        <div className="sm-toolbar">
          <div className="sm-filter-pills" role="tablist" aria-label="Filter routes by group">
            <button
              type="button"
              className={`sm-filter-pill ${selectedGroup === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedGroup('all')}
              role="tab"
              aria-selected={selectedGroup === 'all'}
            >
              All Sections ({SITEMAP_ROUTES.length})
            </button>
            {SITEMAP_GROUPS.map(group => {
              const count = SITEMAP_ROUTES.filter(r => r.group === group.id).length
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`sm-filter-pill ${selectedGroup === group.id ? 'active' : ''}`}
                  onClick={() => setSelectedGroup(group.id)}
                  role="tab"
                  aria-selected={selectedGroup === group.id}
                >
                  <span>{group.title.split('&')[0].trim()}</span>
                  <span>({count})</span>
                </button>
              )
            })}
          </div>

          <div className="sm-search-box">
            <span className="sm-search-icon" aria-hidden="true">
              <IconSearch size={14} />
            </span>
            <input
              type="text"
              className="sm-search-input"
              placeholder="Search directory by title, path, or statute..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search sitemap"
            />
            {searchQuery && (
              <button
                type="button"
                className="sm-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <IconX size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Grouped Route Sections */}
        {groupedData.length > 0 ? (
          <div>
            {groupedData.map(group => (
              <section key={group.id} className="sm-group-section" aria-labelledby={`group-title-${group.id}`}>
                <div className="sm-group-header">
                  <div className="sm-group-title-row">
                    <h2 id={`group-title-${group.id}`} className="sm-group-title">
                      {group.title}
                    </h2>
                    <span className="sm-group-count">
                      {group.routes.length} {group.routes.length === 1 ? 'Page' : 'Pages'}
                    </span>
                  </div>
                  <p className="sm-group-desc">{group.description}</p>
                </div>

                <div className="sm-routes-grid">
                  {group.routes.map(route => (
                    <Link
                      key={route.path}
                      to={route.path}
                      className="sm-route-card"
                      aria-label={`${route.title} (${route.path})`}
                    >
                      <div>
                        <div className="sm-route-card-top">
                          <span className="sm-route-path">{route.path}</span>
                          {route.authRequired && (
                            <span className="sm-route-badge auth">
                              <IconLock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                              Login Required
                            </span>
                          )}
                          {route.badge && !route.authRequired && (
                            <span className="sm-route-badge">{route.badge}</span>
                          )}
                        </div>

                        <h3 className="sm-route-title">{route.title}</h3>
                        <p className="sm-route-desc">{route.description}</p>
                      </div>

                      <div className="sm-route-action">
                        <span>Access Resource</span>
                        <IconChevronRight size={13} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="sm-empty">
            <IconSearch size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '700' }}>No matching resources found</h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b' }}>
              No pages match "{searchQuery}". Try a different keyword or reset filters.
            </p>
            <button
              type="button"
              className="sm-filter-pill active"
              onClick={() => { setSearchQuery(''); setSelectedGroup('all'); }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
