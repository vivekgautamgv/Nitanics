import TopNav from './components/TopNav'
import Router from './router/Router'
import RightSidebar from './components/RightSidebar'

export default function App() {
  return (
    <div className="h-full w-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <TopNav />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-auto">
          <Router />
        </div>
        <RightSidebar />
      </div>
    </div>
  )
}
