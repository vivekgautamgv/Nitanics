/**
 * ExportButton — LSB Section 10: Export collection data
 *
 * Source of truth: DESIGN-SPEC.md Section 13
 * Graph Studio is a browser app, so export = CLI instructions.
 * Shows the command to run for export/import.
 */

import { useState } from 'react'
import { useGraphStore } from '../../stores/graph-store'
import CollapsibleSection from '../shared/CollapsibleSection'

export default function ExportButton() {
  const [showModal, setShowModal] = useState(false)
  const collection = useGraphStore(s => s.collection)

  return (
    <CollapsibleSection title="Export" defaultOpen={false} id="lsb-export">
      <div className="space-y-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Export collection data for backup or sharing.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="w-full text-xs py-1.5 px-2 rounded"
          style={{
            background: 'var(--surface-hover)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        >
          Export Collection
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded-lg p-4 max-w-md"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Export: {collection}
            </h3>

            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Run the following command from the project root to export this collection:
            </p>

            <div
              className="rounded px-3 py-2 mb-3 text-xs font-mono"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--accent)' }}
            >
              python neo4j/export_collection.py --collection "{collection}"
            </div>

            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              This creates a ZIP file in <code style={{ color: 'var(--text-secondary)' }}>apps/exports/</code> containing
              all nodes, relationships, and metadata. Import on another machine with:
            </p>

            <div
              className="rounded px-3 py-2 mb-3 text-xs font-mono"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--accent)' }}
            >
              python neo4j/import_collection.py apps/exports/collection.zip
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="text-xs py-1 px-3 rounded"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
