/**
 * DirectoryPage — Tabbed data console for a single directory.
 * 3 tabs: Collections, Projects, Entities
 * Source of truth: DESIGN-SPEC.md Section 6
 */
import { useEffect, useState, useMemo } from 'react'
import { useDirectoryStore } from '../stores/directory-store'
import { useNavigationStore } from '../stores/navigation-store'
import { searchCollectionsByProject, searchCollectionsByEntity } from '../services/frontend-queries'
import StatsGrid from '../components/StatsGrid'
import PillList from '../components/PillList'
import CategoryBadge from '../components/shared/CategoryBadge'
import BridgeBadge from '../components/shared/BridgeBadge'
import OrphanBadge from '../components/shared/OrphanBadge'
import InfoTag from '../components/InfoTag'
import type { DirectoryCollection, DirectoryProject, DirectoryEntity } from '../types/frontend'

type Tab = 'collections' | 'projects' | 'entities'
type SortDir = 'asc' | 'desc'

interface SortConfig<T extends string> {
  key: T
  dir: SortDir
}

export default function DirectoryPage({ name }: { name: string }) {
  const { directoryDetail, isLoadingDetail, error, loadDirectoryDetail } = useDirectoryStore()
  const navigate = useNavigationStore(s => s.navigate)

  const [tab, setTab] = useState<Tab>('collections')
  const [search, setSearch] = useState('')

  // Cross-entity search state (Collections tab only)
  const [crossSearchMode, setCrossSearchMode] = useState<'project' | 'entity'>('project')
  const [crossSearchTerm, setCrossSearchTerm] = useState('')
  const [crossResults, setCrossResults] = useState<Array<{ collectionName: string; matches: string[] }> | null>(null)
  const [crossSearching, setCrossSearching] = useState(false)

  // Sort state per tab
  const [collectionSort, setCollectionSort] = useState<SortConfig<'name' | 'projectCount' | 'entityCount'>>({ key: 'name', dir: 'asc' })
  const [projectSort, setProjectSort] = useState<SortConfig<'name' | 'domain' | 'entityCount'>>({ key: 'name', dir: 'asc' })
  const [entitySort, setEntitySort] = useState<SortConfig<'name' | 'category' | 'pageRank' | 'projectCount'>>({ key: 'pageRank', dir: 'desc' })

  useEffect(() => {
    loadDirectoryDetail(name)
  }, [name, loadDirectoryDetail])

  // Reset search when switching tabs
  useEffect(() => {
    setSearch('')
    setCrossResults(null)
    setCrossSearchTerm('')
  }, [tab])

  // ── Cross-entity search handler ───────────────────────────
  const handleCrossSearch = async () => {
    if (!crossSearchTerm.trim()) return
    setCrossSearching(true)
    try {
      if (crossSearchMode === 'project') {
        const results = await searchCollectionsByProject(name, crossSearchTerm.trim())
        setCrossResults(results.map(r => ({ collectionName: r.collectionName, matches: r.matchedProjects })))
      } else {
        const results = await searchCollectionsByEntity(name, crossSearchTerm.trim())
        setCrossResults(results.map(r => ({ collectionName: r.collectionName, matches: r.matchedEntities })))
      }
    } finally {
      setCrossSearching(false)
    }
  }

  // ── Sorting helper ────────────────────────────────────────
  function sortedBy<T>(items: T[], key: keyof T, dir: SortDir): T[] {
    return [...items].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (typeof av === 'number' && typeof bv === 'number') {
        return dir === 'asc' ? av - bv : bv - av
      }
      const as = String(av ?? '').toLowerCase()
      const bs = String(bv ?? '').toLowerCase()
      return dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
  }

  function toggleSort<T extends string>(
    current: SortConfig<T>,
    setter: (s: SortConfig<T>) => void,
    key: T,
  ) {
    if (current.key === key) {
      setter({ key, dir: current.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      setter({ key, dir: key === 'name' || key === 'category' ? 'asc' : 'desc' })
    }
  }

  function sortIndicator<T extends string>(config: SortConfig<T>, key: T): string {
    if (config.key !== key) return ''
    return config.dir === 'asc' ? ' ^' : ' v'
  }

  // ── Filtered + sorted data ────────────────────────────────
  const detail = directoryDetail

  const filteredCollections = useMemo(() => {
    if (!detail) return []
    let items = detail.collections
    if (search) {
      const s = search.toLowerCase()
      items = items.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.allTags.some(t => t.toLowerCase().includes(s))
      )
    }
    return sortedBy(items, collectionSort.key as keyof DirectoryCollection, collectionSort.dir)
  }, [detail, search, collectionSort])

  const filteredProjects = useMemo(() => {
    if (!detail) return []
    let items = detail.projects
    if (search) {
      const s = search.toLowerCase()
      items = items.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.domain.toLowerCase().includes(s) ||
        p.subdomain.toLowerCase().includes(s) ||
        p.tags.some(t => t.toLowerCase().includes(s)) ||
        p.collections.some(c => c.toLowerCase().includes(s))
      )
    }
    return sortedBy(items, projectSort.key as keyof DirectoryProject, projectSort.dir)
  }, [detail, search, projectSort])

  const filteredEntities = useMemo(() => {
    if (!detail) return []
    let items = detail.entities
    if (search) {
      const s = search.toLowerCase()
      items = items.filter(e =>
        e.name.toLowerCase().includes(s) ||
        e.category.toLowerCase().includes(s) ||
        e.collectionNames.some(c => c.toLowerCase().includes(s))
      )
    }
    return sortedBy(items, entitySort.key as keyof DirectoryEntity, entitySort.dir)
  }, [detail, search, entitySort])

  // ── Loading / Error states ────────────────────────────────
  if (isLoadingDetail && !detail) {
    return <div className="loading-state">Loading directory...</div>
  }
  if (error) {
    return (
      <div className="error-state">
        Error: {error}
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => loadDirectoryDetail(name)}>
          Retry
        </button>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="empty-state">
        Directory "{name}" not found.
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => navigate({ page: 'home' })}>
          Back to Home
        </button>
      </div>
    )
  }

  const stats = [
    { label: 'Collections', value: detail.collections.length },
    { label: 'Projects', value: detail.projects.length },
    { label: 'Entities', value: detail.entities.length },
    { label: 'Bridge Entities', value: detail.entities.filter(e => e.bridgeTier !== 'none').length },
  ]

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'collections', label: 'Collections', count: detail.collections.length },
    { key: 'projects', label: 'Projects', count: detail.projects.length },
    { key: 'entities', label: 'Entities', count: detail.entities.length },
  ]

  // ── Shared table header cell style ────────────────────────
  const thStyle: React.CSSProperties = {
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <div className="page-container">
      {/* Directory title + description */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>
          {detail.name}
        </h1>
        {detail.description && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            {detail.description}
          </p>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ marginBottom: '20px' }}>
        <StatsGrid stats={stats} />
      </div>

      {/* Tab bar + Search */}
      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
        <div className="flex gap-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-1px',
              }}
            >
              {t.label}
              <span style={{
                marginLeft: '6px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'var(--surface-hover)',
                padding: '1px 6px',
                borderRadius: '9999px',
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <input
          className="input"
          style={{ width: '240px' }}
          placeholder={`Search ${tab}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tab content */}
      {tab === 'collections' && (
        <CollectionsTab
          collections={filteredCollections}
          crossSearchMode={crossSearchMode}
          crossSearchTerm={crossSearchTerm}
          crossResults={crossResults}
          crossSearching={crossSearching}
          sortConfig={collectionSort}
          thStyle={thStyle}
          onSort={(key) => toggleSort(collectionSort, setCollectionSort, key)}
          sortIndicator={(key) => sortIndicator(collectionSort, key)}
          onCrossSearchModeChange={setCrossSearchMode}
          onCrossSearchTermChange={setCrossSearchTerm}
          onCrossSearch={handleCrossSearch}
          onClearCrossResults={() => { setCrossResults(null); setCrossSearchTerm('') }}
          onNavigate={navigate}
        />
      )}
      {tab === 'projects' && (
        <ProjectsTab
          projects={filteredProjects}
          sortConfig={projectSort}
          thStyle={thStyle}
          onSort={(key) => toggleSort(projectSort, setProjectSort, key)}
          sortIndicator={(key) => sortIndicator(projectSort, key)}
          onNavigate={navigate}
        />
      )}
      {tab === 'entities' && (
        <EntitiesTab
          entities={filteredEntities}
          sortConfig={entitySort}
          thStyle={thStyle}
          onSort={(key) => toggleSort(entitySort, setEntitySort, key)}
          sortIndicator={(key) => sortIndicator(entitySort, key)}
          onNavigate={navigate}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Collections Tab
// ══════════════════════════════════════════════════════════

function CollectionsTab({
  collections,
  crossSearchMode,
  crossSearchTerm,
  crossResults,
  crossSearching,
  sortConfig,
  thStyle,
  onSort,
  sortIndicator,
  onCrossSearchModeChange,
  onCrossSearchTermChange,
  onCrossSearch,
  onClearCrossResults,
  onNavigate,
}: {
  collections: DirectoryCollection[]
  crossSearchMode: 'project' | 'entity'
  crossSearchTerm: string
  crossResults: Array<{ collectionName: string; matches: string[] }> | null
  crossSearching: boolean
  sortConfig: SortConfig<'name' | 'projectCount' | 'entityCount'>
  thStyle: React.CSSProperties
  onSort: (key: 'name' | 'projectCount' | 'entityCount') => void
  sortIndicator: (key: 'name' | 'projectCount' | 'entityCount') => string
  onCrossSearchModeChange: (mode: 'project' | 'entity') => void
  onCrossSearchTermChange: (term: string) => void
  onCrossSearch: () => void
  onClearCrossResults: () => void
  onNavigate: (route: import('../types/frontend').Route) => void
}) {
  return (
    <div>
      {/* Cross-Entity Search Bar */}
      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Find collections containing:
          </span>
          <select
            className="input"
            style={{ width: '100px' }}
            value={crossSearchMode}
            onChange={e => onCrossSearchModeChange(e.target.value as 'project' | 'entity')}
          >
            <option value="project">Project</option>
            <option value="entity">Entity</option>
          </select>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder={`Search by ${crossSearchMode} name...`}
            value={crossSearchTerm}
            onChange={e => onCrossSearchTermChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCrossSearch()}
          />
          <button
            className="btn btn-primary"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            disabled={!crossSearchTerm.trim() || crossSearching}
            onClick={onCrossSearch}
          >
            {crossSearching ? 'Searching...' : 'Search'}
          </button>
          {crossResults && (
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={onClearCrossResults}
            >
              Clear
            </button>
          )}
        </div>

        {/* Cross-search results */}
        {crossResults && (
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            {crossResults.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                No collections found for "{crossSearchTerm}".
              </span>
            ) : (
              <div className="flex flex-col gap-2">
                {crossResults.map(r => (
                  <div key={r.collectionName} className="flex items-center gap-3" style={{ fontSize: '12px' }}>
                    <span
                      className="data-link"
                      onClick={() => onNavigate({ page: 'collection', name: r.collectionName })}
                    >
                      {r.collectionName}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      ({r.matches.length} match{r.matches.length !== 1 ? 'es' : ''}: {r.matches.slice(0, 3).join(', ')}
                      {r.matches.length > 3 ? `, +${r.matches.length - 3} more` : ''})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collections Table */}
      {collections.length === 0 ? (
        <div className="empty-state">No collections in this directory.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={thStyle} onClick={() => onSort('name')}>
                Collection{sortIndicator('name')}
              </th>
              <th style={thStyle} onClick={() => onSort('projectCount')}>
                Projects{sortIndicator('projectCount')}
              </th>
              <th style={thStyle} onClick={() => onSort('entityCount')}>
                Entities{sortIndicator('entityCount')}
              </th>
              <th>Tags</th>
              <th>Top Entities</th>
            </tr>
          </thead>
          <tbody>
            {collections.map(c => (
              <tr key={c.name}>
                <td>
                  <span
                    className="data-link"
                    onClick={() => onNavigate({ page: 'collection', name: c.name })}
                  >
                    {c.name}
                  </span>
                </td>
                <td>{c.projectCount}</td>
                <td>{c.entityCount}</td>
                <td>
                  <PillList
                    items={c.allTags}
                    maxVisible={3}
                    variant="tag"
                  />
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    {c.topEntities.slice(0, 3).map(e => (
                      <span key={e.name} className="flex items-center gap-1">
                        <span
                          className="data-link"
                          style={{ fontSize: '12px' }}
                          onClick={() => onNavigate({ page: 'entity', name: e.name })}
                        >
                          {e.name}
                        </span>
                        <InfoTag type="entity" name={e.name} />
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Projects Tab
// ══════════════════════════════════════════════════════════

function ProjectsTab({
  projects,
  sortConfig,
  thStyle,
  onSort,
  sortIndicator,
  onNavigate,
}: {
  projects: DirectoryProject[]
  sortConfig: SortConfig<'name' | 'domain' | 'entityCount'>
  thStyle: React.CSSProperties
  onSort: (key: 'name' | 'domain' | 'entityCount') => void
  sortIndicator: (key: 'name' | 'domain' | 'entityCount') => string
  onNavigate: (route: import('../types/frontend').Route) => void
}) {
  if (projects.length === 0) {
    return <div className="empty-state">No projects in this directory.</div>
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th style={thStyle} onClick={() => onSort('name')}>
            Project{sortIndicator('name')}
          </th>
          <th style={thStyle} onClick={() => onSort('domain')}>
            Domain{sortIndicator('domain')}
          </th>
          <th>Collections</th>
          <th>Tags</th>
          <th style={thStyle} onClick={() => onSort('entityCount')}>
            Entities{sortIndicator('entityCount')}
          </th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {projects.map(p => (
          <tr key={p.uniqueId}>
            <td>
              <span
                className="data-link"
                onClick={() => onNavigate({ page: 'project', uniqueId: p.uniqueId })}
              >
                {p.name}
              </span>
              <InfoTag type="project" name={p.name} scope={{ projectUniqueId: p.uniqueId, projectName: p.name }} />
            </td>
            <td>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                {p.domain}
                {p.subdomain && <span style={{ color: 'var(--text-muted)' }}> / {p.subdomain}</span>}
              </span>
            </td>
            <td>
              {p.collections.length > 0 ? (
                <PillList
                  items={p.collections}
                  maxVisible={2}
                  variant="collection"
                  onItemClick={(c) => onNavigate({ page: 'collection', name: c })}
                />
              ) : (
                <OrphanBadge />
              )}
            </td>
            <td>
              <PillList items={p.tags} maxVisible={3} variant="tag" />
            </td>
            <td>{p.entityCount}</td>
            <td>
              {p.htmlPath && (
                <span
                  className="data-link"
                  style={{ fontSize: '11px' }}
                  onClick={() => onNavigate({ page: 'source', htmlPath: p.htmlPath })}
                >
                  View
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ══════════════════════════════════════════════════════════
// Entities Tab
// ══════════════════════════════════════════════════════════

function EntitiesTab({
  entities,
  sortConfig,
  thStyle,
  onSort,
  sortIndicator,
  onNavigate,
}: {
  entities: DirectoryEntity[]
  sortConfig: SortConfig<'name' | 'category' | 'pageRank' | 'projectCount'>
  thStyle: React.CSSProperties
  onSort: (key: 'name' | 'category' | 'pageRank' | 'projectCount') => void
  sortIndicator: (key: 'name' | 'category' | 'pageRank' | 'projectCount') => string
  onNavigate: (route: import('../types/frontend').Route) => void
}) {
  if (entities.length === 0) {
    return <div className="empty-state">No entities in this directory.</div>
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th style={thStyle} onClick={() => onSort('name')}>
            Entity{sortIndicator('name')}
          </th>
          <th style={thStyle} onClick={() => onSort('category')}>
            Category{sortIndicator('category')}
          </th>
          <th style={thStyle} onClick={() => onSort('pageRank')}>
            Importance{sortIndicator('pageRank')}
          </th>
          <th style={thStyle} onClick={() => onSort('projectCount')}>
            Projects{sortIndicator('projectCount')}
          </th>
          <th>Bridge</th>
          <th>Collections</th>
        </tr>
      </thead>
      <tbody>
        {entities.map(e => (
          <tr key={e.name}>
            <td>
              <span className="flex items-center gap-1">
                <span
                  className="data-link"
                  onClick={() => onNavigate({ page: 'entity', name: e.name })}
                >
                  {e.name}
                </span>
                <InfoTag type="entity" name={e.name} />
              </span>
            </td>
            <td>
              <CategoryBadge category={e.category} />
            </td>
            <td>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                {e.pageRank.toFixed(2)}
              </span>
            </td>
            <td>{e.projectCount}</td>
            <td>
              <BridgeBadge tier={e.bridgeTier} />
            </td>
            <td>
              <PillList
                items={e.collectionNames}
                maxVisible={2}
                variant="collection"
                onItemClick={(c) => onNavigate({ page: 'collection', name: c })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
