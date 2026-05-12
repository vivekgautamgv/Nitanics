/**
 * ConfirmDialog — modal overlay for destructive actions.
 */

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel
}: Props) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', marginBottom: '12px' }}>
          {title}
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
