/**
 * Neo4j driver adapter — re-exports from Component 02.
 * This is the ONLY file that imports neo4j.ts from C02.
 * All frontend queries import getSession from HERE.
 *
 * TRAP T1: Database is 'memorytonic' (not 'neo4j').
 * TRAP T14: Every session MUST close in a finally block.
 */
export { getSession, closeDriver, testConnection } from '@graph/services/neo4j'

/** Keep connection failures actionable wherever data is loaded. */
export function describeDataError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''
  if (code.includes('Security.Unauthorized')) {
    return 'Neo4j rejected the connection. Check the username and password in your local environment.'
  }
  if (code.includes('DatabaseNotFound')) {
    return 'The configured Neo4j database is unavailable. Check VITE_NEO4J_DATABASE and restart the app.'
  }
  if (code === 'ServiceUnavailable' || code === 'SessionExpired' || /failed to establish connection|connection refused|websocket connection failure/i.test(message)) {
    return 'Cannot reach Neo4j. Check that Docker and the Neo4j server are running, then retry.'
  }
  return message
}
