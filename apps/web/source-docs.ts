import { createReadStream, readFileSync, realpathSync, statSync } from 'node:fs'
import { resolve, relative, isAbsolute, extname, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

class SourceDocError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function containedFile(root: string, target: string): string {
  const realRoot = realpathSync(root)
  const realTarget = realpathSync(target)
  const rel = relative(realRoot, realTarget)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new SourceDocError(403, 'Forbidden')
  if (!statSync(realTarget).isFile()) throw new SourceDocError(404, 'Source document not found')
  return realTarget
}

function verifiedLegacyFallback(repoRoot: string, parts: string[]): { path: string; resolvedPath: string } | null {
  if (parts.length !== 5 || parts[0] !== 'data' || parts[1] !== 'sources' || parts[4] !== '01_html.html'
    || !/^\d{4}-\d{2}-\d{2}$/.test(parts[2]) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[3])) return null
  const slug = parts[3]
  const root = resolve(repoRoot, 'apps/ingestion-pipeline/data/extracted')
  const source = containedFile(root, resolve(root, slug, '01_html.html'))
  const placement = containedFile(root, resolve(root, slug, '02_placement.json'))
  if (JSON.parse(readFileSync(placement, 'utf8')).unique_id !== slug) return null
  return { path: source, resolvedPath: `data/extracted/${slug}/01_html.html` }
}

/** Serve canonical graph sources and older ingestion artifacts in dev and preview. */
export function sourceDocsMiddleware(repoRoot: string) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const fail = (status: number, message: string) => { res.statusCode = status; res.end(message) }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); fail(405, 'Method not allowed'); return }
    let requested: string
    try { requested = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '') }
    catch { fail(400, 'Invalid source path'); return }
    const parts = requested.split('/')
    if (parts.some(part => !part || part === '.' || part === '..' || /[\\:\x00]/.test(part))) {
      fail(403, 'Invalid source path'); return
    }
    if (extname(requested).toLowerCase() !== '.html') { fail(403, 'Only HTML source documents are available'); return }
    const canonical = parts[0] === 'graphs'
    const legacy = parts[0] === 'data' && ['sources', 'extracted', 'temp'].includes(parts[1])
    if (!canonical && !legacy) { fail(403, 'Source path is outside the graph workspace'); return }
    const root = canonical ? resolve(repoRoot, 'graphs') : resolve(repoRoot, 'apps/ingestion-pipeline/data', parts[1])
    const target = resolve(canonical ? repoRoot : resolve(repoRoot, 'apps/ingestion-pipeline'), requested)
    try {
      let realTarget: string
      let resolvedPath: string | undefined
      try {
        realTarget = containedFile(root, target)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        // Older graph records can refer to a dated source copy that was never
        // preserved. Recover only the exact, identity-checked extraction artifact.
        const fallback = verifiedLegacyFallback(repoRoot, parts)
        if (!fallback) throw error
        realTarget = fallback.path
        resolvedPath = fallback.resolvedPath
      }
      if (extname(realTarget).toLowerCase() !== '.html') { fail(403, 'Only HTML source documents are available'); return }
      if (resolvedPath) {
        res.setHeader('X-Source-Resolved-Path', resolvedPath)
        res.setHeader('Access-Control-Expose-Headers', 'X-Source-Resolved-Path')
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "sandbox allow-same-origin; default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'")
      if (req.method === 'HEAD') { res.end(); return }
      const stream = createReadStream(realTarget)
      stream.on('error', () => { if (!res.headersSent) fail(500, 'Could not read source document'); else res.destroy() })
      stream.pipe(res)
    } catch (error) {
      if (error instanceof SourceDocError) fail(error.status, error.message)
      else fail(404, 'Source document not found')
    }
  }
}
