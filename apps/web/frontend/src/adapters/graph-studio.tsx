/**
 * Graph Studio adapter — wraps Component 02's App.tsx.
 * This is the ONLY file that imports App from C02.
 * GraphPage.tsx imports from HERE.
 *
 * Decision D41: App.tsx receives optional initialCollection prop.
 * Decision D61: All C02 imports go through adapters/.
 */
import { Component, type ReactNode } from 'react'
import GraphStudioApp from '@graph/App'
export { useRefreshOnFocus } from '@graph/hooks/useRefreshOnFocus'

interface Props {
  collectionName: string
  graphMode?: 'collection' | 'project' | 'bridge'
  selectedProjectId?: string
}

// Error boundary to catch react-force-graph-2d crashes gracefully
class GraphErrorBoundary extends Component<
  { children: ReactNode; collectionName: string },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(err: Error) {
    return { error: err.message }
  }

  componentDidCatch(err: Error) {
    console.error('GraphStudio crash:', err)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--error)', fontSize: '14px', marginBottom: '12px' }}>
            Graph Studio failed to render
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
            {this.state.error}
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function GraphStudioAdapter({ collectionName, graphMode, selectedProjectId }: Props) {
  return (
    <div className="h-full w-full">
      <GraphErrorBoundary collectionName={collectionName}>
        <GraphStudioApp
          initialCollection={collectionName}
          graphMode={graphMode}
          selectedProjectId={selectedProjectId}
        />
      </GraphErrorBoundary>
    </div>
  )
}
