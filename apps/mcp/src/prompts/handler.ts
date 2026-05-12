import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';

/** Safely read a skill file, return empty string if missing */
function readSkill(...segments: string[]): string {
  const filePath = path.resolve(config.skills_dir, ...segments);
  if (!filePath.startsWith(config.skills_dir)) return '';
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function registerPrompts(server: McpServer) {

  // --- extract-document ---
  server.registerPrompt(
    'extract-document',
    {
      title: 'Extract Document',
      description: 'Start a document extraction workflow. Loads all relevant extraction skills and quality requirements.',
      argsSchema: {
        contentType: z.string().optional().describe('Content type hint (e.g., geopolitics, finance, technology)'),
      },
    },
    ({ contentType }) => {
      const skills = [
        readSkill('maps', 'pipeline-map.md'),
        readSkill('extraction', 'kg-theory.md'),
        readSkill('extraction', 'entity-discovery.md'),
        readSkill('extraction', 'relationship-building.md'),
        readSkill('extraction', 'causal-chains.md'),
        readSkill('extraction', 'quality-bar.md'),
        readSkill('extraction', 'display-awareness.md'),
        readSkill('extraction', 'tag-awareness.md'),
        readSkill('extraction', 'html-template.md'),
      ].filter(Boolean);

      // Load domain skill if applicable
      if (contentType) {
        const domainSkill = readSkill('instructions', `${contentType.toLowerCase()}.md`);
        if (domainSkill) skills.push(domainSkill);
      }

      // Load agent.md for user preferences
      const agentConfig = readSkill('agent.md');
      if (agentConfig) skills.push(agentConfig);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                '# Document Extraction Workflow\n\n' +
                'Follow these steps:\n' +
                '1. Read the document carefully\n' +
                '2. Call memorytonic_extraction_guide for field reference\n' +
                '3. Call memorytonic_nlp_preprocess with the raw text\n' +
                '4. Discover entities (10+ entities, 100+ char definitions, aliases, categories)\n' +
                '5. Build relationships (15+, 80+ char descriptions, exact evidence quotes)\n' +
                '6. Write causal chains (2+, system mechanics)\n' +
                '7. Call memorytonic_collection({ action: "suggestions" }) for placement\n' +
                '8. Call memorytonic_extract with complete payload\n' +
                '9. Call memorytonic_admin({ action: "recompute" }) to update graph metrics\n\n' +
                '---\n\n' +
                skills.join('\n\n---\n\n'),
            },
          },
        ],
      };
    }
  );

  // --- analyze-collection ---
  server.registerPrompt(
    'analyze-collection',
    {
      title: 'Analyze Collection',
      description: 'Start a collection analysis workflow. Loads bridge detection, gap analysis, and GDS skills.',
      argsSchema: {
        collectionName: z.string().describe('Collection to analyze'),
      },
    },
    ({ collectionName }) => {
      const skills = [
        readSkill('analysis', 'bridge-detection.md'),
        readSkill('analysis', 'gap-analysis.md'),
        readSkill('analysis', 'collection-analysis.md'),
        readSkill('system', 'gds-guide.md'),
        readSkill('system', 'schema-guide.md'),
      ].filter(Boolean);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                `# Collection Analysis: ${collectionName}\n\n` +
                'Follow these steps:\n' +
                `1. Call memorytonic_collection({ action: "get", name: "${collectionName}" }) for overview\n` +
                `2. Call memorytonic_collection({ action: "bridges", name: "${collectionName}" }) for bridge entities\n` +
                `3. Call memorytonic_importance({ collection: "${collectionName}" }) for top entities\n` +
                `4. Call memorytonic_gaps({ collection: "${collectionName}" }) for research gaps\n` +
                '5. Synthesize findings: what patterns emerge? What connections are missing?\n' +
                '6. Recommend next documents to extract that would fill gaps\n\n' +
                '---\n\n' +
                skills.join('\n\n---\n\n'),
            },
          },
        ],
      };
    }
  );

  // --- explore-entity ---
  server.registerPrompt(
    'explore-entity',
    {
      title: 'Explore Entity',
      description: 'Deep-dive into a specific entity across all projects and connections.',
      argsSchema: {
        entityName: z.string().describe('Entity to explore'),
      },
    },
    ({ entityName }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `# Entity Deep-Dive: ${entityName}\n\n` +
              'Follow these steps:\n' +
              `1. Call memorytonic_get_entity({ name: "${entityName}" }) for full profile\n` +
              `2. Call memorytonic_explore({ entityName: "${entityName}", hops: 2 }) for neighborhood\n` +
              `3. Review roles across different projects — how does this entity's role change?\n` +
              '4. Check bridge tier and graph metrics (pageRank, betweenness)\n' +
              '5. Look at similar entities — are any duplicates? Are any worth investigating?\n' +
              '6. Summarize: what is this entity\'s systemic role across all research?\n',
          },
        },
      ],
    })
  );

  // --- introduction ---
  server.registerPrompt(
    'memorytonic-introduction',
    {
      title: 'MemoryTonic Introduction',
      description: 'Orient yourself with MemoryTonic. Loads system map and skill index.',
      argsSchema: {},
    },
    () => {
      const systemMap = readSkill('maps', 'system-map.md');
      const skillIndex = readSkill('maps', 'skill-index.md');
      const agentConfig = readSkill('agent.md');

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                '# MemoryTonic Orientation\n\n' +
                'Read the following to understand what MemoryTonic is and how to use it.\n\n' +
                '---\n\n' +
                [systemMap, skillIndex, agentConfig].filter(Boolean).join('\n\n---\n\n'),
            },
          },
        ],
      };
    }
  );
}
