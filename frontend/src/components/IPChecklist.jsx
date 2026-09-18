import { useState, useEffect } from 'react'
import ToolIntro from './ToolIntro'
import { TOOL_INTRO_CONFIGS } from '../data/toolIntroConfigs'

// Icons
const IconCheck = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconChevronDown = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const IconInfo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const IconFile = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const IconClock = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const IconRupee = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12M6 8h12M6 13l8 8M14 13c0-2.5-2-4.5-4.5-4.5H6" />
  </svg>
)

const API_BASE = 'http://127.0.0.1:8000'

export default function IPChecklist() {
  const [showIntro, setShowIntro] = useState(true)
  const [checklists, setChecklists] = useState([])
  const [selectedChecklist, setSelectedChecklist] = useState(null)
  const [checklistDetails, setChecklistDetails] = useState(null)
  const [completedItems, setCompletedItems] = useState(new Set())
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchChecklists()
  }, [])

  const fetchChecklists = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/checklists/`)
      if (res.ok) {
        const data = await res.json()
        setChecklists(data)
      }
    } catch (err) {
      console.error('Failed to fetch checklists:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchChecklistDetails = async (id) => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/checklists/${id}`)
      if (res.ok) {
        const data = await res.json()
        setChecklistDetails(data)
        setSelectedChecklist(id)
        
        // Fetch progress
        const progressRes = await fetch(`${API_BASE}/api/checklists/${id}/progress?user_id=anonymous`)
        if (progressRes.ok) {
          const progress = await progressRes.json()
          setCompletedItems(new Set(progress.completed_items || []))
        }
      }
    } catch (err) {
      console.error('Failed to fetch checklist details:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = async (itemId) => {
    const newCompleted = !completedItems.has(itemId)
    const newSet = new Set(completedItems)
    
    if (newCompleted) {
      newSet.add(itemId)
    } else {
      newSet.delete(itemId)
    }
    setCompletedItems(newSet)
    
    // Save progress
    setSaving(true)
    try {
      await fetch(`${API_BASE}/api/checklists/${selectedChecklist}/progress?user_id=anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, completed: newCompleted })
      })
    } catch (err) {
      console.error('Failed to save progress:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleExpand = (itemId) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const progressPercent = checklistDetails 
    ? Math.round((completedItems.size / checklistDetails.items.length) * 100)
    : 0

  const categoryColors = {
    patent: { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#10b981' },
    trademark: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '#3b82f6' },
    geographical_indication: { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#f59e0b' },
    biodiversity: { bg: 'rgba(34, 197, 94, 0.1)', border: '#22c55e', text: '#22c55e' },
    copyright: { bg: 'rgba(168, 85, 247, 0.1)', border: '#a855f7', text: '#a855f7' },
  }

  if (loading && !checklistDetails) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <p>Loading checklists...</p>
      </div>
    )
  }

  if (showIntro) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0a0a)', padding: '2rem 1rem' }}>
        <ToolIntro
          config={TOOL_INTRO_CONFIGS['checklists']}
          icon={<IconFile size={28} />}
          onStart={() => setShowIntro(false)}
          backTo="/"
          backLabel="Back to Portal"
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0a0a)', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconFile size={24} /> IP Filing Checklists
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Step-by-step checklists for patent, trademark, GI, and ABS compliance
            </p>
          </div>
          <button
            type="button"
            className="tool-guide-return-btn"
            onClick={() => setShowIntro(true)}
            title="View checklist overview & instructions"
          >
            <IconInfo size={14} />
            <span>Checklist Overview & Guide</span>
          </button>
        </div>

        {!selectedChecklist ? (
          /* Checklist Selection Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
            {checklists.map(cl => {
              const colors = categoryColors[cl.category] || categoryColors.patent
              return (
                <div
                  key={cl.id}
                  onClick={() => fetchChecklistDetails(cl.id)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.border
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    background: colors.bg,
                    color: colors.text,
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    marginBottom: '1rem'
                  }}>
                    {cl.category.replace('_', ' ')}
                  </div>
                  
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                    {cl.name}
                  </h3>
                  
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                    {cl.description}
                  </p>
                  
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <IconCheck size={14} /> {cl.item_count} steps
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <IconClock size={14} /> {cl.estimated_time}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <IconRupee size={14} /> {cl.fees_range}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Checklist Detail View */
          <div>
            {/* Back button */}
            <button
              onClick={() => { setSelectedChecklist(null); setChecklistDetails(null); }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.7)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '1.5rem',
                fontSize: '0.875rem'
              }}
            >
              ← Back to Checklists
            </button>

            {checklistDetails && (
              <>
                {/* Checklist Header */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981', marginBottom: '0.5rem' }}>
                        {checklistDetails.name}
                      </h2>
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                        {checklistDetails.description}
                      </p>
                    </div>
                    
                    {/* Progress Circle */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: `conic-gradient(#10b981 ${progressPercent * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          background: '#0a0a0a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column'
                        }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>{progressPercent}%</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
                        {completedItems.size}/{checklistDetails.items.length} complete
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <strong>Timeline:</strong> {checklistDetails.estimated_time}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <strong>Fees:</strong> {checklistDetails.fees_range}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <strong>Jurisdiction:</strong> {checklistDetails.jurisdiction}
                    </span>
                  </div>
                </div>

                {/* Checklist Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {checklistDetails.items.map((item, index) => {
                    const isCompleted = completedItems.has(item.id)
                    const isExpanded = expandedItems.has(item.id)
                    
                    return (
                      <div
                        key={item.id}
                        style={{
                          background: isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '10px',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Item Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem 1.25rem',
                            cursor: 'pointer'
                          }}
                          onClick={() => toggleExpand(item.id)}
                        >
                          {/* Checkbox */}
                          <div
                            onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              border: `2px solid ${isCompleted ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
                              background: isCompleted ? '#10b981' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              flexShrink: 0
                            }}
                          >
                            {isCompleted && <IconCheck size={14} color="#fff" />}
                          </div>
                          
                          {/* Step number */}
                          <span style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            flexShrink: 0
                          }}>
                            {index + 1}
                          </span>
                          
                          {/* Item text */}
                          <div style={{ flex: 1 }}>
                            <p style={{
                              fontWeight: '500',
                              color: isCompleted ? 'rgba(255,255,255,0.5)' : '#fff',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                              margin: 0
                            }}>
                              {item.text}
                            </p>
                            {item.required && (
                              <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>Required</span>
                            )}
                          </div>
                          
                          {/* Expand indicator */}
                          <div style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            color: 'rgba(255,255,255,0.4)'
                          }}>
                            <IconChevronDown size={20} />
                          </div>
                        </div>
                        
                        {/* Expanded Content */}
                        {isExpanded && (
                          <div style={{
                            padding: '0 1.25rem 1.25rem 4.5rem',
                            borderTop: '1px solid rgba(255,255,255,0.05)'
                          }}>
                            {item.description && (
                              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1rem', marginTop: '1rem' }}>
                                {item.description}
                              </p>
                            )}
                            
                            {item.documents && item.documents.length > 0 && (
                              <div style={{ marginBottom: '1rem' }}>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <IconFile size={14} /> Required Documents:
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  {item.documents.map((doc, i) => (
                                    <span key={i} style={{
                                      background: 'rgba(59, 130, 246, 0.1)',
                                      color: '#3b82f6',
                                      padding: '0.25rem 0.75rem',
                                      borderRadius: '4px',
                                      fontSize: '0.8rem'
                                    }}>
                                      {doc}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {item.tips && item.tips.length > 0 && (
                              <div>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <IconInfo size={14} /> Tips:
                                </p>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                                  {item.tips.map((tip, i) => (
                                    <li key={i} style={{ marginBottom: '0.25rem' }}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {/* Saving indicator */}
                {saving && (
                  <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: '#fff',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}>
                    Saving progress...
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
