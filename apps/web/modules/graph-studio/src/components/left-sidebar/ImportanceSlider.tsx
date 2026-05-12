import { useCallback, useRef } from 'react'
import { useGraphStore } from '../../stores/graph-store'
import CollapsibleSection from '../shared/CollapsibleSection'

export default function ImportanceSlider() {
  const bandwidthRange = useGraphStore(s => s.bandwidthRange)
  const setBandwidthRange = useGraphStore(s => s.setBandwidthRange)
  const filteredCount = useGraphStore(s => s.filteredNodes.filter(n => n.__type === 'entity').length)
  const totalCount = useGraphStore(s => s.allNodes.filter(n => n.__type === 'entity').length)

  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'min' | 'max' | null>(null)

  const [min, max] = bandwidthRange

  const posToValue = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * 100)
  }, [])

  const handlePointerDown = useCallback((thumb: 'min' | 'max') => (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = thumb
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const val = posToValue(e.clientX)
    if (dragging.current === 'min') {
      if (val <= max) setBandwidthRange([val, max])
    } else {
      if (val >= min) setBandwidthRange([min, val])
    }
  }, [min, max, posToValue, setBandwidthRange])

  const handlePointerUp = useCallback(() => {
    dragging.current = null
  }, [])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const val = posToValue(e.clientX)
    const distToMin = Math.abs(val - min)
    const distToMax = Math.abs(val - max)
    if (distToMin <= distToMax) {
      if (val <= max) setBandwidthRange([val, max])
    } else {
      if (val >= min) setBandwidthRange([min, val])
    }
  }, [min, max, posToValue, setBandwidthRange])

  return (
    <CollapsibleSection title="Importance" id="lsb-importance">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Threshold window
            </div>
            <div className="mt-1 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
              {min} to {max}
            </div>
          </div>
          <div className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}>
            {filteredCount} / {totalCount}
          </div>
        </div>

        <div
          ref={trackRef}
          className="relative h-8 cursor-pointer rounded-full"
          onClick={handleTrackClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{ height: 6, background: 'rgba(148, 163, 184, 0.22)' }}
          />

          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{
              height: 6,
              left: `${min}%`,
              width: `${max - min}%`,
              background: 'var(--accent)',
              opacity: 0.88,
            }}
          />

          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full cursor-grab active:cursor-grabbing"
            style={{
              left: `${min}%`,
              width: 16,
              height: 16,
              background: '#ffffff',
              border: '2px solid var(--accent)',
              boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
              zIndex: min === max ? 2 : 1,
            }}
            onPointerDown={handlePointerDown('min')}
          />

          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full cursor-grab active:cursor-grabbing"
            style={{
              left: `${max}%`,
              width: 16,
              height: 16,
              background: '#ffffff',
              border: '2px solid var(--accent)',
              boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
              zIndex: 1,
            }}
            onPointerDown={handlePointerDown('max')}
          />
        </div>

        <div className="text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>
          Focuses the workspace on higher-signal entities without removing project anchors.
        </div>
      </div>
    </CollapsibleSection>
  )
}
