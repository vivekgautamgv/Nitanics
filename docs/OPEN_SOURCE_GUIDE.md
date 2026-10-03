# Open Source Guide

Nitanics runs as a local web workspace backed by Neo4j. You can create graphs with an AI coding agent that has access to this repository, or upload documents through the web app's provider-based extraction workflow.

## Prerequisites

Install these tools before cloning:

| Tool | Version | Purpose |
|------|---------|---------|
| Git | Current | Clone the repository |
| Node.js | 20+ | Local scripts and API |
| Bun | 1.3+ | JavaScript dependencies and development servers |
| uv | Current | Manage the pipeline's Python environment |
| Docker Desktop | Current | Run local Neo4j |

The pipeline pins Python 3.12 in `.python-version`. uv selects that interpreter and can download it when needed. Install uv before running `bun install`: the repository's postinstall runs `uv sync` in `apps/ingestion-pipeline`.

Installer documentation: [Node.js](https://nodejs.org/en/download), [Bun](https://bun.sh/docs/installation), [uv](https://docs.astral.sh/uv/getting-started/installation/), [Docker Desktop](https://docs.docker.com/desktop/).

## Clean-clone setup

Run these commands from a terminal. They work in PowerShell and typical macOS/Linux shells:

```text
git clone https://github.com/vivekgautamgv/nitanics.git
cd nitanics
bun install
```

Before creating Neo4j, choose your own local password and export it in the shell that will run the helper and development servers. Replace the placeholder in the appropriate command:

```powershell
# PowerShell
$env:MT_NEO4J_PASSWORD = 'YOUR_LOCAL_NEO4J_PASSWORD'
```

```bash
# macOS/Linux
export MT_NEO4J_PASSWORD='YOUR_LOCAL_NEO4J_PASSWORD'
```

Then continue from the same terminal:

```text
bun run neo4j:ensure
bun run nlp:setup
bun run dev
```

Start Docker Desktop before `neo4j:ensure`. The script starts or reuses the configured container, creates missing app environment files, verifies the database, and bootstraps its schema. Existing environment files are preserved.

`nlp:setup` prepares the same `apps/ingestion-pipeline/.venv` used by API jobs and `uv run`. It loads the pinned English spaCy model and caches the MiniLM model used for real 384-dimensional embeddings. The first install needs internet and downloads large Python/model dependencies. Model inference runs locally afterward. If you only want to browse existing graph data, you can defer this model check until you create a graph.

Open the web UI URL printed by the development server. [The default main app address](http://127.0.0.1:5174) is for local setup; use the actual host and port in your environment. `bun run dev` starts all three services at these default addresses:

| Service | Default URL |
|---------|-----|
| Web app | `http://127.0.0.1:5174` |
| Standalone Graph Studio | `http://127.0.0.1:5173` |
| Ingestion/export API | `http://127.0.0.1:5176` |

You do not need to run the optional MCP server to use the web app or coding-agent ingestion.

### Optional sample collection

A fresh database is empty. To try the included finance collection, run this from the repository root in another terminal:

```text
node scripts/import-collection-export.mjs apps/exports/global-finance-systems-export
```

Skip sample import if your database already contains the projects you want to use. Refresh the web app after importing.

### Verify the local setup

```text
bun run nlp:setup --check
uv run --directory apps/ingestion-pipeline python neo4j/bootstrap.py --status
```

The first command checks installed models and a real embedding without downloading anything. The second reads schema/data status. In the web app, **Settings → Database** checks its Neo4j connection. Opening `http://127.0.0.1:5176/api/health` checks the local API; it does not check Neo4j or your AI provider key.

## Create a graph with an AI coding agent

This workflow uses the AI assistant already configured in your coding tool. It does not need an additional extraction-provider API key in Nitanics. The assistant must be able to read the attached document, write files in this cloned repository, and run local commands.

Attach a paper/report in that assistant's chat, or place its text at `graphs/<collection>/<project>/source.md`. Then send a prompt such as:

```text
Read AGENTS.md, docs/INGESTION_FOR_AGENTS.md, and the extraction instructions.

Create a new graph project from the attached research paper.
Collection: My Research
New project folder: graphs/my-research/paper-one/

Save a faithful source.md in that folder, then generate all six artifacts there.
Use the local NLP and embedding tools through the pipeline's uv environment.
Preserve uncertainty and quote the source evidence. Do not invent missing facts.
Validate all artifacts, then upload with --create-only.
Preserve existing collections and projects. Recompute metrics after upload.
```

The agent should read a PDF's text, including relevant tables/figures, before extraction. Scanned PDFs need readable OCR text. A chat attachment becomes part of this workspace when the agent saves it as `source.md`; the web app does not read attachments from a separate chat application automatically.

The finished folder contains:

```text
graphs/my-research/paper-one/
  source.md
  01_html.html
  02_placement.json
  03_nlp_entities.json
  04_all_entities.json
  05_embeddings.json
  06_extraction.json
```

The source and artifacts remain reviewable on disk. The agent validates before upload:

```text
cd apps/ingestion-pipeline
uv run python neo4j/validate_project.py ../../graphs/my-research/paper-one
uv run python neo4j/upload.py ../../graphs/my-research/paper-one --create-only
uv run python neo4j/gds.py
cd ../..
```

Use a new project slug for every source; project IDs are global across collections. `--create-only` rejects an existing ID. Do not remove graph data to make an upload pass. See [Ingestion for AI Agents](INGESTION_FOR_AGENTS.md) for the artifact schema and quality gate.

Refresh the workspace, open **My Research**, and explore its entities, source documents, bridge entities, and evidence in Graph Studio.

## Create a graph through the web app

1. Run `bun run nlp:setup` once and keep `bun run dev` running.
2. Open **Add documents**. Select Markdown, UTF-8 text, or text-based PDF files.
3. Choose an existing collection or create a new one, and choose a workspace folder.
4. Select Gemini, OpenAI, or Anthropic. Enter that provider's API key, or use its key from the pipeline environment.
5. Start extraction and follow the progress log. Open the collection after a successful upload.

This workflow sends the source text to the chosen hosted AI provider. Neo4j, source artifacts, and local NLP/embedding computation stay on your machine. The assistant-based workflow above uses your coding tool's own model/account instead.

Provider environment variables are `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY`. You can add the chosen variable to the gitignored `apps/ingestion-pipeline/neo4j/.env`, or set it in the shell used to start the API. An API key entered in the app overrides the environment key for that job. Only the selected provider is used. Settings can save a provider/key in this browser's local storage.

Uploads allow up to 20 files, 10 MiB per file, and 25 MiB total. New projects receive unique IDs and land in `graphs/<collection>/<project>/`; existing collections/projects are preserved. The app restores its job display after navigation or refresh while the API remains running. API restart clears in-memory job status, so inspect saved artifacts and logs before retrying a lost job.

Validation checks structure, entity references, source evidence, and real embeddings. Unsupported facts must not be invented to make a document look denser. Failed jobs retain the source and generated artifacts for review. Uploads use several Neo4j batches, so an error after writing starts can leave a partial project. See the [API guide](../apps/api/README.md).

## Database configuration

The Docker helper uses a pinned Neo4j Community image, persistent volumes, and local database configuration. Choose your own password through `MT_NEO4J_PASSWORD` before first setup; do not rely on legacy fallback credentials in the code. The default database/container names retain `memorytonic` for compatibility. They are repository conventions, not a requirement for an existing server.

See [Docker and Neo4j Setup](../README.md#docker-and-neo4j-setup) for first-run shell overrides, matching environment-file templates, and alignment checks. The helper preserves existing files and container settings: changing `MT_NEO4J_*` alone does not reconfigure an existing container or overwrite app credentials. All consumers must target the same server/database; changing only the web UI connection does not change the pipeline or agent destination.

To configure a different server, keep these files consistent:

| Consumer | File | Variables |
|----------|------|-----------|
| Web app | `apps/web/frontend/.env` | `VITE_NEO4J_URI`, `VITE_NEO4J_USER`, `VITE_NEO4J_PASSWORD`, `VITE_NEO4J_DATABASE` |
| Graph Studio | `apps/web/modules/graph-studio/.env` | Same `VITE_NEO4J_*` variables |
| Python ingestion and API jobs | `apps/ingestion-pipeline/neo4j/.env` | `NEO4J_HTTP`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`; optional provider key |
| Optional MCP server | Client process environment | `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` |

Use the root `.env.example` as a variable reference. It is not automatically loaded by the Docker helper. `MT_NEO4J_*` overrides must be exported in the shell running `neo4j:ensure`; app `.env` files are read by their respective runtimes. Restart the development servers after changing frontend credentials.

The Python pipeline uses Neo4j's HTTP transaction endpoint as well as the browser's Bolt connection. An existing server must expose both and use a database available in that Neo4j edition. `NEO4J_HTTP` is an HTTP(S) base URL, such as `http://127.0.0.1:7474`, rather than a Bolt URI. The local API reads shell variables; it does not load `apps/api/.env` itself.

### Running against an existing server without Docker bootstrap

Configure the frontend, graph, and pipeline files above. Then bootstrap once and launch the three local services in separate terminals, all from the repository root:

```text
uv run --directory apps/ingestion-pipeline python neo4j/bootstrap.py
bun run --cwd apps/web/frontend vite
bun run --cwd apps/web/modules/graph-studio vite
bun run dev:api
```

The direct Vite commands bypass the Docker helper invoked by the normal app `dev` scripts. The API supports these local workflows; hosted deployments/authentication are outside this repository's scope.

## Optional MCP connection

MCP allows a compatible assistant to query your stored graph. Build it first:

```text
bun run build:mcp
```

Configure your MCP client to launch the built stdio server, using an absolute repository path and credentials for the same database:

```json
{
  "mcpServers": {
    "nitanics": {
      "command": "node",
      "args": ["/absolute/path/to/nitanics/apps/mcp/dist/index.js"],
      "env": {
        "NEO4J_URI": "neo4j://127.0.0.1:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "YOUR_LOCAL_NEO4J_PASSWORD",
        "NEO4J_DATABASE": "memorytonic"
      }
    }
  }
}
```

`bun run dev:mcp` compiles and runs the stdio server; `bun run --cwd apps/mcp watch` only watches TypeScript. For normal use, the configured client launches the built server itself. If you need the bundled `apps/mcp/bundle/index.mjs`, create it explicitly with `bun run --cwd apps/mcp bundle`; the normal build produces `dist/index.js`. See the [MCP guide](../apps/mcp/README.md) for tool scope, client setup, and legacy artifact locations.

## Troubleshooting and checks

| Symptom | Check |
|---------|-------|
| `bun install` cannot find uv | Install uv, reopen the terminal, verify `uv --version`, and rerun `bun install`. |
| NLP model missing | Run `bun run nlp:setup`, then `bun run nlp:setup --check`. Use the pipeline's uv environment for NLP commands. |
| API cannot start a job | Check `uv` is on the API process's PATH and read the job's error/logs. |
| Selected provider has no key | Configure the matching key in the app, pipeline `.env`, or API shell. A different provider's key is not used. |
| PDF has no readable text | Supply OCR output or an accessible Markdown/text copy. |
| Neo4j connection fails | Run `docker ps`, verify the container and database, and compare app credentials with the server. |
| Workspace is empty | Import the optional sample collection or upload a validated project. |
| API restart loses job status | Inspect `graphs/` and database state before retrying; saved artifacts remain. |

Do not use the legacy `scripts/setup.sh` as a routine install or repair command: it removes dependency directories, lockfiles, and build output. The clean-clone commands above keep the repository lockfiles.

Build verification from the repository root:

```text
bun run build
bun run build:mcp
bun run build:api
```
