import { useEffect, useMemo, useState } from 'react'
import { useDirectoryStore } from '../stores/directory-store'
import { useNavigationStore } from '../stores/navigation-store'
import { fetchWorkspaceOverview, type WorkspaceOverview } from '../services/workspace-queries'
import EmptyState from '../components/ui/EmptyState'
import { useRefreshOnFocus } from '../adapters/graph-studio'

const format = (value: number) => value.toLocaleString()

export default function HomePage() {
  const { allCollections, isLoading, error, loadDirectories, loadAllCollections } = useDirectoryStore()
  const navigate = useNavigationStore(s => s.navigate)
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null)
  const [overviewError, setOverviewError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [refreshing, setRefreshing] = useState(true)
  const [search, setSearch] = useState('')
  const [workspace, setWorkspace] = useState('all')
  const [sort, setSort] = useState('name')
  useRefreshOnFocus(() => setRefresh(value => value + 1))

  useEffect(() => {
    let active = true
    setRefreshing(true)
    setOverviewError('')
    loadDirectories()
    loadAllCollections()
    fetchWorkspaceOverview().then(data => {
      if (active) setOverview(data)
    }).catch(err => {
      if (active) setOverviewError(err instanceof Error ? err.message : String(err))
    }).finally(() => { if (active) setRefreshing(false) })
    return () => { active = false }
  }, [loadDirectories, loadAllCollections, refresh])

  const workspaces = useMemo(() => [...new Set(allCollections.map(c => c.directory || 'Independent'))].sort(), [allCollections])
  const visible = useMemo(() => allCollections.map(c => ({
    ...c, ...overview?.collections.find(detail => detail.name === c.name),
  })).filter(c => {
    const matchesSearch = (c.name + ' ' + (c.description || '')).toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (workspace === 'all' || (c.directory || 'Independent') === workspace)
  }).sort((a, b) => sort === 'documents'
    ? b.projectCount - a.projectCount || a.name.localeCompare(b.name)
    : a.name.localeCompare(b.name)), [allCollections, overview, search, workspace, sort])

  const connectionError = error || overviewError
  const initialLoading = !overview && (isLoading || refreshing)

  return (
    <div className="page-container workspace-dashboard">
      <section className="workspace-hero">
        <div className="workspace-hero-copy">
          <div className="workspace-eyebrow">Your local research workspace</div>
          <h1>Your knowledge,<br /><span>connected.</span></h1>
          <p>Turn papers and reports into a network of ideas. Explore the evidence, find shared concepts, and build on what you already know.</p>
          <div className="workspace-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate({ page: 'ingest' })}>+ Add documents</button>
            <span>Markdown, text, and PDF</span>
          </div>
        </div>
        <div className="workspace-hero-art" aria-hidden="true">
          <svg viewBox="0 0 360 210" fill="none">
            <path d="M65 57L168 99L276 48M168 99L286 155M168 99L82 160M65 57L82 160M276 48L286 155M82 160L286 155M168 99L194 189" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="168" cy="99" r="43" fill="var(--surface)" stroke="currentColor" strokeDasharray="3 5" opacity=".6" />
            <circle cx="168" cy="99" r="25" fill="var(--accent)" />
            <path d="M156 99h24M168 87v24" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="65" cy="57" r="13" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
            <circle cx="276" cy="48" r="18" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
            <circle cx="286" cy="155" r="12" fill="var(--accent)" opacity=".7" />
            <circle cx="82" cy="160" r="17" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
            <circle cx="194" cy="189" r="7" fill="var(--accent)" opacity=".4" />
            <text x="42" y="29" fill="var(--text-secondary)" fontSize="11">Documents</text>
            <text x="256" y="19" fill="var(--text-secondary)" fontSize="11">Ideas</text>
            <text x="53" y="195" fill="var(--text-secondary)" fontSize="11">Evidence</text>
            <text x="253" y="187" fill="var(--text-secondary)" fontSize="11">Connections</text>
          </svg>
        </div>
      </section>

      <div className="workspace-stats" aria-label="Workspace statistics" aria-busy={initialLoading}>
        {[
          { label: 'Collections', value: overview?.collections.length, hint: 'Organized knowledge spaces' },
          { label: 'Documents', value: overview?.documents, hint: 'Unique sources across collections' },
          { label: 'Entities', value: overview?.entities, hint: 'People, concepts, and ideas' },
          { label: 'Relationships', value: overview?.relationships, hint: 'Connections between entities' },
        ].map(stat => <div className="workspace-stat" key={stat.label}>
          <div className="workspace-stat-label">{stat.label}</div>
          <div className="workspace-stat-value">{initialLoading || stat.value === undefined ? '—' : format(stat.value)}</div>
          <div className="workspace-stat-hint">{stat.hint}</div>
        </div>)}
      </div>

      {connectionError && <div className="workspace-alert" role="alert">
        <div><strong>Unable to refresh workspace</strong><p>{connectionError}</p></div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRefresh(n => n + 1)}>Retry</button>
      </div>}

      <section className="workspace-collections">
        <div className="workspace-section-heading">
          <div><h2>Your collections <span>{allCollections.length}</span></h2><p>Choose a collection to explore its sources and connections.</p></div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing || isLoading} onClick={() => setRefresh(n => n + 1)}>{refreshing || isLoading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <div className="workspace-controls">
          <label className="workspace-search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" strokeLinecap="round" /></svg>
            <input aria-label="Search collections" type="search" placeholder="Search collections…" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <select className="input" aria-label="Filter by workspace" value={workspace} onChange={e => setWorkspace(e.target.value)}>
            <option value="all">All workspaces</option>{workspaces.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select className="input" aria-label="Sort collections" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name: A–Z</option><option value="documents">Most documents</option></select>
        </div>

        {(isLoading || refreshing) && allCollections.length === 0 ? <div className="workspace-loading" role="status">Loading your collections…</div>
          : allCollections.length === 0 && !connectionError ? <EmptyState title="Start with a document" description="Add a paper, report, or note to create your first collection." action={<button type="button" className="btn btn-primary" onClick={() => navigate({ page: 'ingest' })}>Add documents</button>} />
          : visible.length === 0 && allCollections.length > 0 ? <EmptyState title="No matching collections" description="Try another name or workspace." action={<button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setWorkspace('all') }}>Clear filters</button>} />
          : <div className="workspace-collection-grid">{visible.map(col => <article key={col.name} className="workspace-collection-card">
            <div className="workspace-card-top"><span className="workspace-collection-icon" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="9" r="2.5" /><circle cx="9" cy="18" r="2.5" /><path d="m8.5 6.5 7 2M7 8.5l1.5 7M16.5 11l-6 5" /></svg></span><span className="workspace-folder">{col.directory || 'Independent'}</span></div>
            <h3><button type="button" onClick={() => navigate({ page: 'collection', name: col.name, tab: 'overview' })}>{col.name}</button></h3>
            <p className="workspace-card-description">{col.description || 'Explore the documents, entities, and relationships in this collection.'}</p>
            <div className="workspace-card-metrics"><span><strong>{format(col.projectCount)}</strong> documents</span>{col.entities !== undefined && <span><strong>{format(col.entities)}</strong> entities</span>}{col.bridges !== undefined && col.bridges > 0 && <span className="workspace-bridge-count"><strong>{format(col.bridges)}</strong> shared entities</span>}</div>
            <div className="workspace-card-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate({ page: 'collection', name: col.name, tab: 'documents' })}>View documents</button><button type="button" className="workspace-explore" onClick={() => navigate({ page: 'collection', name: col.name, tab: 'graph' })}>Explore graph <span aria-hidden="true">↗</span></button></div>
          </article>)}</div>}
      </section>
    </div>
  )
}
