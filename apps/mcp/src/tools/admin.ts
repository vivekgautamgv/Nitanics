import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ok, err } from '../helpers/ok-err.js';
import { spawnPython } from '../python/spawn.js';

export function registerAdminTools(server: McpServer) {

  // --- memorytonic_recompute ---
  server.registerTool(
    'memorytonic_recompute',
    {
      title: 'Recompute Graph Metrics',
      description:
        'Run GDS algorithms to update graph metrics: PageRank, Betweenness Centrality, Degree Centrality, Node Similarity. ' +
        'Run after ingesting new projects. Can target specific algorithms.',
      inputSchema: z.object({
        algorithms: z.array(z.enum(['pagerank', 'betweenness', 'degree', 'similarity']))
          .optional()
          .describe('Specific algorithms to run (default: all)'),
      }),
    },
    async ({ algorithms }) => {
      try {
        const args = algorithms?.map(a => `--${a}`) ?? [];
        const result = await spawnPython('neo4j/gds.py', args, undefined, 600_000);
        return ok({ action: 'recomputed', algorithms: algorithms ?? ['all'], output: result.stdout });
      } catch (e) {
        return err(`GDS recompute failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_admin ---
  server.registerTool(
    'memorytonic_admin',
    {
      title: 'Admin Operations',
      description:
        'Administrative operations. Actions: ' +
        'export (export collection to ZIP), ' +
        'import (import collection from ZIP), ' +
        'delete_project (cascade delete a project and all its data).',
      inputSchema: z.object({
        action: z.enum(['export', 'import', 'delete_project'])
          .describe('Admin action to perform'),
        collectionName: z.string().optional()
          .describe('Collection name (for export)'),
        zipPath: z.string().optional()
          .describe('Path to ZIP file (for import)'),
        projectUniqueId: z.string().optional()
          .describe('Project unique ID (for delete_project)'),
        dryRun: z.boolean().optional()
          .describe('If true, validate only without executing (for import/delete)'),
      }),
    },
    async ({ action, collectionName, zipPath, projectUniqueId, dryRun }) => {
      try {
        switch (action) {
          case 'export': {
            if (!collectionName) return err('collectionName required for export');
            const result = await spawnPython('neo4j/export_collection.py', [collectionName], undefined, 300_000);
            return ok({ action: 'exported', collection: collectionName, output: result.stdout });
          }
          case 'import': {
            if (!zipPath) return err('zipPath required for import');
            // --force skips interactive prompts (MCP has no tty)
            const args = [zipPath, '--force'];
            if (dryRun) args.push('--dry-run');
            const result = await spawnPython('neo4j/import_collection.py', args, undefined, 600_000);
            return ok({ action: dryRun ? 'validated' : 'imported', output: result.stdout });
          }
          case 'delete_project': {
            if (!projectUniqueId) return err('projectUniqueId required for delete_project');
            const args = [projectUniqueId];
            if (dryRun) args.push('--dry-run');
            // delete_project.py uses input() for confirmation — send newline to confirm
            const result = await spawnPython('neo4j/delete_project.py', args, dryRun ? undefined : '\n');
            return ok({ action: dryRun ? 'dry_run' : 'deleted', project: projectUniqueId, output: result.stdout });
          }
          default:
            return err(`Unknown admin action: ${action}`);
        }
      } catch (e) {
        return err(`Admin ${action} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
