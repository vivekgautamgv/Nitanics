import { useEffect, useState } from 'react'
import { useDirectoryStore } from '../../stores/directory-store'
import { useNavigationStore } from '../../stores/navigation-store'
import { createCollection } from '../../services/frontend-queries'
import { useUIStore } from '../../stores/ui-store'

export default function AppSidebar() {
  const navigate = useNavigationStore(s => s.navigate)
  const route = useNavigationStore(s => s.route)
  const { directories, allCollections, loadDirectories, loadAllCollections } = useDirectoryStore()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showNewCol, setShowNewCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const mobileOpen = useUIStore(s => s.mobileSidebarOpen)
  const setMobileOpen = useUIStore(s => s.setMobileSidebarOpen)

  useEffect(() => { setMobileOpen(false) }, [route, setMobileOpen])
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, setMobileOpen])

  useEffect(() => {
    loadDirectories()
    loadAllCollections()
  }, [loadDirectories, loadAllCollections])

  const isActive = (page: string, name?: string) => {
    if (page === 'home') return route.page === 'home'
    if (page === 'ingest') return route.page === 'ingest'
    if (page === 'settings') return route.page === 'settings'
    if (page === 'collection' && name) {
      return route.page === 'collection' && route.name === name
    }
    return false
  }

  const handleCreateCollection = async () => {
    const name = newColName.trim()
    if (!name || creating) return
    setCreateError('')
    if (allCollections.some(col => col.name.toLowerCase() === name.toLowerCase())) {
      setCreateError('A collection with this name already exists.')
      return
    }
    setCreating(true)
    try {
      await createCollection(name, '')
      setNewColName('')
      setShowNewCol(false)
      await loadAllCollections()
      navigate({ page: 'collection', name, tab: 'overview' })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally { setCreating(false) }
  }

  const independent = allCollections.filter(c => !c.directory)

  return (
    <>
    {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} />}
    <aside id="workspace-sidebar" className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`}>
      <div className="app-sidebar-brand">
        <button type="button" className="app-sidebar-logo" onClick={() => navigate({ page: 'home' })}>
          <span className="app-sidebar-logo-mark" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="9" r="2.5" /><circle cx="9" cy="18" r="2.5" /><path d="m8.5 6.5 7 2M7 8.5l1.5 7M16.5 11l-6 5" /></svg></span>
          <span className="app-sidebar-logo-copy"><span className="app-sidebar-logo-title">Nitanics</span><span className="app-sidebar-logo-sub">Knowledge graph workspace</span></span>
        </button>
        <button type="button" className="sidebar-mobile-close btn btn-ghost btn-sm" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>✕</button>
      </div>

      <button type="button" className="btn btn-primary app-sidebar-cta" onClick={() => navigate({ page: 'ingest' })}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Add documents
      </button>

      <nav className="app-sidebar-nav" aria-label="Workspace navigation">
        <button
          type="button"
          className={`sidebar-link ${isActive('home') ? 'sidebar-link-active' : ''}`}
          onClick={() => navigate({ page: 'home' })}
        >
          <SidebarIconHome />
          Home
        </button>

        <div className="sidebar-section-label">Collections</div>

        {directories.map(dir => {
          const cols = allCollections.filter(c => c.directory === dir.name)
          const isOpen = !collapsed[dir.name]
          return (
            <div key={dir.name} className="sidebar-group">
              <button
                type="button"
                className="sidebar-group-header"
                aria-expanded={isOpen}
                onClick={() => setCollapsed(prev => ({ ...prev, [dir.name]: isOpen }))}
              >
                <span className={`sidebar-chevron ${isOpen ? 'sidebar-chevron-open' : ''}`}>›</span>
                {dir.name}
              </button>
              {isOpen && cols.map(col => (
                <button
                  key={col.name}
                  type="button"
                  className={`sidebar-link sidebar-link-nested ${isActive('collection', col.name) ? 'sidebar-link-active' : ''}`}
                  onClick={() => navigate({ page: 'collection', name: col.name, tab: 'overview' })}
                >
                  <span className="sidebar-link-text">{col.name}</span>
                  <span className="sidebar-badge">{col.projectCount}</span>
                </button>
              ))}
            </div>
          )
        })}

        {independent.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header sidebar-group-header-static">Independent</div>
            {independent.map(col => (
              <button
                key={col.name}
                type="button"
                className={`sidebar-link sidebar-link-nested ${isActive('collection', col.name) ? 'sidebar-link-active' : ''}`}
                onClick={() => navigate({ page: 'collection', name: col.name, tab: 'overview' })}
              >
                <span className="sidebar-link-text">{col.name}</span>
                <span className="sidebar-badge">{col.projectCount}</span>
              </button>
            ))}
          </div>
        )}

        {showNewCol ? (
          <div className="sidebar-new-col">
            <input
              className="input"
              placeholder="Collection name"
              aria-label="New collection name"
              disabled={creating}
              value={newColName}
              onChange={e => { setNewColName(e.target.value); setCreateError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCollection(); if (e.key === 'Escape' && !creating) setShowNewCol(false) }}
              autoFocus
            />
            {createError && <p role="alert" className="form-error">{createError}</p>}
            <div className="sidebar-new-col-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled={creating} onClick={() => { setShowNewCol(false); setCreateError('') }}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateCollection} disabled={!newColName.trim() || creating}>{creating ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="sidebar-link sidebar-link-muted" onClick={() => setShowNewCol(true)}>
            + New collection
          </button>
        )}
      </nav>

      <div className="app-sidebar-footer">
        <button
          type="button"
          className={`sidebar-link ${isActive('settings') ? 'sidebar-link-active' : ''}`}
          onClick={() => navigate({ page: 'settings' })}
        >
          <SidebarIconSettings />
          Settings
        </button>
        <div className="sidebar-local-note"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></svg> Graph data stored on your machine</div>
      </div>
    </aside>
    </>
  )
}

function SidebarIconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
    </svg>
  )
}

function SidebarIconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  )
}
