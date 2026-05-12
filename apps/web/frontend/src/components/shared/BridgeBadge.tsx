import { BRIDGE_COLORS } from '../../constants/colors'

interface Props {
  tier: 'gold' | 'silver' | 'bronze' | 'none'
}

export default function BridgeBadge({ tier }: Props) {
  if (tier === 'none') {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }

  const color = BRIDGE_COLORS[tier]
  return (
    <span
      className="pill"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {tier}
    </span>
  )
}
