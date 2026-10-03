import { getSession } from '../adapters/neo4j-service'

export interface WorkspaceOverview {
  documents: number
  entities: number
  relationships: number
  collections: Array<{ name: string; description: string; entities: number; bridges: number }>
}

function numberValue(value: unknown): number {
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber()
  }
  return Number(value) || 0
}

/** Count unique records directly; summing collection counts counts shared sources twice. */
export async function fetchWorkspaceOverview(): Promise<WorkspaceOverview> {
  const session = getSession()
  try {
    const result = await session.run(`
      CALL { MATCH (p:Project) RETURN count(p) AS documents }
      CALL { MATCH (e:Entity) RETURN count(e) AS entities }
      CALL { MATCH ()-[r:RELATES_TO]->() RETURN count(r) AS relationships }
      CALL {
        MATCH (c:Collection)
        OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
        OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
        WITH c, e, count(DISTINCT p) AS mentions
        WITH c, count(e) AS entityCount,
          sum(CASE WHEN e IS NOT NULL AND mentions > 1 THEN 1 ELSE 0 END) AS bridges
        RETURN collect({name: c.name, description: coalesce(c.description, ''),
          entities: entityCount, bridges: bridges}) AS collections
      }
      RETURN documents, entities, relationships, collections
    `)
    const row = result.records[0]
    return {
      documents: numberValue(row?.get('documents')),
      entities: numberValue(row?.get('entities')),
      relationships: numberValue(row?.get('relationships')),
      collections: (row?.get('collections') || []).map((c: Record<string, unknown>) => ({
        name: String(c.name), description: String(c.description || ''),
        entities: numberValue(c.entities), bridges: numberValue(c.bridges),
      })),
    }
  } finally {
    await session.close()
  }
}
