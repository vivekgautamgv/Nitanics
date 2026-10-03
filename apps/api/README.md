# Local ingestion and export API

Run with `bun run dev:api` from the repository root. The server binds to `127.0.0.1:5176`; `NITANICS_API_PORT` can override the port. `uv` and the pipeline's Python dependencies must be available for real jobs.

## First-time preparation

Install Node.js 20+, Bun 1.3+, uv, and Docker Desktop. Start Docker Desktop, then run these commands from the cloned repository root:

```text
bun install
bun run neo4j:ensure
bun run nlp:setup
bun run dev
```

`bun install` runs `uv sync` in `apps/ingestion-pipeline`; its Python 3.12 pin and lockfile install dependencies in `apps/ingestion-pipeline/.venv`. The English spaCy model is a declared dependency, so later `uv sync` does not remove it. `nlp:setup` checks that model and caches MiniLM for real 384-dimensional embeddings. Its first run needs internet for model downloads. `bun run nlp:setup --check` checks local model readiness without downloads or dependency changes.

API jobs use `uv run python` from that same pipeline directory. Use its uv environment for manual ingestion commands as well; the legacy `nlp/setup-nlp.py` creates a separate `nlp/.venv` that these API jobs do not use.

Neo4j configuration for Python jobs lives in the gitignored `apps/ingestion-pipeline/neo4j/.env`: `NEO4J_HTTP`, `NEO4J_USER`, `NEO4J_PASSWORD`, and `NEO4J_DATABASE`. The API inherits shell variables and does not load `apps/api/.env` itself. For an existing server, configure the pipeline file and both frontend `.env` files consistently; see the [Open Source Guide](../../docs/OPEN_SOURCE_GUIDE.md).

## Choosing the extraction workflow

The web app's **Add documents** workflow uses Gemini, OpenAI, or Anthropic. Source text is sent to the selected hosted provider. Enter its API key in the app, or define the corresponding `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` in the pipeline `.env` or API process environment. An entered key overrides the environment key for that job. Only the selected provider is used. Settings can save provider/key preferences in the browser's local storage.

You can also attach documents to a coding agent with access to this repository. Have that agent save the source and six artifacts in a new `graphs/<collection>/<project>/` folder, validate them, and run `uv run python neo4j/upload.py <project-dir> --create-only` from the pipeline directory. That path uses the assistant already configured in your coding tool and does not require a separate Nitanics extraction API key. See [Ingestion for AI Agents](../../docs/INGESTION_FOR_AGENTS.md).

## API contract

The browser UI calls these endpoints:

- `GET /api/health`: API availability and running job count.
- `POST /api/ingest`: `{ collection, directory, provider, apiKey?, files: [{ name, content }], requestId? }`.
- `POST /api/export`: `{ collection }`.
- `GET /api/status?id=<processId>`: `{ processId, status, logs, exitCode, error, downloadUrl, startedAt, finishedAt }`.
- `GET /api/download?file=<export>.zip`: completed export download.

Start responses return HTTP 202 and `{ processId, status }`. Status is `running`, `success`, or `failed`. A successful export supplies its actual `downloadUrl`; clients should use that URL rather than derive a filename from the collection name.

Ingestion accepts Markdown, UTF-8 text, and PDF documents: up to 20 files, 10 MiB per file, and 25 MiB total decoded content. PDFs use a `data:application/pdf;base64,...` content string. Filenames must be portable basenames, with distinct names and project slugs. The JSON request body limit is 40 MiB. The API runs at most two jobs concurrently and accepts browser origins on localhost only.

The UI can supply a UUID `requestId`, save it before uploading, and restore polling after navigation or refresh. Repeating the same request ID and payload returns the existing job; reusing the ID for a different upload returns HTTP 409. Job status lives in server memory, so restarting the API clears it. Sources and generated graph artifacts survive in `graphs/`.

Provider selection is explicit. The chosen key overrides the provider's environment key, other provider keys are removed from the child process environment, and supplied keys are redacted from returned logs. Logs are bounded to the most recent 512 KiB; only the latest 100 completed jobs are kept.

Bulk ingestion preserves existing projects by giving every uploaded source/chunk a new project ID. It retains source text and completed artifacts on failure, checks quoted relationship evidence against the source, and uploads only after the validation gate passes. It does not synthesize entities, relationships, causal chains, or embedding vectors to pass validation. The gate validates source-grounded artifacts rather than requiring invented facts to reach arbitrary counts. Neo4j upload uses multiple batches, so a database failure after upload begins can leave a partial project; check the logs and artifacts before retrying.

Verification without provider calls or database writes:

```powershell
bun run --cwd apps/api test
bun test apps/web/frontend/tests/store-reliability.test.ts
python -m unittest discover -s apps/ingestion-pipeline/tests -p "test_*.py"
```
