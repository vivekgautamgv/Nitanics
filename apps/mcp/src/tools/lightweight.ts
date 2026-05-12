/**
 * Lightweight ingestion tools — direct Neo4j writes, no Python pipeline.
 * For quick captures: insights, conversations, manual project stubs.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ingestLightweight } from '../neo4j/ingest.js';
import { ok, err } from '../helpers/ok-err.js';

export function registerLightweightTools(server: McpServer) {

  // --- memorytonic_store_insight ---
  server.registerTool(
    'memorytonic_store_insight',
    {
      title: 'Store Insight',
      description:
        'Store a single insight/observation as an entity with optional relationships. ' +
        'Quick way to add one piece of knowledge without full extraction pipeline.',
      inputSchema: z.object({
        name: z.string().describe('Insight name/title'),
        category: z.string().optional().describe('Entity category (default: Concept)'),
        description: z.string().describe('What this insight is about'),
        projectName: z.string().describe('Project to attach to (created if new)'),
        directoryCategory: z.string().optional().describe('Directory (default: Conversational)'),
        tags: z.array(z.string()).optional().describe('Tags for the project'),
        relatedEntities: z.array(z.object({
          name: z.string(),
          relType: z.string().optional().describe('Relationship type (default: RELATES_TO)'),
          description: z.string().optional().describe('Relationship description'),
        })).optional().describe('Entities this insight relates to'),
      }),
    },
    async ({ name, category, description, projectName, directoryCategory, tags, relatedEntities }) => {
      try {
        const result = await ingestLightweight({
          project: {
            name: projectName,
            summary: description,
            sourceType: 'conversation',
            tags: tags ?? [],
            directoryCategory: directoryCategory ?? 'Conversational',
          },
          entities: [{
            name,
            category: category ?? 'Concept',
            description,
            role: 'Primary insight captured from conversation',
            confidence: 0.85,
            relationships: relatedEntities?.map(r => ({
              target: r.name,
              type: r.relType ?? 'RELATES_TO',
              description: r.description ?? 'Related insight',
            })),
          }],
          htmlContent: `<article><h1>${name}</h1><p>${description}</p></article>`,
        });
        return ok({
          projectId: result.projectId,
          entityCount: result.entityCount,
          merged: result.mergedEntityCount > 0,
          durationMs: result.durationMs,
        });
      } catch (e) {
        return err(`Store insight failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_extract_conversation ---
  server.registerTool(
    'memorytonic_extract_conversation',
    {
      title: 'Extract From Conversation',
      description:
        'Extract knowledge from a Claude conversation. Lighter than memorytonic_extract — no HTML generation needed. ' +
        'For storing important discussions, decisions, and learnings.',
      inputSchema: z.object({
        conversationSummary: z.string().describe('What the conversation was about'),
        project: z.object({
          name: z.string(),
          tags: z.array(z.string()),
          directoryCategory: z.string().optional().describe('Default: Conversational'),
          collections: z.array(z.string()).optional(),
        }),
        entities: z.array(z.object({
          name: z.string(),
          category: z.string(),
          description: z.string(),
          role: z.string(),
          aliases: z.array(z.string()).optional(),
          relationships: z.array(z.object({
            target: z.string(),
            type: z.string(),
            description: z.string(),
            causalClassification: z.string().optional(),
            evidence: z.string().optional(),
          })).optional(),
        })),
        keyInsights: z.array(z.string()).optional().describe('Notable conclusions from the conversation'),
      }),
    },
    async ({ conversationSummary, project, entities, keyInsights }) => {
      try {
        const insightsHtml = keyInsights
          ? `<h2>Key Insights</h2><ul>${keyInsights.map(i => `<li>${i}</li>`).join('')}</ul>`
          : '';

        const result = await ingestLightweight({
          project: {
            name: project.name,
            summary: conversationSummary,
            sourceType: 'conversation',
            tags: project.tags,
            directoryCategory: project.directoryCategory ?? 'Conversational',
            narrativeFlow: keyInsights?.join(' → '),
            collections: project.collections,
          },
          entities: entities.map(e => ({
            name: e.name,
            category: e.category,
            description: e.description,
            role: e.role,
            aliases: e.aliases,
            relationships: e.relationships?.map(r => ({
              target: r.target,
              type: r.type,
              description: r.description,
              causalClassification: r.causalClassification,
              evidence: r.evidence,
            })),
          })),
          htmlContent: `<article><h1>${project.name}</h1><p>${conversationSummary}</p>${insightsHtml}</article>`,
          keyInsights,
        });

        return ok({
          projectId: result.projectId,
          projectName: result.projectName,
          stats: {
            entitiesCreated: result.newEntityCount,
            entitiesMerged: result.mergedEntityCount,
            relationshipsCreated: result.relationshipCount,
          },
          embeddings: {
            entitiesEmbedded: result.entitiesEmbedded,
            projectEmbedded: result.projectEmbedded,
          },
          durationMs: result.durationMs,
        });
      } catch (e) {
        return err(`Conversation extraction failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_create_project ---
  server.registerTool(
    'memorytonic_create_project',
    {
      title: 'Create Project',
      description:
        'Create a project node manually without full extraction. ' +
        'Useful for organizing before adding entities, or as a placeholder.',
      inputSchema: z.object({
        name: z.string().describe('Project name'),
        summary: z.string().describe('Project summary/description'),
        directoryCategory: z.string().optional().describe('Directory (default: Research)'),
        tags: z.array(z.string()).optional().describe('Tags'),
        sourceType: z.string().optional().describe('Source type (default: manual)'),
      }),
    },
    async ({ name, summary, directoryCategory, tags, sourceType }) => {
      try {
        const result = await ingestLightweight({
          project: {
            name,
            summary,
            sourceType: sourceType ?? 'manual',
            tags: tags ?? [],
            directoryCategory: directoryCategory ?? 'Research',
          },
          entities: [],
          htmlContent: `<article><h1>${name}</h1><p>${summary}</p></article>`,
        });
        return ok({ projectId: result.projectId, projectName: result.projectName });
      } catch (e) {
        return err(`Create project failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
