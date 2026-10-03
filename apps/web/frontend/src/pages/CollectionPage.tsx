/**
 * CollectionPage — Full collection console.
 * Sections: Summary, Projects, Bridge Entities, Categories, Causal Chains, Recommendations
 * Source of truth: DESIGN-SPEC.md Section 7
 */
import { useEffect, useMemo, useState } from 'react'
import { useCollectionStore } from '../stores/collection-store'
import { useNavigationStore } from '../stores/navigation-store'
import StatsGrid from '../components/StatsGrid'
import CollapsibleSection from '../components/CollapsibleSection'
import PillList from '../components/PillList'
import EditableText from '../components/EditableText'
import CategoryBadge from '../components/shared/CategoryBadge'
import BridgeBadge from '../components/shared/BridgeBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import InfoTag from '../components/InfoTag'
import { CATEGORY_COLORS } from '../constants/colors'
import { exportCollectionZIP } from '../services/frontend-queries'
import type { CollectionTab, CausalChainItem } from '../types/frontend'
import Tabs from '../components/ui/Tabs'
import CollectionGraphPanel from '../components/collection/CollectionGraphPanel'

export default function CollectionPage({ name }: { name: string }) {
  const {
    summary, projects, bridges, topEntities, categories, chains, recommendations,
    isLoading, error, loadCollection, addProject, removeProject, updateDescription,
  } = useCollectionStore()
  const navigate = useNavigationStore(s => s.navigate)
  const route = useNavigationStore(s => s.route)

  const activeTab: CollectionTab =
    route.page === 'collection' && route.name === name ? (route.tab ?? 'overview') : 'overview'

  const setTab = (tab: CollectionTab) => navigate({ page: 'collection', name, tab })

  const collectionTabs: { id: CollectionTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents' },
    { id: 'graph', label: 'Graph' },
    { id: 'bridges', label: 'Bridges' },
    { id: 'chains', label: 'Chains' },
  ]

  const [removeTarget, setRemoveTarget] = useState<{ uniqueId: string; projectName: string } | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProcessId, setExportProcessId] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [exportLogs, setExportLogs] = useState('')
  const [exportError, setExportError] = useState('')
  const [exportDownloadUrl, setExportDownloadUrl] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const filteredProjects = useMemo(() => projects.filter(project =>
    [project.name, project.domain, project.subdomain, ...project.tags].join(' ').toLowerCase().includes(documentSearch.trim().toLowerCase())
  ), [projects, documentSearch])

  useEffect(() => {
    loadCollection(name)
  }, [name, loadCollection])

  // Poll export status endpoint
  useEffect(() => {
    if (!exportProcessId || exportStatus !== 'running') return

    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    let failures = 0
    const poll = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5176/api/status?id=${encodeURIComponent(exportProcessId)}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Failed to query export status')
        const data = await res.json()
        if (stopped) return
        failures = 0
        setExportLogs(data.logs || '')
        if (data.status !== 'running') {
          if (data.status !== 'success' && data.status !== 'failed') throw new Error('Invalid export status received')
          setExportStatus(data.status)
          if (data.status === 'success') {
            if (!data.downloadUrl) { setExportStatus('failed'); setExportError('The export completed but no download was returned. Try exporting again.') }
            else setExportDownloadUrl(new URL(data.downloadUrl, 'http://127.0.0.1:5176').href)
          } else setExportError(data.error || 'The export process failed. See details below.')
          return
        }
      } catch (err: unknown) {
        if (stopped) return
        failures++
        if (failures >= 4) {
          setExportStatus('failed')
          setExportError('Unable to check the export. Verify the API server is running, then retry the status check.')
          return
        }
      }
      if (!stopped) timer = setTimeout(poll, failures ? 2000 * failures : 1200)
    }
    poll()

    return () => { stopped = true; clearTimeout(timer); controller.abort() }
  }, [exportProcessId, exportStatus, name])

  const handleRemoveProject = async () => {
    if (!removeTarget) return
    try {
      const removed = await removeProject(removeTarget.uniqueId, name)
      if (!removed) setRemoveError(`Cannot remove "${removeTarget.projectName}" — it's in no other collection.`)
    } catch (err) { setRemoveError(err instanceof Error ? err.message : String(err)) }
    setRemoveTarget(null)
  }

  const handleAddRecommendation = async (uniqueId: string) => {
    try { await addProject(uniqueId, name) }
    catch (err) { setRemoveError(err instanceof Error ? err.message : String(err)) }
  }

  const handleExport = async () => {
    setExporting(true)
    setExportStatus('running')
    setExportLogs('[UI] Requesting backend collection export...\n')
    setExportError('')
    setExportDownloadUrl('')

    try {
      const res = await fetch('http://127.0.0.1:5176/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: name })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to start export process.')
      }

      const data = await res.json()
      setExportProcessId(data.processId)
      setExportLogs(prev => prev + `[UI] Export process triggered successfully. Process ID: ${data.processId}\n`)
    } catch (err: any) {
      setExportError(err.message)
      setExportStatus('failed')
    }
  }

  if (isLoading && !summary) {
    return <div className="loading-state">Loading collection...</div>
  }
  if (error) {
    return (
      <div className="error-state">
        Error: {error}
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => loadCollection(name)}>
          Retry
        </button>
      </div>
    )
  }
  if (!summary) {
    return (
      <div className="empty-state">
        Collection "{name}" not found.
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => navigate({ page: 'home' })}>
          Back to Home
        </button>
      </div>
    )
  }

  const stats = [
    { label: 'Documents', value: summary.projectCount },
    { label: 'Entities', value: summary.entityCount },
    { label: 'Relationships', value: summary.relationshipCount },
    { label: 'Causal Chains', value: summary.causalChainCount },
  ]

  return (
    <>
    {activeTab === 'graph' ? (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ padding: '12px 16px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="collection-header" style={{ marginBottom: 8 }}>
            <h1>{summary.name}</h1>
            <div className="collection-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate({ page: 'ingest' })}>Add documents</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={exporting} onClick={handleExport}>
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
          <Tabs tabs={collectionTabs} active={activeTab} onChange={setTab} />
        </div>
        <CollectionGraphPanel collectionName={name} />
      </div>
    ) : (
    <div className="page-container">
      <div className="collection-header">
        <h1>{summary.name}</h1>
        <div className="collection-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate({ page: 'ingest' })}>Add documents</button>
          <button type="button" className="btn btn-secondary" disabled={exporting} onClick={handleExport}>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setTab('graph')}>Open graph</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <EditableText
          value={summary.description}
          placeholder="Add a collection description..."
          onSave={(desc) => updateDescription(name, desc)}
        />
      </div>

      <Tabs tabs={collectionTabs} active={activeTab} onChange={setTab} />

      {/* Remove error toast */}
      {removeError && (
        <div className="card mb-4" style={{ borderColor: 'var(--error)', background: 'rgba(239,68,68,0.08)', maxWidth: '500px' }}>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--error)', fontSize: '13px' }}>{removeError}</span>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => setRemoveError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="cockpit-container">
          <div className="cockpit-left">
            <StatsGrid stats={stats} />
            <CollapsibleSection title="Top Entities" count={topEntities.length} defaultExpanded>
              {topEntities.length === 0 ? (
                <div className="empty-state">No entities found.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topEntities.map(e => (
                    <span key={e.name} className="pill pill-entity" onClick={() => navigate({ page: 'entity', name: e.name })}>
                      <CategoryBadge category={e.category} size="sm" />
                      <span style={{ marginLeft: 4 }}>{e.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>
          <div className="cockpit-right">
            <CollapsibleSection title="Category Breakdown" count={categories.length} defaultExpanded>
              {categories.length === 0 ? (
                <div className="empty-state">No entities to categorize.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {categories.map(c => {
                    const maxCount = categories[0]?.count || 1
                    const pct = (c.count / maxCount) * 100
                    const color = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other!
                    return (
                      <div key={c.category} className="flex items-center gap-3" style={{ fontSize: 12 }}>
                        <span style={{ width: 100, flexShrink: 0 }}><CategoryBadge category={c.category} /></span>
                        <div style={{ flex: 1, height: 6, background: 'var(--surface-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                        </div>
                        <span style={{ color: 'var(--text-secondary)', width: 30, textAlign: 'right' }}>{c.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CollapsibleSection>
            <CollapsibleSection title="Recommended Documents" count={recommendations.length} defaultExpanded={recommendations.length > 0}>
              {recommendations.length === 0 ? (
                <div className="empty-state">No recommendations available.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Document</th><th>Shared</th><th /></tr></thead>
                  <tbody>
                    {recommendations.map(r => (
                      <tr key={r.uniqueId}>
                        <td><span className="data-link" onClick={() => navigate({ page: 'project', uniqueId: r.uniqueId })}>{r.name}</span></td>
                        <td>{r.sharedCount}</td>
                        <td><button className="btn btn-primary btn-sm" onClick={() => handleAddRecommendation(r.uniqueId)}>Add</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <CollapsibleSection title="Documents" count={projects.length} defaultExpanded>
          <p className="research-tab-note">Open a document to inspect its extracted findings, or view the original source to check the evidence.</p>
          {projects.length > 0 && <div className="research-documents-controls"><input className="input" type="search" aria-label="Search documents" placeholder="Search by title, domain, or tag…" value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} /><span>{filteredProjects.length} of {projects.length}</span></div>}
          {projects.length === 0 ? (
            <div className="empty-state">No documents in this collection.</div>
          ) : filteredProjects.length === 0 ? (
            <div className="empty-state">No matching documents. Try another title or tag.</div>
          ) : (
            <div className="research-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Domain</th>
                  <th>Tags</th>
                  <th>Entities</th>
                  <th>Source</th>
                  <th style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => (
                  <tr key={p.uniqueId}>
                    <td>
                      <button type="button" className="data-link" style={{ border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate({ page: 'project', uniqueId: p.uniqueId, fromCollection: name })}>{p.name}</button>
                      <InfoTag type="project" name={p.name} scope={{ collection: name, projectUniqueId: p.uniqueId, projectName: p.name }} />
                    </td>
                    <td><span style={{ fontSize: 12 }}>{p.domain}{p.subdomain && <span style={{ color: 'var(--text-muted)' }}> / {p.subdomain}</span>}</span></td>
                    <td><PillList items={p.tags} maxVisible={3} variant="tag" /></td>
                    <td>{p.entityCount}</td>
                    <td>{p.htmlPath && <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate({ page: 'source', htmlPath: p.htmlPath })}>Read source</button>}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => setRemoveTarget({ uniqueId: p.uniqueId, projectName: p.name })}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CollapsibleSection>
      )}

      {activeTab === 'bridges' && (
        <CollapsibleSection title="Bridge Entities" count={bridges.length} defaultExpanded>
          <p className="research-tab-note">Shared entities connect two or more documents in this collection. Compare the linked sources to see where their findings overlap; a shared mention alone does not establish agreement.</p>
          {bridges.length === 0 ? (
            <div className="empty-state">No bridge entities yet (need 2+ documents sharing entities).</div>
          ) : (
            <div className="flex flex-col gap-3">
              {bridges.map(b => (
                <div key={b.name} className="card" style={{ padding: '12px 16px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <div className="flex items-center gap-2">
                      <span className="data-link" style={{ fontWeight: 600 }} onClick={() => navigate({ page: 'entity', name: b.name })}>{b.name}</span>
                      <CategoryBadge category={b.category} />
                      <BridgeBadge tier={b.tier} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.projectCount} documents</span>
                  </div>
                  {b.projectNames && b.projectNames.length > 0 && (
                    <PillList items={b.projectNames} maxVisible={5} variant="collection" onItemClick={(p) => {
                      const proj = projects.find(pr => pr.name === p)
                      if (proj) navigate({ page: 'project', uniqueId: proj.uniqueId })
                    }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}

      {activeTab === 'chains' && (
        <CollapsibleSection title="Causal Chains" count={chains.length} defaultExpanded>
          <p className="research-tab-note">Explore the reasoning extracted from each source. Follow the linked document to verify the evidence and its context.</p>
          {chains.length === 0 ? (
            <div className="empty-state">No causal chains found.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {chains.map((chain, idx) => (
                <CausalChainCard key={idx} chain={chain} onNavigate={navigate} />
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}

    </div>
    )}

      {/* Remove Document Confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        title="Remove Document"
        message={`Remove "${removeTarget?.projectName}" from this collection? The document itself won't be deleted.`}
        confirmLabel="Remove"
        danger
        onConfirm={handleRemoveProject}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* Export Modal Overlay */}
      {exporting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(6px)'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '640px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)'
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Exporting Collection: {name}
              </h2>
              {exportStatus !== 'running' && (
                <button
                  className="btn btn-secondary"
                  aria-label="Close export"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setExporting(false)
                    setExportProcessId(null)
                    setExportStatus('idle')
                    setExportLogs('')
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              {exportStatus === 'running' && 'Compiling Neo4j knowledge graph, raw embeddings, and styled HTML documents into a portable ZIP package...'}
              {exportStatus === 'success' && 'Your portable collection is ready. Download the archive to back up or share these research sources.'}
              {exportStatus === 'failed' && `Export failed: ${exportError || 'Check process logs below.'}`}
            </p>
            
            {/* Logs console */}
            <div style={{
              background: '#0b0c0e',
              border: '1px solid var(--divider)',
              borderRadius: '12px',
              padding: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: '#d97706', // gold/amber logs
              height: '240px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              marginBottom: '20px'
            }}>
              {exportLogs}
            </div>

            <div className="flex justify-between items-center">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {exportStatus === 'running' && 'Preparing your collection…'}
                {exportStatus === 'success' && 'Finished successfully.'}
                {exportStatus === 'failed' && 'Process exited with error.'}
              </span>
              <div className="flex gap-2">
                {exportStatus === 'success' && exportDownloadUrl && <a className="btn btn-primary" href={exportDownloadUrl} download>Download ZIP</a>}
                {exportStatus === 'failed' && exportProcessId && <button type="button" className="btn btn-secondary" onClick={() => { setExportError(''); setExportStatus('running') }}>Check again</button>}
                {exportStatus === 'failed' && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setExporting(false)
                      setExportProcessId(null)
                      setExportStatus('idle')
                      setExportLogs('')
                    }}
                  >
                    Close
                  </button>
                )}
                {exportStatus === 'running' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <div className="loading-spinner" style={{ width: '16px', height: '16px', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Please wait...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Causal Chain Card (collapsible) ─────────────────────

function CausalChainCard({ chain, onNavigate }: {
  chain: CausalChainItem
  onNavigate: (route: import('../types/frontend').Route) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      {/* Header — always visible, click to expand */}
      <div
        className="flex items-center justify-between"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
            ▶
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            {chain.chainName}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            ({chain.links.length} links)
          </span>
        </div>
        <span className="flex items-center gap-1">
          <span
            className="data-link"
            style={{ fontSize: '11px' }}
            onClick={(e) => { e.stopPropagation(); chain.projectId && onNavigate({ page: 'project', uniqueId: chain.projectId }) }}
          >
            {chain.projectName}
          </span>
          {chain.projectId && <InfoTag type="project" name={chain.projectName} scope={{ projectUniqueId: chain.projectId, projectName: chain.projectName }} />}
        </span>
      </div>

      {/* Expanded content — full description + links with full explanations */}
      {expanded && (
        <div style={{ marginTop: '10px' }}>
          {chain.chainDescription && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px', lineHeight: 1.7 }}>
              {chain.chainDescription}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {chain.links.map((link, i) => (
              <div key={i} style={{ fontSize: '12px' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)', width: '16px', textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  <span className="data-link" onClick={() => onNavigate({ page: 'entity', name: link.source })}>
                    {link.source}
                  </span>
                  <InfoTag type="entity" name={link.source} scope={{}} />
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span className="data-link" onClick={() => onNavigate({ page: 'entity', name: link.target })}>
                    {link.target}
                  </span>
                  <InfoTag type="entity" name={link.target} scope={{}} />
                </div>
                {link.explanation && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', marginLeft: '24px', lineHeight: 1.6, marginTop: '2px' }}>
                    {link.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
