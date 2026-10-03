import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createServer, request, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceDocsMiddleware } from './source-docs'

const fixtureBase = mkdtempSync(join(tmpdir(), 'nitanics-source-docs-'))
const repoRoot = join(fixtureBase, 'workspace')
const content = '<!doctype html><html><body>Original source</body></html>'
const recoveredContent = '<!doctype html><html><body>Verified extraction original</body></html>'
const graphDocument = join(repoRoot, 'graphs', 'research', 'report', '01_html.html')
let server: Server
let port = 0

function fixture(relativePath: string, value = content): string {
  const path = join(repoRoot, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
  return path
}

fixture('graphs/research/report/01_html.html')
fixture('graphs/..archive/01_html.html')
fixture('graphs/research/report/.env', 'LOCAL_SECRET=test-fixture')
fixture('graphs-sibling/escape.html', 'Outside graph root')
fixture('apps/ingestion-pipeline/data/sources/2026-10-03/current-report/01_html.html')
fixture('apps/ingestion-pipeline/data/extracted/direct-report/01_html.html')
fixture('apps/ingestion-pipeline/data/temp/working-report/01_html.html')
fixture('apps/ingestion-pipeline/data/extracted/recovered-report/01_html.html', recoveredContent)
fixture('apps/ingestion-pipeline/data/extracted/recovered-report/02_placement.json', JSON.stringify({ unique_id: 'recovered-report' }))
fixture('apps/ingestion-pipeline/data/extracted/current-report/01_html.html', 'A different extracted artifact')
fixture('apps/ingestion-pipeline/data/extracted/current-report/02_placement.json', JSON.stringify({ unique_id: 'current-report' }))
fixture('apps/ingestion-pipeline/data/extracted/wrong-report/01_html.html')
fixture('apps/ingestion-pipeline/data/extracted/wrong-report/02_placement.json', JSON.stringify({ unique_id: 'different-project' }))
fixture('apps/ingestion-pipeline/data/extracted/no-placement/01_html.html')
fixture('apps/ingestion-pipeline/data/extracted/invalid-placement/01_html.html')
fixture('apps/ingestion-pipeline/data/extracted/invalid-placement/02_placement.json', '{invalid JSON')
fixture('apps/ingestion-pipeline/data/extracted/alternate-file/02_html.html')
fixture('apps/ingestion-pipeline/data/extracted/alternate-file/02_placement.json', JSON.stringify({ unique_id: 'alternate-file' }))
fixture('metadata-sibling/outside-placement.json', JSON.stringify({ unique_id: 'linked-placement' }))
fixture('apps/ingestion-pipeline/data/extracted/linked-placement/01_html.html')
fixture('apps/ingestion-pipeline/data/extracted/linked-source/02_placement.json', JSON.stringify({ unique_id: 'linked-source' }))
const beforeContent = readFileSync(graphDocument, 'utf8')
const beforeModified = statSync(graphDocument).mtimeMs

let junctionsAvailable = true
let fileSymlinksAvailable = true
try {
  symlinkSync(join(repoRoot, 'graphs-sibling'), join(repoRoot, 'graphs', 'outside-link'), 'junction')
} catch {
  junctionsAvailable = false
}
try {
  symlinkSync(join(repoRoot, 'graphs', 'research', 'report', '.env'), join(repoRoot, 'graphs', 'research', 'report', 'env-alias.html'), 'file')
  symlinkSync(join(repoRoot, 'metadata-sibling', 'outside-placement.json'), join(repoRoot, 'apps/ingestion-pipeline/data/extracted/linked-placement/02_placement.json'), 'file')
  symlinkSync(join(repoRoot, 'graphs-sibling', 'escape.html'), join(repoRoot, 'apps/ingestion-pipeline/data/extracted/linked-source/01_html.html'), 'file')
} catch {
  fileSymlinksAvailable = false
}

beforeAll(async () => {
  server = createServer(sourceDocsMiddleware(repoRoot))
  await new Promise<void>(resolveListening => server.listen(0, '127.0.0.1', resolveListening))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not receive a port')
  port = address.port
})

afterAll(async () => {
  if (server) await new Promise<void>((resolveClosed, reject) => server.close(error => error ? reject(error) : resolveClosed()))
  // This cleanup target is the dedicated mkdtemp fixture directory, never a repo
  // data directory. Check its resolved parent/name before removing recursively.
  const cleanupTarget = resolve(fixtureBase)
  if (dirname(cleanupTarget) !== resolve(tmpdir()) || !basename(cleanupTarget).startsWith('nitanics-source-docs-')) {
    throw new Error('Unexpected source-docs test cleanup path')
  }
  rmSync(cleanupTarget, { recursive: true, force: true })
})

function get(path: string, method = 'GET', requestPort = port): Promise<{ status: number; body: string; headers: IncomingHttpHeaders }> {
  return new Promise((resolveResponse, reject) => {
    const req = request({ hostname: '127.0.0.1', port: requestPort, path, method }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('end', () => resolveResponse({ status: response.statusCode!, body: Buffer.concat(chunks).toString('utf8'), headers: response.headers }))
      response.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

function rejectedRawPath(path: string): number {
  // Bun's HTTP compatibility layer normalizes encoded dot segments before they
  // reach IncomingMessage. Exercise the middleware with the original raw URL,
  // as Node/Vite supplies it, so traversal validation is checked directly.
  const response = { statusCode: 200, end: () => {}, setHeader: () => {} }
  sourceDocsMiddleware(repoRoot)({ method: 'GET', url: path } as IncomingMessage, response as unknown as ServerResponse)
  return response.statusCode
}

describe('source document middleware', () => {
  test('serves canonical and supported legacy HTML roots with sandbox headers', async () => {
    for (const path of [
      '/graphs/research/report/01_html.html',
      '/data/sources/2026-10-03/current-report/01_html.html',
      '/data/extracted/direct-report/01_html.html',
      '/data/temp/working-report/01_html.html',
    ]) {
      const response = await get(path)
      expect(response.status).toBe(200)
      expect(response.body).toBe(content)
      expect(response.headers['content-type']).toBe('text/html; charset=utf-8')
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['content-security-policy']).toContain("sandbox allow-same-origin; default-src 'none'")
    }
  })

  test('HEAD verifies availability with headers and no document body', async () => {
    const response = await get('/graphs/research/report/01_html.html?cache=1', 'HEAD')
    expect(response.status).toBe(200)
    expect(response.body).toBe('')
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8')
  })

  test('rejects malformed URI and encoded parent, Windows separator, drive and null traversal', async () => {
    expect(rejectedRawPath('/graphs/%E0%A4%A/01_html.html')).toBe(400)
    for (const path of [
      '/graphs/research/%2e%2e/01_html.html', '/graphs%2F..%2Fgraphs-sibling%2Fescape.html',
      '/graphs/research%5c..%5creport/01_html.html', '/graphs/C%3A/report/01_html.html',
      '/graphs/research/%00/report.html', '/graphs/research//report/01_html.html',
    ]) {
      expect([path, rejectedRawPath(path)]).toEqual([path, 403])
      expect([403, 404]).toContain((await get(path)).status)
    }
  })

  test('rejects non-HTML, environment and unsupported sibling-prefix roots', async () => {
    for (const path of [
      '/graphs/research/report/.env', '/graphs/research/report/02_placement.json',
      '/graphs-sibling/escape.html', '/data/sources-sibling/report.html',
      '/apps/ingestion-pipeline/.env', '/README.html',
    ]) expect((await get(path)).status).toBe(403)
    expect((await get('/graphs/research/missing/01_html.html')).status).toBe(404)
  })

  test('allows a legitimate in-root name beginning with two dots', async () => {
    const response = await get('/graphs/..archive/01_html.html')
    expect(response.status).toBe(200)
    expect(response.body).toBe(content)
  })

  test.skipIf(!junctionsAvailable)('blocks junction escapes to a sibling with a similar graph-root prefix', async () => {
    expect((await get('/graphs/outside-link/escape.html')).status).toBe(403)
  })

  test.skipIf(!fileSymlinksAvailable)('blocks an HTML-named symlink to a non-HTML secret inside the allowed root', async () => {
    expect((await get('/graphs/research/report/env-alias.html')).status).toBe(403)
  })

  test('allows only GET and HEAD and never modifies document contents or timestamps', async () => {
    const response = await get('/graphs/research/report/01_html.html', 'POST')
    expect(response.status).toBe(405)
    expect(response.headers.allow).toBe('GET, HEAD')
    expect(readFileSync(graphDocument, 'utf8')).toBe(beforeContent)
    expect(statSync(graphDocument).mtimeMs).toBe(beforeModified)
  })
})

describe('verified legacy source recovery', () => {
  test('recovers only the missing dated source and identifies the exact extracted artifact', async () => {
    const path = '/data/sources/2026-04-14/recovered-report/01_html.html'
    const response = await get(path)
    expect(response.status).toBe(200)
    expect(response.body).toBe(recoveredContent)
    expect(response.headers['x-source-resolved-path']).toBe('data/extracted/recovered-report/01_html.html')
    expect(response.headers['access-control-expose-headers']).toBe('X-Source-Resolved-Path')
    const head = await get(path, 'HEAD')
    expect(head.status).toBe(200)
    expect(head.body).toBe('')
    expect(head.headers['x-source-resolved-path']).toBe(response.headers['x-source-resolved-path'])
  })

  test('preserves an existing dated original even when another extracted artifact exists', async () => {
    const response = await get('/data/sources/2026-10-03/current-report/01_html.html')
    expect(response.status).toBe(200)
    expect(response.body).toBe(content)
    expect(response.headers['x-source-resolved-path']).toBeUndefined()
  })

  test('requires readable placement metadata with the exact source slug identity', async () => {
    for (const slug of ['wrong-report', 'no-placement', 'invalid-placement']) {
      const response = await get(`/data/sources/2026-04-14/${slug}/01_html.html`)
      expect(response.status).toBe(404)
      expect(response.headers['x-source-resolved-path']).toBeUndefined()
    }
  })

  test('never searches another date, matches another filename, or falls back for canonical paths', async () => {
    for (const path of [
      '/data/sources/not-a-date/recovered-report/01_html.html',
      '/data/sources/2026-04-14/alternate-file/02_html.html',
      '/data/sources/2026-04-14/current-report/other.html',
      '/graphs/research/recovered-report/01_html.html',
    ]) {
      const response = await get(path)
      expect(response.status).toBe(404)
      expect(response.headers['x-source-resolved-path']).toBeUndefined()
    }
  })

  test.skipIf(!fileSymlinksAvailable)('requires containment of both the recovery HTML and its identity metadata', async () => {
    for (const slug of ['linked-placement', 'linked-source']) {
      expect((await get(`/data/sources/2026-04-14/${slug}/01_html.html`)).status).toBe(403)
    }
  })

  const actualRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const actualExtraction = join(actualRepo, 'apps/ingestion-pipeline/data/extracted/central-banks-the-invisible-hand/01_html.html')
  const actualPlacement = join(dirname(actualExtraction), '02_placement.json')
  const actualSourcePath = 'data/sources/2026-04-14/central-banks-the-invisible-hand/01_html.html'
  test.skipIf(!existsSync(actualExtraction) || !existsSync(actualPlacement)
    || existsSync(join(actualRepo, 'apps/ingestion-pipeline', actualSourcePath)))('recovers the available local Central Banks artifact without modifying it', async () => {
    const expected = readFileSync(actualExtraction, 'utf8')
    const originalModified = statSync(actualExtraction).mtimeMs
    const actualServer = createServer(sourceDocsMiddleware(actualRepo))
    await new Promise<void>(resolveListening => actualServer.listen(0, '127.0.0.1', resolveListening))
    try {
      const address = actualServer.address()
      if (!address || typeof address === 'string') throw new Error('Read-only test server did not receive a port')
      const response = await get(`/${actualSourcePath}`, 'GET', address.port)
      expect(response.status).toBe(200)
      expect(response.headers['x-source-resolved-path']).toBe('data/extracted/central-banks-the-invisible-hand/01_html.html')
      expect(response.body).toBe(expected)
      expect(statSync(actualExtraction).mtimeMs).toBe(originalModified)
    } finally {
      await new Promise<void>((resolveClosed, reject) => actualServer.close(error => error ? reject(error) : resolveClosed()))
    }
  })
})
