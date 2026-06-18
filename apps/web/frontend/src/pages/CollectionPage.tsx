/**
 * CollectionPage — Full collection console.
 * Sections: Summary, Projects, Bridge Entities, Categories, Causal Chains, Recommendations
 * Source of truth: DESIGN-SPEC.md Section 7
 */
import { useEffect, useState } from 'react'
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
import type { CausalChainItem } from '../types/frontend'

export default function CollectionPage({ name }: { name: string }) {
  const {
    summary, projects, bridges, topEntities, categories, chains, recommendations,
    isLoading, error, loadCollection, addProject, removeProject, updateDescription,
  } = useCollectionStore()
  const navigate = useNavigationStore(s => s.navigate)

  const [removeTarget, setRemoveTarget] = useState<{ uniqueId: string; projectName: string } | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProcessId, setExportProcessId] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [exportLogs, setExportLogs] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    loadCollection(name)
  }, [name, loadCollection])

  // Poll export status endpoint
  useEffect(() => {
    if (!exportProcessId || exportStatus !== 'running') return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5176/api/status?id=${exportProcessId}`)
        if (!res.ok) throw new Error('Failed to query export status')
        const data = await res.json()
        setExportLogs(data.logs || '')
        if (data.status !== 'running') {
          setExportStatus(data.status)
          if (data.status === 'success') {
            const slug = name.toLowerCase().replace(/ /g, '-').replace(/:/g, '').replace(/--/g, '-').replace(/^-+|-+$/g, '')
            const downloadUrl = `http://127.0.0.1:5176/api/download?file=${slug}.zip`
            const a = document.createElement('a')
            a.href = downloadUrl
            a.download = `${slug}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            
            // Auto close after 2 seconds on success
            setTimeout(() => {
              setExporting(false)
              setExportProcessId(null)
              setExportStatus('idle')
              setExportLogs('')
            }, 2000)
          }
        }
      } catch (err: any) {
        setExportLogs(prev => prev + `\n[UI ERROR] Connection to API server lost: ${err.message}\n`)
        setExportStatus('failed')
        setExportError(err.message)
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [exportProcessId, exportStatus, name])

  const handleRemoveProject = async () => {
    if (!removeTarget) return
    const removed = await removeProject(removeTarget.uniqueId, name)
    if (!removed) {
      setRemoveError(`Cannot remove "${removeTarget.projectName}" — it's in no other collection.`)
    }
    setRemoveTarget(null)
  }

  const handleAddRecommendation = async (uniqueId: string) => {
    await addProject(uniqueId, name)
  }

  const handleExport = async () => {
    setExporting(true)
    setExportStatus('running')
    setExportLogs('[UI] Requesting backend collection export...\n')
    setExportError('')

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
    { label: 'Projects', value: summary.projectCount },
    { label: 'Entities', value: summary.entityCount },
    { label: 'Relationships', value: summary.relationshipCount },
    { label: 'Causal Chains', value: summary.causalChainCount },
  ]

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>
          {summary.name}
        </h1>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '6px 14px' }}
            disabled={exporting}
            onClick={handleExport}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate({ page: 'graph', collectionName: name })}
          >
            Open Graph Studio
          </button>
        </div>
      </div>

      {/* Editable description */}
      <div style={{ marginBottom: '16px' }}>
        <EditableText
          value={summary.description}
          placeholder="Add a description..."
          onSave={(desc) => updateDescription(name, desc)}
        />
      </div>

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

      {/* Cockpit layout */}
      <div className="cockpit-container">
        {/* Left main panel */}
        <div className="cockpit-left">
          {/* Projects Section */}
          <CollapsibleSection title="Projects" count={projects.length}>
            {projects.length === 0 ? (
              <div className="empty-state">No projects in this collection.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Domain</th>
                    <th>Tags</th>
                    <th>Entities</th>
                    <th>Source</th>
                    <th style={{ width: '70px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.uniqueId}>
                      <td>
                        <span className="data-link" onClick={() => navigate({ page: 'project', uniqueId: p.uniqueId, fromCollection: name })}>
                          {p.name}
                        </span>
                        <InfoTag type="project" name={p.name} scope={{ collection: name, projectUniqueId: p.uniqueId, projectName: p.name }} />
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {p.domain}
                          {p.subdomain && <span style={{ color: 'var(--text-muted)' }}> / {p.subdomain}</span>}
                        </span>
                      </td>
                      <td>
                        <PillList items={p.tags} maxVisible={3} variant="tag" />
                      </td>
                      <td>{p.entityCount}</td>
                      <td>
                        {p.htmlPath && (
                          <span className="data-link" style={{ fontSize: '11px' }} onClick={() => navigate({ page: 'source', htmlPath: p.htmlPath })}>
                            View
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => setRemoveTarget({ uniqueId: p.uniqueId, projectName: p.name })}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          {/* Recommendations Section */}
          <CollapsibleSection title="Recommended Projects" count={recommendations.length} defaultExpanded={recommendations.length > 0}>
            {recommendations.length === 0 ? (
              <div className="empty-state">All available projects are already in this collection. Add new projects or create other collections to see cross-collection recommendations.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Domain</th>
                    <th>Shared Entities</th>
                    <th style={{ width: '70px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map(r => (
                    <tr key={r.uniqueId}>
                      <td>
                        <span className="data-link" onClick={() => navigate({ page: 'project', uniqueId: r.uniqueId })}>
                          {r.name}
                        </span>
                        <InfoTag type="project" name={r.name} scope={{ collection: name, projectUniqueId: r.uniqueId, projectName: r.name }} />
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {r.domain}
                          {r.subdomain && <span style={{ color: 'var(--text-muted)' }}> / {r.subdomain}</span>}
                        </span>
                      </td>
                      <td>
                        <PillList
                          items={r.sharedEntityNames}
                          maxVisible={3}
                          variant="entity"
                          onItemClick={(e) => navigate({ page: 'entity', name: e })}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => handleAddRecommendation(r.uniqueId)}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          {/* Causal Chains Section */}
          <CollapsibleSection title="Causal Chains" count={chains.length} defaultExpanded={chains.length > 0}>
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
        </div>

        {/* Right side panel */}
        <div className="cockpit-right">
          {/* Stats Grid */}
          <StatsGrid stats={stats} />

          {/* Bridge Entities Section */}
          <CollapsibleSection title="Bridge Entities" count={bridges.length}>
            {bridges.length === 0 ? (
              <div className="empty-state">No bridge entities yet (need 2+ projects sharing entities).</div>
            ) : (
              <div className="flex flex-col gap-3">
                {bridges.map(b => (
                  <div key={b.name} className="card" style={{ padding: '12px 16px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                      <div className="flex items-center gap-2">
                        <span
                          className="data-link"
                          style={{ fontSize: '14px', fontWeight: 600 }}
                          onClick={() => navigate({ page: 'entity', name: b.name })}
                        >
                          {b.name}
                        </span>
                        <InfoTag type="entity" name={b.name} scope={{ collection: name }} />
                        <CategoryBadge category={b.category} />
                        <BridgeBadge tier={b.tier} />
                      </div>
                      <div className="flex items-center gap-3" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>{b.projectCount} projects</span>
                        <span>PR: {b.pageRank.toFixed(2)}</span>
                      </div>
                    </div>
                    {/* Show which projects this bridge connects */}
                    {b.projectNames && b.projectNames.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Connects: </span>
                        <PillList
                          items={b.projectNames}
                          maxVisible={5}
                          variant="collection"
                          onItemClick={(p) => {
                            const proj = projects.find(pr => pr.name === p)
                            if (proj) navigate({ page: 'project', uniqueId: proj.uniqueId })
                          }}
                        />
                      </div>
                    )}
                    {/* Show connected entities */}
                    {b.connectedEntities && b.connectedEntities.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Related to: </span>
                        <span style={{ fontSize: '12px' }}>
                          {b.connectedEntities.slice(0, 6).map((ce, i) => (
                            <span key={ce}>
                              {i > 0 && <span style={{ color: 'var(--text-muted)' }}>, </span>}
                              <span className="data-link" onClick={() => navigate({ page: 'entity', name: ce })}>{ce}</span>
                              <InfoTag type="entity" name={ce} scope={{ collection: name }} />
                            </span>
                          ))}
                          {b.connectedEntities.length > 6 && (
                            <span style={{ color: 'var(--text-muted)' }}> +{b.connectedEntities.length - 6} more</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Category Breakdown Section */}
          <CollapsibleSection title="Category Breakdown" count={categories.length} defaultExpanded={true}>
            {categories.length === 0 ? (
              <div className="empty-state">No entities to categorize.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {categories.map(c => {
                  const maxCount = categories[0]?.count || 1
                  const pct = (c.count / maxCount) * 100
                  const color = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other!
                  return (
                    <div key={c.category} className="flex items-center gap-3" style={{ fontSize: '12px' }}>
                      <span style={{ width: '100px', flexShrink: 0 }}>
                        <CategoryBadge category={c.category} />
                      </span>
                      <div style={{ flex: 1, height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                      </div>
                      <span style={{ color: 'var(--text-secondary)', width: '30px', textAlign: 'right', flexShrink: 0 }}>
                        {c.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* Top Entities Section */}
          <CollapsibleSection title="Top Entities" count={topEntities.length} defaultExpanded={true}>
            {topEntities.length === 0 ? (
              <div className="empty-state">No entities found.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topEntities.map(e => (
                  <span
                    key={e.name}
                    className="pill pill-entity"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate({ page: 'entity', name: e.name })}
                  >
                    <CategoryBadge category={e.category} size="sm" />
                    <span style={{ marginLeft: '4px' }}>{e.name}</span>
                    <InfoTag type="entity" name={e.name} scope={{ collection: name }} />
                  </span>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>

      {/* Remove Project Confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        title="Remove Project"
        message={`Remove "${removeTarget?.projectName}" from this collection? The project itself won't be deleted.`}
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
              {exportStatus === 'failed' && (
                <button
                  className="btn btn-secondary"
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
              {exportStatus === 'success' && 'Export successful! Downloading your collection ZIP archive...'}
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
                {exportStatus === 'running' && 'Executing export_collection.py...'}
                {exportStatus === 'success' && 'Finished successfully.'}
                {exportStatus === 'failed' && 'Process exited with error.'}
              </span>
              <div className="flex gap-2">
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
    </div>
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
