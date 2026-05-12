import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fulltextSearch, semanticSearch, graphRAGRecall, exploreNeighborhood, findPaths, explainConnection } from '../neo4j/queries.js';
import { spawnPythonJSON } from '../python/spawn.js';
import { ok, err } from '../helpers/ok-err.js';
import { sanitizeCypher } from '../helpers/validators.js';
import { runRead } from '../neo4j/driver.js';

export function registerQueryTools(server: McpServer) {

  // --- memorytonic_search ---
  server.registerTool(
    'memorytonic_search',
    {
      title: 'Search Entities',
      description: 'Search for entities by text (fulltext), meaning (semantic), or both (hybrid). Default: fulltext.',
      inputSchema: z.object({
        query: z.string().describe('Search query text'),
        limit: z.number().optional().describe('Max results (default 20)'),
        mode: z.enum(['fulltext', 'semantic', 'hybrid']).optional().describe('Search mode (default fulltext)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit, mode }) => {
      try {
        const searchMode = mode ?? 'fulltext';
        const maxResults = limit ?? 20;

        if (searchMode === 'fulltext') {
          const results = await fulltextSearch(query, maxResults);
          return ok({ results, count: results.length, mode: searchMode });
        }

        if (searchMode === 'semantic') {
          // Embed query text via Python, then vector search
          const embedding = await spawnPythonJSON<{
            embeddings: { name: string; embedding: number[]; dimensions: number }[];
          }>('nlp/embed.py', [], { texts: [query], names: ['query'] });
          const vector = embedding.embeddings[0]?.embedding;
          if (!vector) return err('Failed to generate query embedding');
          const results = await semanticSearch(vector, maxResults);
          return ok({ results, count: results.length, mode: searchMode });
        }

        // hybrid: run both, merge results
        const [ftResults, embResult] = await Promise.all([
          fulltextSearch(query, maxResults),
          spawnPythonJSON<{
            embeddings: { name: string; embedding: number[]; dimensions: number }[];
          }>('nlp/embed.py', [], { texts: [query], names: ['query'] })
            .catch(() => null),
        ]);

        let semResults: unknown[] = [];
        if (embResult?.embeddings[0]?.embedding) {
          semResults = await semanticSearch(embResult.embeddings[0].embedding, maxResults);
        }

        // Merge: deduplicate by name, boost scores for entities in both
        const seen = new Map<string, Record<string, unknown>>();
        for (const r of ftResults as Record<string, unknown>[]) {
          seen.set(r.name as string, { ...r, source: 'fulltext' });
        }
        for (const r of semResults as Record<string, unknown>[]) {
          const name = r.name as string;
          if (seen.has(name)) {
            const existing = seen.get(name)!;
            existing.source = 'both';
            existing.hybridBoost = true;
          } else {
            seen.set(name, { ...r, source: 'semantic' });
          }
        }

        const merged = [...seen.values()].slice(0, maxResults);
        return ok({ results: merged, count: merged.length, mode: 'hybrid' });
      } catch (e) {
        return err(`Search failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_recall ---
  server.registerTool(
    'memorytonic_recall',
    {
      title: 'GraphRAG Recall',
      description: 'Ask a question and get rich context: entities, connections, causal chains, and projects. The primary research tool.',
      inputSchema: z.object({
        question: z.string().describe('Research question to explore'),
        depth: z.number().optional().describe('Hop depth for graph traversal (default 2, max 3)'),
        limit: z.number().optional().describe('Max entities to return (default 10)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ question, depth, limit }) => {
      try {
        const result = await graphRAGRecall(question, Math.min(depth ?? 2, 3), limit ?? 10);
        return ok(result);
      } catch (e) {
        return err(`Recall failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_explore ---
  server.registerTool(
    'memorytonic_explore',
    {
      title: 'Explore Entity Neighborhood',
      description: 'Explore an entity\'s N-hop neighborhood. Returns connected entities and edges.',
      inputSchema: z.object({
        entityName: z.string().describe('Starting entity name'),
        hops: z.number().optional().describe('Traversal depth (default 2, max 3)'),
        limit: z.number().optional().describe('Max neighbors (default 30)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ entityName, hops, limit }) => {
      try {
        const result = await exploreNeighborhood(entityName, Math.min(hops ?? 2, 3), limit ?? 30);
        return ok({ startEntity: entityName, neighbors: result, count: result.length });
      } catch (e) {
        return err(`Explore failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_find_paths ---
  server.registerTool(
    'memorytonic_find_paths',
    {
      title: 'Find Paths Between Entities',
      description: 'Find shortest path(s) between two entities through the knowledge graph.',
      inputSchema: z.object({
        from: z.string().describe('Source entity name'),
        to: z.string().describe('Target entity name'),
        maxHops: z.number().optional().describe('Maximum path length (default 6)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ from, to, maxHops }) => {
      try {
        const paths = await findPaths(from, to, Math.min(maxHops ?? 6, 6));
        return ok({ from, to, paths, found: paths.length > 0 });
      } catch (e) {
        return err(`Path search failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_explain ---
  server.registerTool(
    'memorytonic_explain',
    {
      title: 'Explain Connection',
      description: 'Explain how two entities are connected: direct edges, shared projects, and indirect paths.',
      inputSchema: z.object({
        entity1: z.string().describe('First entity name'),
        entity2: z.string().describe('Second entity name'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ entity1, entity2 }) => {
      try {
        const result = await explainConnection(entity1, entity2);
        return ok(result);
      } catch (e) {
        return err(`Explain failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_query ---
  server.registerTool(
    'memorytonic_query',
    {
      title: 'Raw Cypher Query',
      description: 'Run a read-only Cypher query directly. Blocks CREATE/MERGE/DELETE/SET/DROP. Max 4096 chars.',
      inputSchema: z.object({
        cypher: z.string().describe('Cypher query (read-only)'),
        params: z.record(z.unknown()).optional().describe('Query parameters'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ cypher, params }) => {
      const blocked = sanitizeCypher(cypher);
      if (blocked) return err(blocked);
      try {
        const results = await runRead(cypher, params ?? {});
        return ok({ results, count: results.length });
      } catch (e) {
        return err(`Query failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
