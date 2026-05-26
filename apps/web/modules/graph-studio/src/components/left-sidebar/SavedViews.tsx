import { useGraphStore } from '../../stores/graph-store'
import CollapsibleSection from '../shared/CollapsibleSection'

interface ViewPreset {
  name: string
  description: string
  apply: () => void
}

export default function SavedViews() {
  const store = useGraphStore

  const presets: ViewPreset[] = [
    {
      name: 'Overview',
      description: 'Reset to the full collection view',
      apply: () => {
        store.getState().resetAllFilters()
      },
    },
    {
      name: 'Bridges Only',
      description: 'Keep only the strongest bridge entities',
      apply: () => {
        store.getState().resetAllFilters()
        store.getState().setBridgeFilter(new Set(['gold', 'silver']))
      },
    },
    {
      name: 'High Influence',
      description: 'Focus on the top 30% by importance',
      apply: () => {
        store.getState().resetAllFilters()
        store.getState().setBandwidthRange([70, 100])
      },
    },
  ]

  return (
    <CollapsibleSection title="Quick Views" defaultOpen={false} id="lsb-views">
      <div className="space-y-2">
        {presets.map(preset => (
          <button
            key={preset.name}
            onClick={preset.apply}
            className="w-full rounded-2xl border px-3 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
          >
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{preset.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: 3 }}>{preset.description}</div>
          </button>
        ))}
      </div>
    </CollapsibleSection>
  )
}
