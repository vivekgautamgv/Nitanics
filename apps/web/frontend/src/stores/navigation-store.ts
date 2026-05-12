/**
 * Navigation Store — route state, breadcrumbs, history
 * Source of truth: DESIGN-SPEC.md Section 16
 */
import { create } from 'zustand'
import type { Route, BreadcrumbSegment } from '../types/frontend'

interface NavigationStore {
  route: Route
  breadcrumbs: BreadcrumbSegment[]
  history: Route[]

  navigate: (route: Route) => void
  goBack: () => void
}

// ── Route ↔ Hash conversion ──────────────────────────────

export function routeToHash(route: Route): string {
  switch (route.page) {
    case 'home':
      return '#/'
    case 'directory':
      return `#/directory/${encodeURIComponent(route.name)}`
    case 'collection':
      return `#/collection/${encodeURIComponent(route.name)}`
    case 'project': {
      const base = `#/project/${encodeURIComponent(route.uniqueId)}`
      return route.fromCollection
        ? `${base}?from=${encodeURIComponent(route.fromCollection)}`
        : base
    }
    case 'entity':
      return `#/entity/${encodeURIComponent(route.name)}`
    case 'graph':
      return `#/graph/${encodeURIComponent(route.collectionName)}`
    case 'source':
      // TRAP T25: htmlPath has slashes — must use query param
      return `#/source?path=${encodeURIComponent(route.htmlPath)}`
    case 'settings':
      return '#/settings'
  }
}

export function hashToRoute(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const [pathname, queryString] = raw.split('?')
  const segments = (pathname || '/').split('/').filter(Boolean)

  if (segments.length === 0) return { page: 'home' }

  const page = segments[0]
  const param = segments[1] ? decodeURIComponent(segments[1]) : ''

  switch (page) {
    case 'directory':
      return param ? { page: 'directory', name: param } : { page: 'home' }
    case 'collection':
      return param ? { page: 'collection', name: param } : { page: 'home' }
    case 'project': {
      if (!param) return { page: 'home' }
      const params = new URLSearchParams(queryString || '')
      const from = params.get('from') || undefined
      return { page: 'project', uniqueId: param, fromCollection: from }
    }
    case 'entity':
      return param ? { page: 'entity', name: param } : { page: 'home' }
    case 'graph':
      return param ? { page: 'graph', collectionName: param } : { page: 'home' }
    case 'source': {
      const params = new URLSearchParams(queryString || '')
      const path = params.get('path') || ''
      return path ? { page: 'source', htmlPath: path } : { page: 'home' }
    }
    case 'settings':
      return { page: 'settings' }
    default:
      return { page: 'home' }
  }
}

// ── Breadcrumb builder ───────────────────────────────────

export function buildBreadcrumbs(route: Route): BreadcrumbSegment[] {
  const home: BreadcrumbSegment = { label: 'Home', route: { page: 'home' } }

  switch (route.page) {
    case 'home':
      return [{ label: 'Home', route: null }]
    case 'directory':
      return [home, { label: route.name, route: null }]
    case 'collection':
      return [home, { label: route.name, route: null }]
    case 'project':
      if (route.fromCollection) {
        return [
          home,
          { label: route.fromCollection, route: { page: 'collection', name: route.fromCollection } },
          { label: 'Project', route: null },
        ]
      }
      return [home, { label: 'Project', route: null }]
    case 'entity':
      return [home, { label: `Entity: ${route.name}`, route: null }]
    case 'graph':
      return [
        home,
        { label: route.collectionName, route: { page: 'collection', name: route.collectionName } },
        { label: 'Graph Studio', route: null },
      ]
    case 'source':
      return [home, { label: 'Source', route: null }]
    case 'settings':
      return [home, { label: 'Settings', route: null }]
  }
}

// ── Store ────────────────────────────────────────────────

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  route: { page: 'home' },
  breadcrumbs: [{ label: 'Home', route: null }],
  history: [],

  navigate: (route) => {
    const current = get().route
    const newHistory = [...get().history, current]
    set({
      route,
      history: newHistory.length > 50 ? newHistory.slice(-50) : newHistory,
      breadcrumbs: buildBreadcrumbs(route),
    })
    window.location.hash = routeToHash(route)
  },

  goBack: () => {
    const history = get().history
    if (history.length === 0) return
    const prev = history[history.length - 1]!
    set({
      route: prev,
      history: history.slice(0, -1),
      breadcrumbs: buildBreadcrumbs(prev),
    })
    window.location.hash = routeToHash(prev)
  },
}))
