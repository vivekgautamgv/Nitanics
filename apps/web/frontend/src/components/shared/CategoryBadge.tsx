import { CATEGORY_COLORS } from '../../constants/colors'

interface Props {
  category: string
  size?: 'sm' | 'md'
}

export default function CategoryBadge({ category, size = 'sm' }: Props) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other!
  const dotSize = size === 'sm' ? 8 : 10
  const fontSize = size === 'sm' ? '12px' : '13px'

  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize }}>
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span style={{ color: 'var(--text-secondary)' }}>{category}</span>
    </span>
  )
}
