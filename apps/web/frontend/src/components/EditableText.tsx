/**
 * EditableText — click to edit text inline.
 */
import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string | null
  placeholder?: string
  multiline?: boolean
  onSave: (value: string) => void | Promise<void>
}

export default function EditableText({ value, placeholder = 'Click to add description...', multiline, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const savingRef = useRef(false)
  const canceledRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  const handleSave = async () => {
    if (savingRef.current || canceledRef.current) return
    if (draft === (value || '')) { setEditing(false); return }
    savingRef.current = true
    setSaving(true)
    setError('')
    try { await onSave(draft); setEditing(false) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { savingRef.current = false; setSaving(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave()
    }
    if (e.key === 'Escape') {
      canceledRef.current = true
      setDraft(value || '')
      setEditing(false)
    }
  }

  if (editing) {
    const sharedProps = {
      value: draft,
      disabled: saving,
      'aria-label': placeholder,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className: 'input',
      placeholder,
      style: { fontSize: '13px' } as React.CSSProperties,
    }

    const field = multiline ? (
      <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} {...sharedProps} rows={3} />
    ) : (
      <input ref={inputRef as React.RefObject<HTMLInputElement>} {...sharedProps} />
    )
    return <div>{field}{saving && <span role="status" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving…</span>}{error && <div className="form-error" role="alert">{error} Press Enter to retry.</div>}</div>
  }

  return (
    <button
      type="button"
      onClick={() => { canceledRef.current = false; setError(''); setDraft(value || ''); setEditing(true) }}
      className="cursor-pointer"
      style={{
        background: 'none', border: 0, padding: 0, textAlign: 'left',
        color: value ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontSize: '13px',
        fontStyle: value ? 'normal' : 'italic',
        lineHeight: 1.6,
      }}
      title="Click to edit"
    >
      {value || placeholder}
    </button>
  )
}
