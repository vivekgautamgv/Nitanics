/**
 * InfoTag — small tag button that opens the RSB info panel.
 *
 * Placed next to entity/project names throughout the app.
 * Click entity name → navigate to entity page (full page).
 * Click InfoTag → RSB slides out with scoped detail (stays on page).
 */
import { useRSBStore, type RSBScope } from '../stores/rsb-store'

export default function InfoTag({
  type,
  name,
  scope,
}: {
  type: 'entity' | 'project'
  name: string
  scope?: RSBScope
}) {
  const openEntityCard = useRSBStore(s => s.openEntityCard)
  const openProjectCard = useRSBStore(s => s.openProjectCard)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (type === 'entity') openEntityCard(name, scope)
    else openProjectCard(name, scope)
  }

  return (
    <span
      className="info-tag"
      onClick={handleClick}
      title="Open details"
    >
      info
    </span>
  )
}
