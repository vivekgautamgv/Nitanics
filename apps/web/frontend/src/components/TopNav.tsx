import { useEffect, useRef, useState } from 'react'
import { useNavigationStore } from '../stores/navigation-store'
import { useDirectoryStore } from '../stores/directory-store'

export default function TopNav() {
  const breadcrumbs = useNavigationStore(s => s.breadcrumbs)
  const navigate = useNavigationStore(s => s.navigate)
  const route = useNavigationStore(s => s.route)
  const allCollections = useDirectoryStore(s => s.allCollections)
  const loadAllCollections = useDirectoryStore(s => s.loadAllCollections)

  const [gsOpen, setGsOpen] = useState(false)
  const gsRef = useRef<HTMLDivElement>(null)
  const onGraphPage = route.page === 'graph'


  useEffect(() => {
    if (gsOpen && allCollections.length === 0) loadAllCollections()
  }, [gsOpen, allCollections.length, loadAllCollections])

  useEffect(() => {
    if (!gsOpen) return
    const handler = (e: MouseEvent) => {
      if (gsRef.current && !gsRef.current.contains(e.target as Node)) setGsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [gsOpen])

  return (
    <nav className="top-nav" role="navigation" aria-label="Main navigation">
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0, flex: 1 }}>
        <button
          onClick={() => navigate({ page: 'home' })}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            color: 'inherit',
            padding: 0,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Nitanics
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
            Knowledge Graph Platform
          </span>
        </button>

        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-subtle)', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {breadcrumbs.map((seg, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              {i > 0 && <span className="breadcrumb-separator">/</span>}
              {seg.route ? (
                <span className="breadcrumb-segment" onClick={() => navigate(seg.route!)}>
                  {seg.label}
                </span>
              ) : (
                <span className="breadcrumb-current" style={{ fontWeight: 600 }}>
                  {seg.label}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div ref={gsRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          id="graph-studio-launcher"
          onClick={() => setGsOpen(!gsOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            background: onGraphPage ? 'var(--surface-hover)' : 'rgba(255,255,255,0.05)',
            color: 'var(--text-primary)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="3" cy="8" r="2" />
            <circle cx="13" cy="3" r="2" />
            <circle cx="13" cy="13" r="2" />
            <line x1="5" y1="7" x2="11" y2="4" />
            <line x1="5" y1="9" x2="11" y2="12" />
          </svg>
          Graph Studio
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.5 }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </svg>
        </button>

        {gsOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 320,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            boxShadow: '0 24px 54px rgba(15,23,42,0.12)',
            zIndex: 200,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Open Workspace
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Jump directly into a collection graph
                </span>
              </div>
              <button onClick={() => setGsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                x
              </button>
            </div>

            <div style={{ padding: '8px 0', maxHeight: 280, overflowY: 'auto' }}>
              {allCollections.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                  No collections found
                </div>
              ) : (
                allCollections.map(c => (
                  <button
                    key={c.name}
                    onClick={() => {
                      navigate({ page: 'graph', collectionName: c.name })
                      setGsOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {c.projectCount} {c.projectCount === 1 ? 'project' : 'projects'}
                      </div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                      <path d="M3 6h6M7 4l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate({ page: 'ingest' })}
        title="Ingest Documents"
        style={{
          background: route.page === 'ingest' ? 'var(--surface-hover)' : 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '9px 12px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          transition: 'color 0.15s, background-color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'var(--surface-hover)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-muted)'
          e.currentTarget.style.background = route.page === 'ingest' ? 'var(--surface-hover)' : 'rgba(255,255,255,0.05)'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Ingest
      </button>

      <button
        onClick={() => navigate({ page: 'settings' })}
        title="Settings"
        style={{
          background: route.page === 'settings' ? 'var(--surface-hover)' : 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '9px 10px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.15s, background-color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'var(--surface-hover)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-muted)'
          e.currentTarget.style.background = route.page === 'settings' ? 'var(--surface-hover)' : 'rgba(255,255,255,0.05)'
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </nav>
  )
}
