import { afterAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.ts';
import { registerExtractionTools } from './extraction.ts';

const tools = new Map();
registerExtractionTools({ registerTool(name, options, callback) { tools.set(name, { ...options, callback }); } });
const extract = tools.get('memorytonic_extract');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'nitanics-mcp-test-'));
const previousPipelineDir = config.c01_dir;
config.c01_dir = fixture;

afterAll(() => {
  config.c01_dir = previousPipelineDir;
  // This directory is the exact temporary fixture created above, never a project path.
  fs.rmSync(fixture, { recursive: true });
});

function payload() {
  return {
    source_text: 'A small source names Example.',
    placement: { directory: 'Research', project_name: 'source-example', unique_id: 'source-example', collection: 'Examples', collection_is_new: false },
    html_content: '<p>A small source names Example.</p>',
    entities: { temporal_phases: [], entities: [{ name: 'Example', aliases: [], category: 'Concept', definition: 'A concept named in the source.', role: 'Named in this source.', first_appearance_index: null }] },
    extraction: { project: { name: 'Source Example', unique_id: 'source-example', summary: 'The source names Example.', narrative_flow: [], tags: { domain: 'Research', subdomain: 'Examples', base_tags: ['example'] } }, relationships: [], causal_chains: [] },
  };
}

describe('MCP extraction safety before providers or upload', () => {
  test('accepts a source-proportionate extraction without invented phases or connections', () => {
    expect(extract.inputSchema.safeParse(payload()).success).toBe(true);
  });

  test('rejects path traversal and unsafe folder names', () => {
    for (const slug of ['../existing', 'nested/project', 'nested\\project', '..', 'CON', 'project name']) {
      const input = payload();
      input.placement.project_name = slug;
      expect(extract.inputSchema.safeParse(input).success).toBe(false);
    }
  });

  test('rejects unsafe project IDs', () => {
    const input = payload();
    input.placement.unique_id = '../existing';
    input.extraction.project.unique_id = '../existing';
    expect(extract.inputSchema.safeParse(input).success).toBe(false);
  });

  test('rejects mismatched placement IDs without creating artifacts', async () => {
    const input = payload();
    input.extraction.project.unique_id = 'different-project';
    const result = await extract.callback(extract.inputSchema.parse(input));
    expect(result.isError).toBe(true);
    expect(fs.readdirSync(fixture)).toEqual([]);
  });

  test('preserves an existing staging folder', async () => {
    const dir = path.join(fixture, 'data', 'temp', 'source-example');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'source.md'), 'Preserve this original source.');
    const result = await extract.callback(extract.inputSchema.parse(payload()));
    expect(result.isError).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'source.md'), 'utf8')).toBe('Preserve this original source.');
  });

  test('preserves an existing permanent destination', async () => {
    const input = payload();
    input.placement.project_name = 'permanent-example';
    const dir = path.join(fixture, 'data', 'sources', new Date().toISOString().slice(0, 10), 'permanent-example');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'source.md'), 'Preserve this stored source.');
    const result = await extract.callback(extract.inputSchema.parse(input));
    expect(result.isError).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'source.md'), 'utf8')).toBe('Preserve this stored source.');
  });

  test('guidance permits sparse evidence instead of requiring fabricated connections', async () => {
    const result = await tools.get('memorytonic_extraction_guide').callback({});
    const { qualityBar } = JSON.parse(result.content[0].text);
    expect(qualityBar.minEntities).toBe(1);
    expect(qualityBar.minRelationships).toBe(0);
    expect(qualityBar.minCausalChains).toBe(0);
  });
});
