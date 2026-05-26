/**
 * SourcePage â€” Displays source HTML document in an iframe.
 * The Vite plugin serves docs at /source-viewer/ (from C01 ingestion data).
 * Source of truth: DESIGN-SPEC.md Section 11
 */
import { useRef, useEffect } from 'react'
import { resolveSourceUrl } from '../adapters/source-paths'

export default function SourcePage({ htmlPath }: { htmlPath: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Build the URL via adapter so source document routing stays centralized.
  const sourceUrl = resolveSourceUrl(htmlPath)

  // Inject dark theme into iframe after load
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument
        if (!doc) return

        // Inject dark theme CSS
        const style = doc.createElement('style')
        style.textContent = `
          html, body {
            background: #0f111a !important;
            color: #f8fafc !important;
            font-family: 'Segoe UI Variable', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.7;
            padding: 24px 32px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #f8fafc !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 8px;
            margin-top: 24px;
          }
          a { color: #38bdf8 !important; }
          pre, code {
            background: rgba(255, 255, 255, 0.03) !important;
            color: #f8fafc !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 6px;
            padding: 2px 6px;
          }
          pre { padding: 12px 16px !important; overflow-x: auto; }
          blockquote {
            border-left: 3px solid #38bdf8 !important;
            padding-left: 16px !important;
            color: #94a3b8 !important;
          }
          img { max-width: 100%; border-radius: 8px; }
          table { border-collapse: collapse; width: 100%; }
          th, td {
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            padding: 8px 12px !important;
            text-align: left;
          }
          th { background: rgba(255, 255, 255, 0.03) !important; color: #f8fafc !important; }
          hr { border-color: rgba(255, 255, 255, 0.08) !important; }
        `
        doc.head.appendChild(style)
      } catch {
        // Cross-origin — can't inject styles, will show raw HTML
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [sourceUrl])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 48px)',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between" style={{
        padding: '6px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
          {htmlPath}
        </span>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ padding: '2px 10px', fontSize: '12px', textDecoration: 'none' }}
        >
          Open in New Tab
        </a>
      </div>

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={sourceUrl}
        title="Source Document"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          background: 'var(--surface)',
        }}
      />
    </div>
  )
}
