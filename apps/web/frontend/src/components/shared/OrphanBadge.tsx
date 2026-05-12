export default function OrphanBadge() {
  return (
    <span
      className="pill"
      style={{
        background: 'rgba(251, 191, 36, 0.1)',
        color: 'var(--warning)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        fontWeight: 500,
      }}
    >
      No collection
    </span>
  )
}
