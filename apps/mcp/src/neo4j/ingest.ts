/**
 * Lightweight JS-native ingestion for conversations, insights, and manual projects.
 * Does NOT use Python scripts — writes directly to Neo4j.
 * For full document extraction, use the Python pipeline (memorytonic_extract).
 */

import { randomUUID } from 'node:crypto';
import { runRead, runWrite } from './driver.js';
import { spawnPythonJSON } from '../python/spawn.js';

// --- Types ---

interface IngestProject {
  name: string;
  summary: string;
  sourceType: string;
  tags: string[];
  directoryCategory: string;
  narrativeFlow?: string;
  collections?: string[];
}

interface IngestEntity {
  name: string;
  category: string;
  description: string;
  role: string;
  confidence?: number;
  aliases?: string[];
  relationships?: {
    target: string;
    type: string;
    description: string;
    causalClassification?: string;
    evidence?: string;
    confidence?: number;
  }[];
}

interface IngestPayload {
  project: IngestProject;
  entities: IngestEntity[];
  htmlContent: string;
  keyInsights?: string[];
}

interface IngestResult {
  projectId: string;
  projectName: string;
  entityCount: number;
  newEntityCount: number;
  mergedEntityCount: number;
  relationshipCount: number;
  entitiesEmbedded: number;
  projectEmbedded: boolean;
  durationMs: number;
}

// --- Helpers ---

function genId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

async function ensureDirectoryCategory(name: string): Promise<void> {
  await runWrite(
    `MERGE (d:DirectoryCategory {name: $name})
     ON CREATE SET d.description = $name`,
    { name }
  );
}

async function ensureCollection(name: string): Promise<string> {
  const result = await runWrite<{ collectionId: string }>(
    `MERGE (c:Collection {name: $name})
     ON CREATE SET c.collectionId = $id, c.createdAt = datetime()
     RETURN c.collectionId AS collectionId`,
    { name, id: genId('col') }
  );
  return result[0]?.collectionId ?? '';
}

// --- Core Ingestion ---

