/**
 * Hash-based Router — renders the correct page based on current route.
 * Decision D42: No React Router library needed for 8 routes.
 * Decision D55: Hash-based routing, no SSR.
 */
import { useEffect } from 'react'
import { useNavigationStore, hashToRoute, buildBreadcrumbs } from '../stores/navigation-store'

import HomePage from '../pages/HomePage'
import DirectoryPage from '../pages/DirectoryPage'
import CollectionPage from '../pages/CollectionPage'
import ProjectPage from '../pages/ProjectPage'
import EntityPage from '../pages/EntityPage'
import GraphPage from '../pages/GraphPage'
import SourcePage from '../pages/SourcePage'
import SettingsPage from '../pages/SettingsPage'

export default function Router() {
  const route = useNavigationStore(s => s.route)

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const onHashChange = () => {
      const newRoute = hashToRoute(window.location.hash)
      const current = useNavigationStore.getState().route
      if (JSON.stringify(newRoute) !== JSON.stringify(current)) {
        useNavigationStore.setState({
          route: newRoute,
          breadcrumbs: buildBreadcrumbs(newRoute),
        })
      }
    }
    window.addEventListener('hashchange', onHashChange)
    // Parse initial hash on mount
    onHashChange()
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  switch (route.page) {
    case 'home':       return <HomePage />
    case 'directory':  return <DirectoryPage name={route.name} />
    case 'collection': return <CollectionPage name={route.name} />
    case 'project':    return <ProjectPage uniqueId={route.uniqueId} fromCollection={route.fromCollection} />
    case 'entity':     return <EntityPage name={route.name} />
    case 'graph':      return <GraphPage collectionName={route.collectionName} />
    case 'source':     return <SourcePage htmlPath={route.htmlPath} />
    case 'settings':   return <SettingsPage />
    default:           return <HomePage />
  }
}
