import { useRef, useEffect, useState } from 'react'
import { resolveSourceUrl } from '../adapters/source-paths'

export default function SourcePage({ htmlPath }: { htmlPath: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [resolvedPath, setResolvedPath] = useState('')
  const sourceUrl = resolveSourceUrl(htmlPath)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    setResolvedPath('')
    fetch(sourceUrl, { method: 'HEAD', signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(response.status === 404
        ? 'The source file is missing. Restore its HTML artifact to the graph workspace, then retry.'
        : 'This source document could not be opened (' + response.status + ').')
      setResolvedPath(response.headers.get('X-Source-Resolved-Path') || '')
      setStatus('ready')
    }).catch(err => {
      if (!controller.signal.aborted) { setStatus('error'); setError(err instanceof Error ? err.message : String(err)) }
    })
    return () => controller.abort()
  }, [sourceUrl, retry])

  const applyDocumentTheme = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.head) return
    const colors = getComputedStyle(document.documentElement)
    let style = doc.getElementById('workspace-reader-theme') as HTMLStyleElement | null
    if (!style) { style = doc.createElement('style'); style.id = 'workspace-reader-theme'; doc.head.appendChild(style) }
    style.textContent = ':root { --bg: ' + colors.getPropertyValue('--surface') +
      '; --bg-surface: ' + colors.getPropertyValue('--surface-subtle') +
      '; --text: ' + colors.getPropertyValue('--text-secondary') +
      '; --text-bright: ' + colors.getPropertyValue('--text-primary') +
      '; --accent: ' + colors.getPropertyValue('--accent') +
      '; --divider: ' + colors.getPropertyValue('--border') +
      '; } html, body { background: ' + colors.getPropertyValue('--surface') +
      ' !important; color: ' + colors.getPropertyValue('--text-primary') +
      ' !important; } body { font-family: system-ui, sans-serif; line-height: 1.75; padding: 28px; max-width: 900px; margin: auto; } img { max-width: 100%; } pre { overflow-x: auto; }'
  }

  useEffect(() => {
    const observer = new MutationObserver(applyDocumentTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="source-reader">
      <div className="source-reader-toolbar">
        <span title={htmlPath}>{htmlPath}</span>
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Open source ↗</a>
      </div>
      {resolvedPath && <div className="source-reader-notice">The original source was recovered from its local extraction artifact: <span>{resolvedPath}</span></div>}
      {status === 'loading' && <div className="loading-state" role="status">Opening source document…</div>}
      {status === 'error' && <div className="empty-state" role="alert"><h2>Source unavailable</h2><p>{error}</p><button type="button" className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      {status === 'ready' && <iframe ref={iframeRef} src={sourceUrl} title="Source document" sandbox="allow-same-origin" onLoad={applyDocumentTheme} />}
    </div>
  )
}
