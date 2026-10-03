import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ok, err } from '../helpers/ok-err.js';
import { spawnPython, spawnPythonJSON } from '../python/spawn.js';
import { CATEGORIES, CAUSAL_FAMILIES, EVIDENCE_STRENGTHS, MAGNITUDES } from '../constants/index.js';
import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';

export function registerExtractionTools(server: McpServer) {

  // --- memorytonic_extraction_guide ---
  server.registerTool(
    'memorytonic_extraction_guide',
    {
      title: 'Extraction Guide',
      description: 'Load extraction protocol, quality bar, categories, causal types, and field names. Read this BEFORE starting extraction.',
      inputSchema: z.object({
        contentType: z.string().optional().describe('Content type hint for domain-specific guidance'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ contentType }) => {
      const guide: Record<string, unknown> = {
        categories: [...CATEGORIES],
        causalTypes: [...CAUSAL_FAMILIES],
        evidenceStrengths: [...EVIDENCE_STRENGTHS],
        magnitudes: [...MAGNITUDES],
        fieldNames: {
          entity: ['name', 'aliases', 'category', 'definition', 'role', 'first_appearance_index'],
          relationship: ['source', 'target', 'relType', 'causalClassification', 'description', 'evidence', 'evidenceStrength', 'magnitude', 'year'],
          causalChain: ['name', 'description', 'links[].source', 'links[].target', 'links[].explanation'],
          project: ['name', 'unique_id', 'summary', 'narrative_flow', 'tags.domain', 'tags.subdomain', 'tags.base_tags'],
        },
        qualityBar: {
          entityDefinition: 'Nonempty, source-supported, proportionate to the document',
          entityRole: 'Describe the role supported by this source',
          edgeDescription: 'Explain the connection supported by the evidence',
          evidence: 'Exact source quotes; provide source_text so validation can check them',
          summary: 'Nonempty, source-proportionate; no word or character quotas',
          minEntities: 1,
          minRelationships: 0,
          minCausalChains: 0,
          temporalPhases: 'Optional; use [] and first_appearance_index: null when unsupported',
          causalChains: 'Optional; every included link must match an evidence-bearing relationship',
          embeddings: 'Real 384-dimensional vectors for every entity and the project; project label is unique_id',
        },
        traps: [
          'Entity names are case-sensitive. "IMF" ≠ "imf".',
          'Aliases help cross-project merge. Include only supported aliases; [] is valid.',
          'Do not invent entities, connections, temporal phases, or causal chains to meet a count.',
          'relType is the specific verb (FUNDS, SANCTIONS). causalClassification is the family (ENABLES, BLOCKS).',
          'Collection assignment is MANDATORY. Claude must suggest or create.',
          'Bridge detection breaks without alias-aware entity merge.',
        ],
      };

      // Load domain skill if content type matches
      if (contentType) {
        const domainFiles = ['geopolitics', 'finance', 'technology'];
        const matchedDomain = domainFiles.find(d => contentType.toLowerCase().includes(d));
        if (matchedDomain) {
          try {
            const domainPath = path.resolve(config.skills_dir, 'instructions', `${matchedDomain}.md`);
            const domainContent = fs.readFileSync(domainPath, 'utf-8');
            guide.domainGuidance = { domain: matchedDomain, content: domainContent };
          } catch {
            // Domain file not found, not critical
          }
        }
      }

      return ok(guide);
    }
  );

  // --- memorytonic_nlp_preprocess ---
  server.registerTool(
    'memorytonic_nlp_preprocess',
    {
      title: 'NLP Preprocessing',
      description: 'Run NLP on raw text: spaCy NER + TF-IDF keywords + co-occurrence analysis. Returns entity candidates for Claude to review.',
      inputSchema: z.object({
        text: z.string().describe('Raw document text'),
        title: z.string().optional().describe('Document title (helps NLP context)'),
      }),
    },
    async ({ text, title }) => {
      try {
        const result = await spawnPythonJSON<{
          entity_candidates: unknown[];
          co_occurrences: unknown[];
          keywords: unknown[];
          dedup_groups?: unknown[];
        }>('nlp/preprocess.py', [], { text, title });
        return ok(result);
      } catch (e) {
        return err(`NLP preprocessing failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // --- memorytonic_extract ---
  server.registerTool(
    'memorytonic_extract',
    {
      title: 'Extract & Upload',
      description:
        'The main extraction pipeline. Takes complete extraction payload (placement + HTML + entities + extraction), ' +
        'validates, generates embeddings, uploads to Neo4j, and organizes files. ' +
        'Claude must complete entity discovery and extraction BEFORE calling this.',
      inputSchema: z.object({
        source_text: z.string().min(1).optional().describe('Exact original document text, saved as source.md for evidence quote validation'),
        placement: z.object({
          directory: z.string(),
          project_name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).describe('Unique lowercase hyphenated project slug'),
          unique_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,119}$/).describe('New globally unique project ID'),
          collection: z.string(),
          collection_is_new: z.boolean(),
        }),
        html_content: z.string().describe('Full styled HTML content'),
        entities: z.object({
          temporal_phases: z.array(z.object({
            index: z.number(),
            label: z.string(),
            period: z.string(),
          })),
          entities: z.array(z.object({
            name: z.string(),
            aliases: z.array(z.string()),
            category: z.string(),
            definition: z.string(),
            role: z.string(),
            first_appearance_index: z.number().nullable(),
          })),
        }),
        extraction: z.object({
          project: z.object({
            name: z.string(),
            unique_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,119}$/),
            summary: z.string(),
            narrative_flow: z.array(z.string()),
            tags: z.object({
              domain: z.string(),
              subdomain: z.string(),
              base_tags: z.array(z.string()),
            }),
          }),
          relationships: z.array(z.object({
            source: z.string(),
            target: z.string(),
            relType: z.string(),
            causalClassification: z.string(),
            description: z.string(),
            evidence: z.string(),
            evidenceStrength: z.string(),
            magnitude: z.string(),
            year: z.string().default(''),
          })),
          causal_chains: z.array(z.object({
            name: z.string(),
            description: z.string(),
            links: z.array(z.object({
              source: z.string(),
              target: z.string(),
              explanation: z.string(),
            })),
          })),
        }),
      }),
    },
    async (payload) => {
      const startTime = Date.now();
      const slug = payload.placement.project_name;
      const stagingRoot = path.resolve(config.c01_dir, 'data', 'temp');
      const tempDir = path.join(stagingRoot, slug);
      const today = new Date().toISOString().slice(0, 10);
      const permanentRoot = path.resolve(config.c01_dir, 'data', 'sources', today);
      const permanentDir = path.join(permanentRoot, slug);
      if (payload.placement.unique_id !== payload.extraction.project.unique_id) {
        return err('placement.unique_id and extraction.project.unique_id must match. Nothing was uploaded.');
      }
      if (fs.existsSync(tempDir) || fs.existsSync(permanentDir)) {
        return err('A staging or source folder already exists for this project slug. Choose a new slug; existing artifacts were preserved.');
      }

      try {
        // Step 1: Write artifacts to temp directory
        fs.mkdirSync(stagingRoot, { recursive: true });
        fs.mkdirSync(tempDir);

        fs.writeFileSync(path.join(tempDir, '01_html.html'), payload.html_content);
        if (payload.source_text !== undefined) fs.writeFileSync(path.join(tempDir, 'source.md'), payload.source_text);
        fs.writeFileSync(path.join(tempDir, '02_placement.json'), JSON.stringify(payload.placement, null, 2));
        fs.writeFileSync(path.join(tempDir, '04_all_entities.json'), JSON.stringify(payload.entities, null, 2));
        fs.writeFileSync(path.join(tempDir, '06_extraction.json'), JSON.stringify(payload.extraction, null, 2));

        // Step 2: Generate embeddings (before validation — validate expects 05_embeddings.json)
        let embeddingCount = 0;
        try {
          const textsToEmbed: string[] = [];
          const namesToEmbed: string[] = [];

          for (const entity of payload.entities.entities) {
            textsToEmbed.push(`${entity.definition} ${entity.role}`);
            namesToEmbed.push(entity.name);
          }
          textsToEmbed.push(payload.extraction.project.summary);
          namesToEmbed.push(payload.extraction.project.unique_id);

          const embedResult = await spawnPythonJSON<{
            embeddings: { name: string; embedding: number[]; dimensions: number }[];
            model: string;
            dimensions: number;
          }>('nlp/embed.py', [], { texts: textsToEmbed, names: namesToEmbed });

          fs.writeFileSync(path.join(tempDir, '05_embeddings.json'), JSON.stringify(embedResult, null, 2));
          embeddingCount = embedResult.embeddings.length;
        } catch (embedError) {
          throw new Error(`Embedding generation failed; nothing was uploaded: ${embedError instanceof Error ? embedError.message : String(embedError)}`);
        }

        // Step 3: Validate (--import-mode skips 03_nlp_entities.json which MCP pipeline doesn't generate)
        try {
          await spawnPython('neo4j/validate_project.py', ['--import-mode', tempDir]);
        } catch (e) {
          return err(`Validation failed: ${e instanceof Error ? e.message : String(e)}. Review artifacts were preserved in ${tempDir}.`);
        }

        // Step 4: Move artifacts from temp → permanent storage
        // upload.py sets htmlPath to data/sources/YYYY-MM-DD/slug/ but doesn't create it
        fs.mkdirSync(permanentRoot, { recursive: true });
        fs.mkdirSync(permanentDir);

        for (const file of fs.readdirSync(tempDir)) {
          fs.renameSync(path.join(tempDir, file), path.join(permanentDir, file));
        }
        // Remove empty temp dir
        try { fs.rmdirSync(tempDir); } catch {}

        // Step 5: Upload to Neo4j (reads from permanent path)
        const uploadResult = await spawnPython('neo4j/upload.py', [permanentDir, '--create-only'], undefined, 300_000);

        const durationMs = Date.now() - startTime;

        return ok({
          success: true,
          projectId: slug,
          stats: {
            entities: payload.entities.entities.length,
            relationships: payload.extraction.relationships.length,
            causalChains: payload.extraction.causal_chains.length,
            temporalPhases: payload.entities.temporal_phases.length,
          },
          embeddingCount,
          durationMs,
          uploadOutput: uploadResult.stdout,
        });
      } catch (e) {
        return err(`Extraction pipeline failed: ${e instanceof Error ? e.message : String(e)}. Artifacts were preserved for review in ${tempDir} or ${permanentDir}.`);
      }
    }
  );
}
