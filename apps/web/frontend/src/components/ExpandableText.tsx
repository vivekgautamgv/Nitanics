import { useState } from 'react'

/**
 * ExpandableText — inline expand/collapse for long text.
 * Shows truncated text with a "more" toggle; expands to full text on click.
 */
export default function ExpandableText({
  text,
  maxLength = 150,
  fontSize = '12px',
  color = 'var(--text-secondary)',
}: {
  text: string
  maxLength?: number
  fontSize?: string
  color?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = text.length > maxLength

  if (!needsTruncation) {
    return (
      <span style={{ color, fontSize, lineHeight: 1.6 }}>
        {text}
      </span>
    )
  }

  return (
    <span style={{ color, fontSize, lineHeight: 1.6 }}>
      {expanded ? text : text.slice(0, maxLength) + '...'}
      {' '}
      <span
        className="data-link"
        style={{ fontSize: '11px' }}
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
      >
        {expanded ? 'less' : 'more'}
      </span>
    </span>
  )
}
