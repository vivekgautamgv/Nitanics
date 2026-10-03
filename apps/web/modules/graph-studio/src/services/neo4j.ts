/**
 * Neo4j Driver Singleton
 *
 * Source of truth: DESIGN-SPEC.md Section 3 (Data Flow), Section 15 (Queries)
 * Connection: DESIGN-SPEC.md Section 22, Trap T1
 *
 * TRAP T1: Database MUST be 'memorytonic', NOT 'neo4j'.
 * TRAP T6: Neo4j Integer types need .toNumber() conversion.
 * TRAP T8: NEVER load entity.embedding[384] — exclude from all queries.
 */

import neo4j, { Driver, Session } from 'neo4j-driver'

// ── Driver singleton ──────────────────────────────────────────────

const URI = import.meta.env.VITE_NEO4J_URI || 'bolt://localhost:7687'
const USER = import.meta.env.VITE_NEO4J_USER || 'neo4j'
const PASSWORD = import.meta.env.VITE_NEO4J_PASSWORD || '12345678'
const DATABASE = import.meta.env.VITE_NEO4J_DATABASE || 'memorytonic'

let driver: Driver | null = null

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
      connectionTimeout: 10_000,
      connectionAcquisitionTimeout: 15_000,
    })
  }
  return driver
}

/**
 * Create a new session scoped to the memorytonic database.
 * Caller is responsible for closing the session after use.
 *
 * Usage:
 *   const session = getSession()
 *   try {
 *     const result = await session.run(cypher, params)
 *     // process result
 *   } finally {
 *     await session.close()
 *   }
 */
export function getSession(): Session {
  return getDriver().session({ database: DATABASE })
}

/**
 * Close the driver connection. Call on app unmount.
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close()
    driver = null
  }
}

/**
 * Verify the connection works. Returns entity count.
 * Used for Phase 1 verification — must return 287.
 */
export async function testConnection(): Promise<number> {
  const session = getSession()
  try {
    const result = await session.run(
      'MATCH (e:Entity) RETURN count(e) AS count'
    )
    // TRAP T6: Neo4j integers need .toNumber()
    return result.records[0]?.get('count').toNumber() ?? 0
  } finally {
    await session.close()
  }
}
