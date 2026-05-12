/**
 * CategoryBadge — Color dot + category name
 */

import { CATEGORY_COLORS } from '../../constants/colors'

interface Props {
  category: string
  size?: number
}

export default function CategoryBadge({ category, size = 8 }: Props) {
  const color = CATEGORY_COLORS[category] || '#6B7280'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="rounded-full inline-block flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: color }}
      />
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {category}
      </span>
    </span>
  )
}
