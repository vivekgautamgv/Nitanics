import { useNavigationStore } from './stores/navigation-store'
import AppSidebar from './components/shell/AppSidebar'
import PageHeader from './components/shell/PageHeader'
import ContentArea from './components/shell/ContentArea'
import Router from './router/Router'
import RightSidebar from './components/RightSidebar'
import { useRSBStore } from './stores/rsb-store'
import { useUIStore } from './stores/ui-store'

function useFullBleed(): boolean {
  const route = useNavigationStore(s => s.route)
  if (route.page === 'collection' && route.tab === 'graph') return true
  if (route.page === 'graph') return true
  if (route.page === 'source') return true
  return false
}

function useShowRsb(): boolean {
  return useRSBStore(s => s.isOpen)
}

export default function App() {
  const fullBleed = useFullBleed()
  const showRsb = useShowRsb()
  const sidebarCollapsed = useUIStore(s => s.sidebarCollapsed)

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'app-shell-collapsed' : ''}`}>
      <AppSidebar />
      <div className="app-main">
        <PageHeader />
        <div className="flex flex-1 min-h-0">
          <ContentArea fullBleed={fullBleed}>
            <Router />
          </ContentArea>
          {showRsb && <RightSidebar />}
        </div>
      </div>
    </div>
  )
}
