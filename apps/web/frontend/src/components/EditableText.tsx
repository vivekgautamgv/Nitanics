/**
 * EditableText — click to edit text inline.
 */
import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string | null
  placeholder?: string
  multiline?: boolean
  onSave: (value: string) => void
}

export default function EditableText({ value, placeholder = 'Click to add description...', multiline, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  const handleSave = () => {
    setEditing(false)
    if (draft !== (value || '')) {
      onSave(draft)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave()
    }
    if (e.key === 'Escape') {
      setDraft(value || '')
      setEditing(false)
    }
  }

  if (editing) {
    const sharedProps = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className: 'input',
      placeholder,
      style: { fontSize: '13px' } as React.CSSProperties,
    }

    return multiline ? (
      <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} {...sharedProps} rows={3} />
    ) : (
      <input ref={inputRef as React.RefObject<HTMLInputElement>} {...sharedProps} />
    )
  }

  return (
    <div
      onClick={() => { setDraft(value || ''); setEditing(true) }}
      className="cursor-pointer"
      style={{
        color: value ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontSize: '13px',
        fontStyle: value ? 'normal' : 'italic',
        lineHeight: 1.6,
      }}
      title="Click to edit"
    >
      {value || placeholder}
    </div>
  )
}
