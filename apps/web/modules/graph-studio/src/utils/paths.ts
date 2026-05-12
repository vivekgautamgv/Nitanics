/**
 * Path resolution utilities for source documents
 *
 * htmlPath from Neo4j: "data/sources/YYYY-MM-DD/project_name/01_html.html"
 * These are relative to Component 01 (ingestion).
 *
 * Served via Vite plugin at /source-viewer/ in the local web app.
 */

/**
 * Convert a Neo4j htmlPath to a URL the browser can open.
 * Returns empty string if htmlPath is falsy.
 */
export function resolveSourceUrl(htmlPath: string | undefined | null): string {
  if (!htmlPath) return ''
  // In dev: served by the serveSourceDocs Vite plugin
  return `/source-viewer/${htmlPath}`
}
