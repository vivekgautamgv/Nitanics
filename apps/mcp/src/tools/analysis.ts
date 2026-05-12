import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { importanceRanking, findGaps, temporalTimeline, findSimilar, detectOverlaps, getCommunities, getCommunityDetail } from '../neo4j/queries.js';
import { ok, err } from '../helpers/ok-err.js';

export function registerAnalysisTools(server: McpServer) {

  // --- memorytonic_importance ---
  server.registerTool(
    'memorytonic_importance',
    {
      title: 'Entity Importance Ranking',
      description: 'Rank entities by graph metric: pageRank (influence), betweenness (bridging), degree (connections), projectCount (breadth).',
      inputSchema: z.object({
        metric: z.enum(['pageRank', 'betweenness', 'degree', 'projectCount']).optional()
          .describe('Ranking metric (default pageRank)'),
        collection: z.string().optional()
          .describe('Scope to a specific collection'),
        limit: z.number().optional()
          .describe('Max results (default 20)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ metric, collection, limit }) => {
      try {
        const results = await importanceRanking({ collection, metric, limit });
        return ok({ metric: metric ?? 'pageRank', collection: collection ?? 'all', results, count: results.length });
      } catch (e) {
        return err(`Importance ranking failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_gaps ---
  server.registerTool(
    'memorytonic_gaps',
    {
      title: 'Research Gaps',
      description: 'Find research gaps: isolated entities (no relationships) and underconnected entities (<3 relationships).',
      inputSchema: z.object({
        collection: z.string().optional().describe('Scope to a specific collection'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ collection }) => {
      try {
        const result = await findGaps(collection);
        return ok({ collection: collection ?? 'all', ...result });
      } catch (e) {
        return err(`Gap analysis failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_temporal ---
  server.registerTool(
    'memorytonic_temporal',
    {
      title: 'Project Timeline',
      description: 'Get temporal phases for a project with entities that first appear in each phase.',
      inputSchema: z.object({
        projectUniqueId: z.string().describe('Project unique ID'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectUniqueId }) => {
      try {
        const phases = await temporalTimeline(projectUniqueId);
        return ok({ project: projectUniqueId, phases, phaseCount: phases.length });
      } catch (e) {
        return err(`Timeline failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_similar ---
  server.registerTool(
    'memorytonic_similar',
    {
      title: 'Find Similar Entities',
      description: 'Find entities similar to a given entity based on embedding similarity (SIMILAR_TO edges computed by GDS).',
      inputSchema: z.object({
        entityName: z.string().describe('Entity name to find similar entities for'),
        limit: z.number().optional().describe('Max results (default 10)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ entityName, limit }) => {
      try {
        const results = await findSimilar(entityName, limit);
        return ok({ entity: entityName, similar: results, count: results.length });
      } catch (e) {
        return err(`Similar search failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_detect_overlaps ---
  server.registerTool(
    'memorytonic_detect_overlaps',
    {
      title: 'Detect Entity Overlaps',
      description: 'Find potential duplicate entities (similarity > 0.85). Useful for cleaning up the knowledge graph.',
      inputSchema: z.object({
        collection: z.string().optional().describe('Scope to a specific collection'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ collection }) => {
      try {
        const results = await detectOverlaps(collection);
        return ok({ collection: collection ?? 'all', overlaps: results, count: results.length });
      } catch (e) {
        return err(`Overlap detection failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_communities ---
  server.registerTool(
    'memorytonic_communities',
    {
      title: 'List Communities',
      description: 'List entity communities detected by GDS community detection. Shows clusters of related entities.',
      inputSchema: z.object({
        collection: z.string().optional().describe('Scope to a specific collection'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ collection }) => {
      try {
        const results = await getCommunities(collection);
        return ok({ collection: collection ?? 'all', communities: results, count: results.length });
      } catch (e) {
        return err(`Communities query failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_community ---
  server.registerTool(
    'memorytonic_community',
    {
      title: 'Community Detail',
      description: 'Get details of a specific community: all members and their internal relationships.',
      inputSchema: z.object({
        communityId: z.number().describe('Community ID (from memorytonic_communities results)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ communityId }) => {
      try {
        const result = await getCommunityDetail(communityId);
        return ok(result);
      } catch (e) {
        return err(`Community detail failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
