import { useGraphStore } from '../../stores/graph-store'
import CollapsibleSection from '../shared/CollapsibleSection'

export default function ProjectFilter() {
  const projects = useGraphStore(s => s.projects)
  const projectFilter = useGraphStore(s => s.projectFilter)
  const toggleProject = useGraphStore(s => s.toggleProject)
  const selectAll = useGraphStore(s => s.selectAllProjects)
  const deselectAll = useGraphStore(s => s.deselectAllProjects)

  const allSelected = projects.length > 0 && projects.every(p => projectFilter.has(p.uniqueId))

  return (
    <CollapsibleSection title="Projects" count={projects.length} id="lsb-projects">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
        <span>Scope</span>
        <button
          onClick={allSelected ? deselectAll : selectAll}
          className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          {allSelected ? 'Hide All' : 'Show All'}
        </button>
      </div>

      <div className="space-y-2">
        {projects.map(p => {
          const active = projectFilter.has(p.uniqueId)
          return (
            <label
              key={p.uniqueId}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
              style={{
                borderColor: active ? 'rgba(56, 189, 248, 0.25)' : 'var(--border-subtle)',
                background: active ? 'var(--surface-hover)' : 'var(--surface-raised)',
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleProject(p.uniqueId)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: active ? 'var(--accent)' : 'rgba(148, 163, 184, 0.55)' }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                {p.name}
              </span>
            </label>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}
