import { useNavigationStore } from '../../stores/navigation-store'
import { useUIStore } from '../../stores/ui-store'

export default function PageHeader() {
  const breadcrumbs = useNavigationStore(s => s.breadcrumbs)
  const navigate = useNavigationStore(s => s.navigate)
  const toggleSidebar = useUIStore(s => s.toggleSidebar)
  const sidebarCollapsed = useUIStore(s => s.sidebarCollapsed)
  const mobileOpen = useUIStore(s => s.mobileSidebarOpen)
  const setMobileOpen = useUIStore(s => s.setMobileSidebarOpen)

  return (
    <header className="page-header">
      <button
        type="button"
        className="page-header-menu btn btn-ghost btn-sm desktop-menu-toggle"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={toggleSidebar}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        className="page-header-menu btn btn-ghost btn-sm mobile-menu-toggle"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        aria-controls="workspace-sidebar"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <nav className="page-header-breadcrumbs" aria-label="Breadcrumb">
        {breadcrumbs.map((seg, i) => (
          <span key={i} className="breadcrumb-wrap">
            {i > 0 && <span className="breadcrumb-separator">/</span>}
            {seg.route ? (
              <button type="button" className="breadcrumb-segment" onClick={() => navigate(seg.route!)}>
                {seg.label}
              </button>
            ) : (
              <span className="breadcrumb-current">{seg.label}</span>
            )}
          </span>
        ))}
      </nav>
      <span className="page-header-context">Local workspace</span>
    </header>
  )
}
