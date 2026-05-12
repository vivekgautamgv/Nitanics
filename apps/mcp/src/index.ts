// Config loaded from ~/.memorytonic/config.json (see neo4j/driver.ts)
// Env vars override config.json if set.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { server } from './server.js';

// stdout is the MCP protocol pipe. ALL logging MUST go to stderr.
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('MemoryTonic MCP server running on stdio');
