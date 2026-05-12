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
      onClick={handleClick}
      style={{
        display: 'inline-block',
        padding: '0px 5px',
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.03em',
        color: 'rgb(74, 222, 128)',
        background: 'rgba(74, 222, 128, 0.1)',
        border: '1px solid rgba(74, 222, 128, 0.25)',
        borderRadius: '3px',
        cursor: 'pointer',
        lineHeight: '16px',
        verticalAlign: 'middle',
        marginLeft: '4px',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'rgb(74, 222, 128)'
        e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.5)'
        e.currentTarget.style.background = 'rgba(74, 222, 128, 0.18)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'rgb(74, 222, 128)'
        e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)'
        e.currentTarget.style.background = 'rgba(74, 222, 128, 0.1)'
      }}
    >
      info
    </span>
  )
}
