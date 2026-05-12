import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSystemTools } from './tools/system.js';
import { registerQueryTools } from './tools/query.js';
import { registerEntityProjectTools } from './tools/entity-project.js';
import { registerCollectionTools } from './tools/collections.js';
import { registerAnalysisTools } from './tools/analysis.js';
import { registerExtractionTools } from './tools/extraction.js';
import { registerAdminTools } from './tools/admin.js';
import { registerLightweightTools } from './tools/lightweight.js';
import { registerResources } from './resources/loader.js';
import { registerPrompts } from './prompts/handler.js';

export const server = new McpServer(
  {
    name: 'memorytonic',
    version: '1.0.0',
  },
  {
    capabilities: { logging: {} },
    instructions:
      'MemoryTonic is a knowledge graph research tool. ' +
      'Use memorytonic_health to verify connectivity. ' +
      'Use memorytonic_stats for an overview. ' +
      'Use memorytonic_search or memorytonic_recall for discovery. ' +
      'Use memorytonic_extract for document ingestion (read extraction resources first). ' +
      'All data lives in Neo4j. Entity merge is alias-aware across projects.',
  }
);

// Register all tool groups
registerSystemTools(server);
registerQueryTools(server);
registerEntityProjectTools(server);
registerCollectionTools(server);
registerAnalysisTools(server);
registerExtractionTools(server);
registerAdminTools(server);
registerLightweightTools(server);

// Register resources (skill files) and prompts (workflow starters)
registerResources(server);
registerPrompts(server);
