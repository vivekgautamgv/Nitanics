import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Debug: expose stores for browser console testing (dev only)
if (import.meta.env.DEV) {
  import('./stores/graph-store').then(m => {
    (window as unknown as Record<string, unknown>).__graphStore = m.useGraphStore
  })
  import('./stores/selection-store').then(m => {
    (window as unknown as Record<string, unknown>).__selectionStore = m.useSelectionStore
  })
  import('./stores/ui-store').then(m => {
    (window as unknown as Record<string, unknown>).__uiStore = m.useUIStore
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