export async function ingestLightweight(payload: IngestPayload): Promise<IngestResult> {
  const startTime = Date.now();
  const projectId = genId('proj');
  const timestamp = new Date().toISOString();
  const entityNameToId = new Map<string, string>();
  let newEntityCount = 0;
  let mergedEntityCount = 0;
  let relationshipCount = 0;

  // 1. Ensure directory
  await ensureDirectoryCategory(payload.project.directoryCategory);

  // 2. Create project
  const uniqueId = payload.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await runWrite(
    `CREATE (p:Project {
       projectId: $projectId, name: $name, uniqueId: $uniqueId,
       summary: $summary, sourceType: $sourceType,
       domain: $directoryCategory, subdomain: '',
       baseTags: $tags, narrativeFlow: $narrativeFlow,
       htmlPath: '', directory: $directoryCategory,
       createdAt: datetime($timestamp)
     })
     WITH p
     MATCH (d:DirectoryCategory {name: $directoryCategory})
     MERGE (p)-[:IN_DIRECTORY]->(d)`,
    {
      projectId, name: payload.project.name, uniqueId,
      summary: payload.project.summary,
      sourceType: payload.project.sourceType,
      tags: payload.project.tags,
      directoryCategory: payload.project.directoryCategory,
      narrativeFlow: payload.project.narrativeFlow ?? '',
      timestamp,
    }
  );

  // 3. Merge entities (alias-aware: check name + aliases)
  for (const entity of payload.entities) {
    const aliasNames = entity.aliases ?? [];
    const allNames = [entity.name, ...aliasNames];

    // Check if entity exists by name or any alias
    const existing = await runRead<{ entityId: string; name: string }>(
      `MATCH (e:Entity)
       WHERE e.name IN $allNames OR ANY(a IN e.aliases WHERE a IN $allNames)
       RETURN e.entityId AS entityId, e.name AS name
       LIMIT 1`,
      { allNames }
    );

    if (existing.length > 0) {
      // Merge into existing
      const eid = existing[0].entityId;
      entityNameToId.set(entity.name, eid);
      for (const a of aliasNames) entityNameToId.set(a, eid);

      await runWrite(
        `MATCH (e:Entity {entityId: $entityId}), (p:Project {projectId: $projectId})
         SET e.aliases = [x IN (coalesce(e.aliases, []) + $newAliases) | x],
             e.projectCount = coalesce(e.projectCount, 0) + 1
         MERGE (e)-[:MENTIONED_IN {role: $role}]->(p)`,
        { entityId: eid, projectId, newAliases: aliasNames, role: entity.role }
      );
      mergedEntityCount++;
    } else {
      // Create new entity
      const eid = genId('ent');
      entityNameToId.set(entity.name, eid);
      for (const a of aliasNames) entityNameToId.set(a, eid);

      await runWrite(
        `CREATE (e:Entity {
           entityId: $entityId, name: $name, aliases: $aliases,
           aliases_text: $aliasesText, category: $category,
           definition: $description, role: $role,
           projectCount: 1, firstAppearanceIndex: 0,
           createdAt: datetime($timestamp)
         })
         WITH e
         MATCH (p:Project {projectId: $projectId})
         MERGE (e)-[:MENTIONED_IN {role: $role}]->(p)`,
        {
          entityId: eid, name: entity.name, aliases: aliasNames,
          aliasesText: aliasNames.join(' '), category: entity.category,
          description: entity.description, role: entity.role,
          projectId, timestamp,
        }
      );
      newEntityCount++;
    }
  }

  // 4. Create relationships
  for (const entity of payload.entities) {
    if (!entity.relationships) continue;
    const sourceId = entityNameToId.get(entity.name);
    if (!sourceId) continue;

    for (const rel of entity.relationships) {
      const targetId = entityNameToId.get(rel.target);
      if (!targetId) continue;

      await runWrite(
        `MATCH (s:Entity {entityId: $sourceId}), (t:Entity {entityId: $targetId})
         MERGE (s)-[r:RELATES_TO {relType: $relType}]->(t)
         ON CREATE SET r.description = $description,
                       r.causalClassification = $causalClassification,
                       r.evidence = $evidence,
                       r.evidenceStrength = 'Moderate',
                       r.magnitude = 'Medium'`,
        {
          sourceId, targetId,
          relType: rel.type,
          description: rel.description,
          causalClassification: rel.causalClassification ?? 'Associative',
          evidence: rel.evidence ?? rel.description,
        }
      );
      relationshipCount++;
    }
  }

  // 5. Embed entities + project (non-fatal)
  let entitiesEmbedded = 0;
  let projectEmbedded = false;
  try {
    const texts: string[] = [];
    const names: string[] = [];
    for (const entity of payload.entities) {
      texts.push(`${entity.description} ${entity.role}`);
      names.push(entity.name);
    }
    texts.push(payload.project.summary);
    names.push(`__project__${uniqueId}`);

    const embedResult = await spawnPythonJSON<{
      embeddings: { name: string; embedding: number[]; dimensions: number }[];
    }>('nlp/embed.py', [], { texts, names });

    for (const emb of embedResult.embeddings) {
      if (emb.name.startsWith('__project__')) {
        await runWrite(
          `MATCH (p:Project {projectId: $projectId}) SET p.embedding = $embedding`,
          { projectId, embedding: emb.embedding }
        );
        projectEmbedded = true;
      } else {
        const eid = entityNameToId.get(emb.name);
        if (eid) {
          await runWrite(
            `MATCH (e:Entity {entityId: $eid}) SET e.embedding = $embedding`,
            { eid, embedding: emb.embedding }
          );
          entitiesEmbedded++;
        }
      }
    }
  } catch {
    // Non-fatal — semantic search won't work for these until re-embedded
  }

  // 6. Add to collections
  if (payload.project.collections) {
    for (const colName of payload.project.collections) {
      const colId = await ensureCollection(colName);
      await runWrite(
        `MATCH (p:Project {projectId: $projectId}), (c:Collection {collectionId: $colId})
         MERGE (p)-[:BELONGS_TO]->(c)`,
        { projectId, colId }
      );
    }
  }

  return {
    projectId,
    projectName: payload.project.name,
    entityCount: payload.entities.length,
    newEntityCount,
    mergedEntityCount,
    relationshipCount,
    entitiesEmbedded,
    projectEmbedded,
    durationMs: Date.now() - startTime,
  };
}
