/**
 * RightSidebar (RSB) — slide-out info panel.
 *
 * Mounts in App.tsx as a flex sibling to Router.
 * Renders EntityInfoCard or ProjectInfoCard based on rsb-store state.
 * Auto-closes on route change. Closes on Escape key.
 */
import { useEffect, useCallback } from 'react'
import { useRSBStore } from '../stores/rsb-store'
import { useNavigationStore } from '../stores/navigation-store'
import EntityInfoCard from './rsb/EntityInfoCard'
import ProjectInfoCard from './rsb/ProjectInfoCard'

export default function RightSidebar() {
  const isOpen = useRSBStore(s => s.isOpen)
  const cardType = useRSBStore(s => s.cardType)
  const name = useRSBStore(s => s.name)
  const scope = useRSBStore(s => s.scope)
  const close = useRSBStore(s => s.close)
  const route = useNavigationStore(s => s.route)

  // Auto-close when route changes
  useEffect(() => {
    close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  // Escape key closes RSB
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) close()
  }, [isOpen, close])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  // Scope label for header subtitle
  const scopeLabel = scope.collection
    ? `in ${scope.collection}`
    : scope.projectName
      ? `in ${scope.projectName}`
      : 'Global'

  return (
    <>
      {/* Backdrop for narrow viewports (CSS media query shows/hides) */}
      <div className="rsb-backdrop" onClick={close} />

      <div className="rsb-container">
        {/* Header */}
        <div className="rsb-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rsb-header-title">{name}</div>
            <div className="rsb-header-subtitle">
              {cardType === 'entity' ? 'Entity' : 'Project'} {scopeLabel}
            </div>
          </div>
          <button className="rsb-close" onClick={close} title="Close (Esc)">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="rsb-body">
          {cardType === 'entity' && (
            <EntityInfoCard name={name} scope={scope} />
          )}
          {cardType === 'project' && (
            <ProjectInfoCard name={name} scope={scope} />
          )}
        </div>
      </div>
    </>
  )
}
