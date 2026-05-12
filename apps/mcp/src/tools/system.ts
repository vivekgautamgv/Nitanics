import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runRead, verifyConnection } from '../neo4j/driver.js';
import { spawnPython } from '../python/spawn.js';
import { ok, err } from '../helpers/ok-err.js';
import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';

export function registerSystemTools(server: McpServer) {

  // --- memorytonic_health ---
  server.registerTool(
    'memorytonic_health',
    {
      title: 'Health Check',
      description: 'Check if Neo4j, NLP tools, GDS, and skills are available. Call this first.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const checks: Record<string, unknown> = {};

      // Neo4j
      checks.neo4j = await verifyConnection();

      // Entity + project count (if connected)
      if (checks.neo4j) {
        try {
          const [counts] = await runRead<{ entities: number; projects: number }>(
            'MATCH (e:Entity) WITH count(e) AS entities ' +
            'MATCH (p:Project) WITH entities, count(p) AS projects ' +
            'RETURN entities, projects'
          );
          checks.entityCount = counts?.entities ?? 0;
          checks.projectCount = counts?.projects ?? 0;
        } catch {
          checks.entityCount = 0;
          checks.projectCount = 0;
        }
      }

      // NLP (Python + spaCy + sentence-transformers)
      try {
        const { spawn: spawnChild } = await import('node:child_process');
        const nlpOk = await new Promise<boolean>((resolve) => {
          const proc = spawnChild('python', ['-c', 'import spacy; import sentence_transformers; print("ok")'], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 15_000,
          });
          proc.on('close', (code) => resolve(code === 0));
          proc.on('error', () => resolve(false));
        });
        checks.nlpInstalled = nlpOk;
      } catch {
        checks.nlpInstalled = false;
      }

      // GDS
      if (checks.neo4j) {
        try {
          await runRead('RETURN gds.version() AS version');
          checks.gdsAvailable = true;
        } catch {
          checks.gdsAvailable = false;
        }
      } else {
        checks.gdsAvailable = false;
      }

      // Skills directory
      checks.skillsAvailable = fs.existsSync(config.skills_dir);

      return ok(checks);
    }
  );

  // --- memorytonic_bootstrap ---
  server.registerTool(
    'memorytonic_bootstrap',
    {
      title: 'Bootstrap Schema',
      description: 'Create Neo4j constraints, indexes, and default directories. Idempotent.',
      inputSchema: z.object({
        status: z.boolean().optional().describe('If true, only check status without creating anything'),
      }),
    },
    async ({ status }) => {
      try {
        const args = status ? ['--status'] : [];
        const result = await spawnPython('neo4j/bootstrap.py', args);
        return ok({ success: true, output: result.stdout });
      } catch (e) {
        return err(`Bootstrap failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_get_skills ---
  server.registerTool(
    'memorytonic_get_skills',
    {
      title: 'List Available Skills',
      description: 'List all available skill files organized by category. Skills contain extraction protocols, analysis guides, and system knowledge.',
      inputSchema: z.object({
        category: z.string().optional().describe('Filter by skill category (e.g., extraction, analysis, maps, system)'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ category }) => {
      try {
        const skills: { category: string; name: string; path: string }[] = [];

        function walk(dir: string, prefix: string) {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
            } else if (entry.name.endsWith('.md')) {
              const cat = prefix.replace(/\/$/, '') || 'root';
              if (!category || cat === category) {
                skills.push({ category: cat, name: entry.name.replace('.md', ''), path: `${prefix}${entry.name}` });
              }
            }
          }
        }

        walk(config.skills_dir, '');
        return ok({ skills, count: skills.length, skillsDir: config.skills_dir });
      } catch (e) {
        return err(`Failed to list skills: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_stats ---
  server.registerTool(
    'memorytonic_stats',
    {
      title: 'Database Statistics',
      description: 'Get counts of all node and relationship types in the database.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        // Run all count queries in parallel
        const [projects, entities, collections, directories,
               relationships, chains, bridges, embeddings, similarPairs] =
          await Promise.all([
            runRead<{ count: number }>('MATCH (p:Project) RETURN count(p) AS count'),
            runRead<{ count: number }>('MATCH (e:Entity) RETURN count(e) AS count'),
            runRead<{ count: number }>('MATCH (c:Collection) RETURN count(c) AS count'),
            runRead<{ count: number }>('MATCH (d:DirectoryCategory) RETURN count(d) AS count'),
            runRead<{ count: number }>('MATCH ()-[r:RELATES_TO]->() RETURN count(r) AS count'),
            runRead<{ count: number }>('MATCH (ch:CausalChain) RETURN count(ch) AS count'),
            runRead<{ count: number }>('MATCH (e:Entity) WHERE e.projectCount >= 2 RETURN count(e) AS count'),
            runRead<{ count: number }>('MATCH (e:Entity) WHERE e.embedding IS NOT NULL RETURN count(e) AS count'),
            runRead<{ count: number }>('MATCH ()-[s:SIMILAR_TO]->() RETURN count(s) / 2 AS count'),
          ]);

        const c = (arr: { count: number }[]) => arr[0]?.count ?? 0;

        return ok({
          projects: c(projects),
          entities: c(entities),
          collections: c(collections),
          directories: c(directories),
          relationships: c(relationships),
          chains: c(chains),
          bridges: c(bridges),
          embeddings: c(embeddings),
          similarPairs: c(similarPairs),
        });
      } catch (e) {
        return err(`Stats query failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
