import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createCollection, getCollection, deleteCollection,
  addToCollection, removeFromCollection,
  collectionBridges, collectionSuggestions,
  createDirectory,
} from '../neo4j/queries.js';
import { ok, err } from '../helpers/ok-err.js';

export function registerCollectionTools(server: McpServer) {

  // --- memorytonic_collection ---
  server.registerTool(
    'memorytonic_collection',
    {
      title: 'Manage Collections',
      description:
        'Manage collections. Actions: ' +
        'create (new collection), get (full view with projects/bridges), delete (removes collection, keeps projects), ' +
        'add (project to collection), remove (project from collection), ' +
        'bridges (bridge entities within collection), suggestions (find matching collections for entities).',
      inputSchema: z.object({
        action: z.enum(['create', 'get', 'delete', 'add', 'remove', 'bridges', 'suggestions'])
          .describe('What to do'),
        name: z.string().optional()
          .describe('Collection name (required for create/get/delete/add/remove/bridges)'),
        description: z.string().optional()
          .describe('Collection description (for create)'),
        projectUniqueId: z.string().optional()
          .describe('Project unique ID (for add/remove)'),
        entityNames: z.array(z.string()).optional()
          .describe('Entity names to match (for suggestions)'),
      }),
    },
    async ({ action, name, description, projectUniqueId, entityNames }) => {
      try {
        switch (action) {
          case 'create': {
            if (!name) return err('name is required for create');
            const result = await createCollection(name, description);
            return ok({ action: 'created', collection: result[0] });
          }
          case 'get': {
            if (!name) return err('name is required for get');
            const result = await getCollection(name);
            if (!result) return err(`Collection "${name}" not found`);
            return ok(result);
          }
          case 'delete': {
            if (!name) return err('name is required for delete');
            const result = await deleteCollection(name);
            return ok({ action: 'deleted', ...result });
          }
          case 'add': {
            if (!name || !projectUniqueId) return err('name and projectUniqueId required for add');
            const result = await addToCollection(projectUniqueId, name);
            return ok({ action: 'added', ...result[0] });
          }
          case 'remove': {
            if (!name || !projectUniqueId) return err('name and projectUniqueId required for remove');
            const result = await removeFromCollection(projectUniqueId, name);
            return ok({ action: 'removed', ...result });
          }
          case 'bridges': {
            if (!name) return err('name is required for bridges');
            const result = await collectionBridges(name);
            return ok({ collection: name, bridges: result, count: result.length });
          }
          case 'suggestions': {
            if (!entityNames || entityNames.length === 0) return err('entityNames required for suggestions');
            const result = await collectionSuggestions(entityNames);
            return ok({ suggestions: result });
          }
          default:
            return err(`Unknown action: ${action}`);
        }
      } catch (e) {
        return err(`Collection ${action} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_create_directory ---
  // Directories are simple enough to keep as a direct action in collections file
  server.registerTool(
    'memorytonic_create_directory',
    {
      title: 'Create Directory',
      description: 'Create a custom directory category (e.g., Skills, Agents). Default directories: Research, Business, Personal.',
      inputSchema: z.object({
        name: z.string().describe('Directory name'),
        description: z.string().describe('What this directory is for'),
      }),
    },
    async ({ name, description }) => {
      try {
        const result = await createDirectory(name, description);
        return ok({ action: 'created', directory: result[0] });
      } catch (e) {
        return err(`Create directory failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
