/**
 * Neo4j driver adapter — re-exports from Component 02.
 * This is the ONLY file that imports neo4j.ts from C02.
 * All frontend queries import getSession from HERE.
 *
 * TRAP T1: Database is 'memorytonic' (not 'neo4j').
 * TRAP T14: Every session MUST close in a finally block.
 */
export { getSession, closeDriver, testConnection } from '@graph/services/neo4j'
