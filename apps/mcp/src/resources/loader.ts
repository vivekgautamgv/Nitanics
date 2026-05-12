import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Security: normalize path, reject traversal, verify containment.
 * From QC-REPORT EA3 + DESIGN-SPEC resource loader security.
 */
function resolveSkillPath(category: string, name: string): string | null {
  // Reject absolute paths and traversal
  if (category.includes('..') || name.includes('..')) return null;
  if (path.isAbsolute(category) || path.isAbsolute(name)) return null;

  const resolved = path.resolve(config.skills_dir, category, `${name}.md`);

  // Verify resolved path is inside skills directory
  if (!resolved.startsWith(config.skills_dir)) return null;

  return resolved;
}

/** Recursively scan skills directory for .md files */
function scanSkills(): { uri: string; name: string; category: string; filePath: string }[] {
  const skills: { uri: string; name: string; category: string; filePath: string }[] = [];

  function walk(dir: string, prefix: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.md')) {
        const skillName = entry.name.replace('.md', '');
        const category = prefix.replace(/\/$/, '') || 'root';
        skills.push({
          uri: `memorytonic://skills/${prefix}${skillName}`,
          name: `${prefix}${skillName}`,
          category,
          filePath: path.join(dir, entry.name),
        });
      }
    }
  }

  walk(config.skills_dir, '');
  return skills;
}

export function registerResources(server: McpServer) {
  // Dynamic resource: any skill file by category/name
  server.registerResource(
    'skill',
    new ResourceTemplate('memorytonic://skills/{category}/{name}', {
      list: async () => {
        const skills = scanSkills();
        return {
          resources: skills.map(s => ({
            uri: s.uri,
            name: s.name,
            description: `Skill: ${s.name}`,
            mimeType: 'text/markdown',
          })),
        };
      },
    }),
    {
      title: 'MemoryTonic Skill Files',
      description: 'Instruction files that teach Claude extraction, analysis, and system knowledge.',
      mimeType: 'text/markdown',
    },
    async (uri, { category, name }) => {
      const resolved = resolveSkillPath(category as string, name as string);
      if (!resolved) {
        return { contents: [{ uri: uri.href, text: 'Error: Invalid skill path (possible path traversal)' }] };
      }

      if (!fs.existsSync(resolved)) {
        return { contents: [{ uri: uri.href, text: `Error: Skill file not found: ${category}/${name}` }] };
      }

      const content = fs.readFileSync(resolved, 'utf-8');
      return { contents: [{ uri: uri.href, text: content }] };
    }
  );

  // Root-level skill files (agent.md)
  server.registerResource(
    'agent-config',
    'memorytonic://skills/agent',
    {
      title: 'Agent Configuration',
      description: 'User customization file (agent.md). Read this for user preferences on extraction style, defaults, and domain knowledge.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const agentPath = path.resolve(config.skills_dir, 'agent.md');
      if (!fs.existsSync(agentPath)) {
        return { contents: [{ uri: uri.href, text: '# No agent.md configured yet' }] };
      }
      const content = fs.readFileSync(agentPath, 'utf-8');
      return { contents: [{ uri: uri.href, text: content }] };
    }
  );
}
