import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEntity, getProject, listProjects, listCollections, listDirectories, computeBridgeTier } from '../neo4j/queries.js';
import { ok, err } from '../helpers/ok-err.js';

export function registerEntityProjectTools(server: McpServer) {

  // --- memorytonic_get_entity ---
  server.registerTool(
    'memorytonic_get_entity',
    {
      title: 'Get Entity Profile',
      description: 'Get full entity profile: definition, roles across projects, relationships, causal chains, similar entities, graph metrics.',
      inputSchema: z.object({
        name: z.string().describe('Entity name (case-sensitive)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => {
      try {
        const result = await getEntity(name);
        if (!result) return err(`Entity "${name}" not found`);

        // Compute bridge tier at query time
        const entity = result.entity as Record<string, unknown>;
        const bridgeTier = computeBridgeTier(
          (entity.projectCount as number) ?? 1,
          (entity.betweenness as number) ?? 0
        );

        return ok({ ...result, bridgeTier });
      } catch (e) {
        return err(`Get entity failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_get_project ---
  server.registerTool(
    'memorytonic_get_project',
    {
      title: 'Get Project Details',
      description: 'Get full project view: summary, entities, relationships, causal chains, temporal phases, collections.',
      inputSchema: z.object({
        uniqueId: z.string().describe('Project unique ID (kebab-case slug)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ uniqueId }) => {
      try {
        const result = await getProject(uniqueId);
        if (!result) return err(`Project "${uniqueId}" not found`);
        return ok(result);
      } catch (e) {
        return err(`Get project failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_list ---
  server.registerTool(
    'memorytonic_list',
    {
      title: 'List Items',
      description: 'List projects, collections, or directories. Use filters for projects (by directory or collection).',
      inputSchema: z.object({
        type: z.enum(['projects', 'collections', 'directories']).describe('What to list'),
        directory: z.string().optional().describe('Filter projects by directory name'),
        collection: z.string().optional().describe('Filter projects by collection name'),
        limit: z.number().optional().describe('Max results for projects (default 50)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ type, directory, collection, limit }) => {
      try {
        if (type === 'projects') {
          const results = await listProjects({ directory, collection, limit });
          return ok({ type, results, count: results.length });
        }
        if (type === 'collections') {
          const results = await listCollections();
          return ok({ type, results, count: results.length });
        }
        // directories
        const results = await listDirectories();
        return ok({ type, results, count: results.length });
      } catch (e) {
        return err(`List failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
