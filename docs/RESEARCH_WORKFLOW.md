# Research with papers and reports

Start the workspace with `bun run dev` and open the web UI URL printed by the development server (`http://localhost:5174` by default). Use the actual address if your host or port differs.
Neo4j stores the graph locally. Optional AI extraction sends document text to the provider you select in the extraction step.

## Explore existing research

1. On Home, search collection names and descriptions, filter by workspace, or sort by document count. Dashboard totals count unique documents and entities, even when they appear in several collections.
2. Open **Documents** to search titles, domains, and tags. Open a document to inspect its findings, relationships, and evidence. Use **Read source** to check the original context.
3. Open **Bridges** to find entities shared by multiple documents within that collection. Shared mentions suggest a connection; they do not establish that the sources agree.
4. In **Graph**, switch between Collection, Document, and Bridges. Document mode isolates the chosen source. Search respects that scope. Use the panel controls or full screen to make room for the graph.
5. Use **Path Finder** to trace connections in the loaded scope. Semantic relationships are the default. Enable document connections when you want paths through shared source membership. Paths are undirected exploratory connections, not proof of a causal claim.
6. Open **Chains** to inspect extracted reasoning and follow the source document to verify its evidence.
7. Use **Export**, wait for completion, then **Download ZIP** to save a portable collection. The export manifest records any missing source files.

If a dated legacy source path is missing, the reader can recover the exact project's original from its matching extraction metadata. A visible notice identifies the recovered artifact. If no matching source exists, the reader explains the missing file instead of displaying a blank page.

## Add research without replacing existing work

**Add documents** supports Markdown, UTF-8 text, and text-based PDFs. Each batch supports up to 20 files, 10 MiB per file, and 25 MiB total. Rename duplicate filenames before uploading. Scanned PDFs need OCR first.

Choose **Upload with API** for provider-based extraction inside the browser. Choose **Use AI agent** to copy a prompt for Claude Code, Codex, or another coding agent with this repository open. Attach full documents in that agent's chat or give local file paths. The agent saves sources and artifacts, validates them, and uploads them to the same Neo4j database. That route uses the agent's own model and needs no separate extraction API key. Return to the app and refresh collections to see the result.

Choose an existing collection or create a new one, review the destination, and select an extraction provider. A supplied key is used for that provider; an empty field uses its configured environment key. Browser settings currently store saved keys locally.

The UI remembers the job identity and destination so you can navigate away or reload and return to **Add documents** for progress. It does not persist uploaded document contents in the resume record. Job state lives in the API process; restarting the API loses in-flight status. The UI explains expired or unavailable jobs.

New projects receive unique folders under `graphs/<collection>/<project>/`. Source text and generated artifacts remain available for review after failure. Existing collections and projects are preserved. Upload runs only after artifact validation succeeds.

Extraction does not add placeholder entities, invented links, filler reasoning, or zero embeddings to meet quotas. Validation accepts short sources with at least one supported entity, and relationships, temporal phases, and causal chains may be empty when unsupported. Required fields, known entity references, exact source quotes, and complete real embeddings are checked. Invalid extractions fail explicitly. Failed multi-document batches can contain successfully uploaded projects; inspect the results before submitting the same sources again. See [INGESTION_FOR_AGENTS.md](INGESTION_FOR_AGENTS.md) for the direct agent workflow.

## Verification

```bash
bun run build
bun run build:mcp
bun run build:api
bun run nlp:setup --check
node --test scripts/tests/setup-nlp.test.mjs
bun test apps/mcp/src/tools/extraction.test.mjs
uv run --directory apps/ingestion-pipeline python -m unittest discover -s tests -p 'test_*.py'
bun run --cwd apps/api test
bun test apps/web/frontend/tests apps/web/source-docs.test.ts apps/web/modules/graph-studio/src/stores/graph-store.test.mjs apps/web/modules/graph-studio/src/utils/graph-paths.test.mjs apps/web/modules/graph-studio/src/utils/paths.test.mjs
```

The automated checks use mocks and temporary fixtures. Browser checks and graph query checks can read existing data without uploading research or calling an AI provider.
