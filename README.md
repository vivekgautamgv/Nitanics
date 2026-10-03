<<<<<<< HEAD
=======

>>>>>>> f139419e918c828d3f1672e97139c2ee542ddeb0
# Nitanics — Local knowledge graphs for documents and research

An open-source web workspace for turning papers, reports, and notes into connected research. Upload documents in the UI with an extraction API key, or open the cloned repository in an AI coding agent and attach your documents in its chat. Both routes save to the same local Neo4j database and appear in Graph Studio.

<<<<<<< HEAD
Explore entities, relationships, shared concepts, and source evidence across your documents. Use the original sources to verify generated claims: extraction can miss or misinterpret information.

Compatible AI clients can retrieve relevant graph context through the optional MCP server. This can reduce repeated source reading; the effect on context size and cost depends on the workload.
=======
Store massive chat histories or hundreds of research documents in a single, living knowledge graph. When you query an LLM, standard RAG systems force the AI to blindly re-read all 100 documents, burning through tokens and context limits. Nitanics Labs solves the context window problem by fetching only the exact graph entities and relationships relevant to your query. 

>>>>>>> f139419e918c828d3f1672e97139c2ee542ddeb0

## Two Ways to Create a Graph

| Workflow | What you provide | What happens |
|---|---|---|
| **Web UI + API** | Complete Markdown, text, or text-based PDF files and Gemini, OpenAI, or Anthropic API access | **Add documents → Upload with API** runs extraction, local NLP and embeddings, validation, and upload. Progress and failures appear in the UI. |
| **Local AI coding agent** | This cloned repository and documents attached to the agent chat, or local document paths | Claude Code, Codex, or another coding agent reads the sources, creates artifacts with its own model and local tools, validates them, and uploads to Neo4j. **Add documents → Use AI agent** provides a customized prompt to copy. |

The agent route requires repository access, command execution, and access to the configured Neo4j database. It needs no separate Nitanics extraction API key; your agent still needs its own model access. A hosted chat needs connected tools to update a local workspace. The optional MCP server provides graph tools for compatible local clients.

## Features

| Feature | What you can do |
|---|---|
| **Research dashboard** | See unique document and entity totals, search collection names and descriptions, filter by workspace, sort collections, and refresh results. |
| **Documents and source reader** | Search document titles, domains, and tags; inspect findings and relationship evidence; open the saved source to check its context. Missing sources have explicit recovery or error states. |
| **Graph Studio** | Switch between Collection, Document, and Bridges scopes. Document mode isolates one source. Search and filter the loaded graph, fit the view, use full screen, and open responsive inspector panels. |
| **Bridges** | Find entities shared by multiple documents in a collection and follow their connections back to the sources. |
| **Path Finder** | Explore shortest undirected paths within the loaded graph, up to eight hops. Use semantic relationships by default or include document membership connections. |
| **Entity Inspector and Chains** | Inspect entity definitions, roles, relationships, project evidence, and extracted reasoning chains. Connections shared by several projects retain their evidence. |
| **Document ingestion** | Add complete files to an existing or new collection, track extraction stages, resume progress after navigation or reload, and inspect failed jobs. |
| **Portable exports** | Download a collection ZIP containing graph data, embeddings, and available source artifacts. Its manifest records missing source files. Import the included sample export to explore a populated workspace. |
| **Optional MCP** | Let compatible AI clients query graph context, submit structured extractions, and use collection and maintenance tools through a local stdio server. |

Shared mentions do not establish that two papers agree. Graph paths are exploratory connections; they do not prove causality. Verify extracted chains and relationship claims against their source evidence.

## Research Workflow

1. Create a collection for a research question and add the relevant papers and reports.
2. Open **Documents** to find sources and read their findings alongside the original text.
3. Open **Bridges** to compare recurring concepts, organizations, methods, or people across sources.
4. Use **Graph** and **Path Finder** to investigate connections, then inspect the supporting project evidence.
5. Add more documents as the research grows and export the collection for backup or sharing.

The same workflow can organize technical documentation, market reports, and personal research notes. See the [Research workflow guide](docs/RESEARCH_WORKFLOW.md) for a detailed walkthrough.

## Quick Start

Install Git, **Bun 1.3+**, **Node.js 20+**, **uv**, and **Docker Desktop**. Start Docker Desktop before running the Neo4j helper. The pipeline pins Python **3.12**; uv can install that interpreter. Initial dependency and model downloads need internet access.

```bash
git clone https://github.com/vivekgautamgv/nitanics.git
cd nitanics
bun install
```

Choose a password for your own local Neo4j instance. Set it in the same terminal using the command for your shell, replacing the placeholder:

```powershell
# PowerShell
$env:MT_NEO4J_PASSWORD = 'YOUR_LOCAL_NEO4J_PASSWORD'
```

```bash
# macOS/Linux
export MT_NEO4J_PASSWORD='YOUR_LOCAL_NEO4J_PASSWORD'
```

Then start the workspace from that terminal:

```bash
bun run nlp:setup
bun run neo4j:ensure
bun run dev
```

Open the web UI URL printed by the development server. 

`bun install` also installs the Python dependencies through uv. `nlp:setup` checks the English spaCy model and caches the MiniLM embedding model in the pipeline environment. After setup, NLP and embeddings run locally. Use `bun run nlp:setup --check` to verify local readiness without downloads or dependency changes.

`bun run dev` starts the web UI on **5174**, Graph Studio on **5173**, and the local ingestion/export API on **5176** by default. These are application ports; Neo4j has separate database ports. Use the setup instructions below to keep every component connected to the same database.

Optionally import the included sample collection:

```bash
node scripts/import-collection-export.mjs apps/exports/global-finance-systems-export
```

## Docker and Neo4j Setup

The web UI, ingestion pipeline, coding agent, and optional MCP client must connect to the same Neo4j server and database. Loopback addresses such as `localhost` refer to the machine running the workspace. Examples in this guide are configuration templates; replace placeholders with your own values.

### Fresh clone: let the helper configure the local database

1. Install and open Docker Desktop. Run `docker info` to confirm the Docker engine is reachable.
2. Follow Quick Start, including setting your own password before the first helper run. `bun run neo4j:ensure` pulls the Neo4j image when needed, creates or starts its container with persistent Docker volumes, enables APOC/GDS plugins, waits for the database, and runs an idempotent schema bootstrap.
3. The helper creates missing application `.env` files with matching connection settings. Existing files are preserved, so an older configuration must be reviewed rather than assumed to match.
4. Start the app with `bun run dev`, then check the database connection before adding documents.

This route runs Neo4j inside Docker; no separate Neo4j Desktop installation is needed.

The helper coordinates the local container, database, and missing app configuration files. Keep your chosen `MT_NEO4J_PASSWORD` set in the shell used for `bun run dev`, since the development scripts also run the helper. Do not rely on the legacy fallback password in the code.

For custom container names, database names, or occupied ports, see [.env.example](.env.example) and the [database configuration guide](docs/OPEN_SOURCE_GUIDE.md#database-configuration). Export helper overrides in your shell; a root `.env` is not loaded by the helper. Changing overrides does not rotate an existing database password, change container port mappings, or overwrite existing application `.env` files. Use the existing-server instructions for an established setup.

### Existing Neo4j: align the app, pipeline, and agent

If Neo4j already runs in Docker, Neo4j Desktop, or a service, use that server's host, exposed ports, credentials, and existing database. This route does not require creating another container.

| Consumer | Configuration | Required variables |
|---|---|---|
| Main web UI | `apps/web/frontend/.env` | `VITE_NEO4J_URI`, `VITE_NEO4J_USER`, `VITE_NEO4J_PASSWORD`, `VITE_NEO4J_DATABASE` |
| Graph Studio | `apps/web/modules/graph-studio/.env` | Same `VITE_NEO4J_*` variables |
| Python pipeline, API jobs, and repository-agent uploads | `apps/ingestion-pipeline/neo4j/.env` | `NEO4J_HTTP`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` |
| Optional MCP | MCP client's process environment | `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` |

For both frontend files, use this template with your own values:

```dotenv
VITE_NEO4J_URI=bolt://YOUR_NEO4J_HOST:YOUR_BOLT_PORT
VITE_NEO4J_USER=YOUR_NEO4J_USER
VITE_NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD
VITE_NEO4J_DATABASE=YOUR_EXISTING_DATABASE
```

For the pipeline file:

```dotenv
NEO4J_HTTP=http://YOUR_NEO4J_HOST:YOUR_HTTP_PORT
NEO4J_USER=YOUR_NEO4J_USER
NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD
NEO4J_DATABASE=YOUR_EXISTING_DATABASE
```

Use the same server and database in both templates. Bolt and HTTP addresses use different protocols and ports; the pipeline needs an accessible HTTP transaction endpoint. Use the server's actual TLS scheme when required. Confirm the database exists in your Neo4j edition, and enable the APOC/GDS plugins used by the graph workflow. Use the existing database's real name rather than assuming a name from an example.

Shell `NEO4J_*` variables override the pipeline file, so check the environment inherited by the API and coding agent too. The API does not load `apps/api/.env`, and MCP credentials should be supplied explicitly in the client configuration. Changing only the UI connection does not update the ingestion destination.

Run schema bootstrap once, then launch these services in **three separate terminals** from the repository root:

```text
# Bootstrap once; preserves existing graph data
uv run --directory apps/ingestion-pipeline python neo4j/bootstrap.py

# Terminal 1
bun run --cwd apps/web/frontend vite

# Terminal 2
bun run --cwd apps/web/modules/graph-studio vite

# Terminal 3
bun run dev:api
```

The direct Vite commands bypass the Docker helper in the normal `dev` scripts. Restart services after editing configuration, and open the actual web UI URL printed by the server. Never use `bootstrap.py --clean` for setup or ingestion. See the [Open Source Guide](docs/OPEN_SOURCE_GUIDE.md#database-configuration) for additional configuration details.

### Verify alignment before uploading

```text
bun run nlp:setup --check
uv run --directory apps/ingestion-pipeline python neo4j/bootstrap.py --status
```

The status command reads database counts and schema state. In **Settings → Database**, verify that the web UI connects to the same server and database. Open Graph Studio and check that existing collections match. An empty fresh database is expected until sample import or document ingestion. The local API's `/api/health` endpoint checks the API process, not its Neo4j connection.

Have the coding agent verify its configured database with read-only queries before ingestion. After upload, report the target collection, new project IDs, graph counts, and the actual running web UI URL. If upload succeeds but the UI is empty, compare the database name, credentials, and endpoints across the components before uploading again.

## Add Your Own Documents

### Upload through the UI

1. Open **Add documents → Upload with API**.
2. Select complete `.md`, UTF-8 `.txt`, or text-based `.pdf` files. Each batch supports **20 files**, **10 MiB per file**, and **25 MiB total**. Use distinct filenames. Scanned PDFs need OCR first.
3. Choose the collection and workspace folder, then select Gemini, OpenAI, or Anthropic and enter its API key. A blank key uses that provider's configured environment key.
4. Start extraction and follow its progress. After a successful upload, choose **View collection** to explore Documents, Graph, Bridges, and source evidence.

PDF ingestion extracts text in page order; it does not interpret page images or figures. Long sources are processed in parts, with a default chunk size of 30,000 characters. A single upload can therefore create multiple projects.

The UI remembers job identity and destination so progress can resume after navigation or reload while the API process remains running. It does not save document contents or API keys in that resume record. Restarting the API clears job status; saved source files and generated artifacts remain on disk.

### Attach documents in your agent's chat

1. Open the cloned repository in your coding agent and attach the complete documents in its chat. If the agent cannot access an attachment, save it locally and provide its path.
2. Copy the customized prompt from **Add documents → Use AI agent**, or paste this prompt:

```text
You are working in the Nitanics repository.
Read README.md, docs/ARCHITECTURE.md, docs/INGESTION_FOR_AGENTS.md, and CLAUDE.md.
Read the complete contents of all documents attached to this chat or at these paths: <paths>.
Collection: <collection name>
Workspace directory: Research
Before ingestion, verify that the pipeline and web UI target the same Neo4j server/database using the setup guide and read-only queries. Report configuration mismatches without exposing passwords.
Create one new globally unique project per document under graphs/; preserve existing data.
Save each complete source.md and all six artifacts.
Use your own model for semantic extraction and the local NLP/embedding tools.
Extract only source-supported facts; do not invent quotas or causal chains.
Validate every project and upload only passing projects with --create-only.
Report unreadable documents, failed stages, and the collection/project IDs to open in the UI.
After upload, verify the new projects and graph counts with read-only queries.
Report the actual Nitanics web UI URL from the running environment; do not assume a default host or port.
If the UI is not running or its URL cannot be confirmed, provide the startup command instead of guessing.
```

3. Return to the UI, refresh collections, and open the target collection. Dashboard and graph views also refresh when you return focus to the app.

The [Ingestion for AI Agents guide](docs/INGESTION_FOR_AGENTS.md) covers complete source reading, PDF handling, artifact schemas, local NLP, real embeddings, validation, and upload commands.

## How Data Is Stored and Validated

```text
UI upload + provider API ─┐
                         ├→ source + artifacts → validation → Neo4j → web UI
Agent chat + local repo ─┘
```

New UI and repository-agent projects keep source text and **six artifacts: one HTML file and five JSON files** under `graphs/<collection>/<unique-project>/`:

| File | Purpose |
|---|---|
| `source.md` | Complete source text |
| `01_html.html` | Readable source document |
| `02_placement.json` | Workspace, collection, and unique project metadata |
| `03_nlp_entities.json` | Actual local NLP candidates and co-occurrences |
| `04_all_entities.json` | Source-supported entities, aliases, definitions, and roles |
| `05_embeddings.json` | Local model embeddings for every entity and the project |
| `06_extraction.json` | Summary, supported relationships, and optional causal chains |

Validation checks artifact structure, metadata, entity references, source evidence quotes, and complete finite 384-dimensional embeddings. At least one supported entity is required; relationships, phases, and chains can be empty. There are no graph-density quotas or placeholder vectors. Quote matching checks presence in the source; reviewing whether a quote supports a claim remains necessary.

Uploads run only after validation passes and use unique project IDs with `--create-only`. Existing projects and legacy artifacts are preserved. A database failure during a multi-stage upload can leave partial data, and a failed batch can include successfully uploaded documents. Inspect the logs, artifacts, and database state before retrying.

## Local API and Optional MCP

The loopback API handles ingestion jobs, progress, and collection exports. It supports request IDs to reconnect to existing jobs, limits concurrent jobs, and reports extraction or process failures. See the [API guide](apps/api/README.md) for endpoints, provider environment variables, limits, and status handling.

The optional MCP server exposes **30 tools over stdio** for compatible local AI clients:

```bash
bun run build:mcp
bun run start:mcp
```

Configure your client to launch the compiled entry point with an absolute path and the same Neo4j credentials. MCP extraction accepts structured data prepared by the client's model; it does not upload binary chat attachments. Its legacy artifact storage differs from the canonical six-artifact `graphs/` workflow. See the [MCP guide](apps/mcp/README.md) for configuration and tool behavior.

## Privacy and Scope

Graph storage, the web workspace, NLP, and embeddings run on your machine. UI extraction sends source text to the selected hosted provider; agent attachments are handled by your chosen agent service. Settings can save provider keys in browser local storage. Collection exports can include source content, so review them before sharing.

Keep credentials in local configuration and exclude them from commits, screenshots, prompts, and shared exports. Local `.env` files are ignored by Git; `.env.example` contains templates only. Source files under `graphs/` are not ignored automatically, so review staged files before publishing private research.

The browser connects directly to Neo4j. `VITE_*` connection credentials are available to the browser and included in frontend builds; they are not server-side secrets. Use a private local workspace and trusted device. Do not publish a frontend build containing private database credentials or expose this development setup as a public service.

Nitanics currently targets a local research workspace. Hosted multi-user authentication, billing, and Electron desktop packaging are outside this version's scope.

## Repository Structure

```text
nitanics/
├── graphs/                         # Canonical source and artifact projects
├── apps/
│   ├── web/
│   │   ├── frontend/               # Main React web app
│   │   └── modules/graph-studio/    # Interactive graph workspace
│   ├── api/                        # Local ingestion, progress, and exports
│   ├── ingestion-pipeline/         # Python extraction, validation, and upload
│   ├── mcp/                        # Optional local MCP server
│   └── exports/                    # Portable sample collection exports
├── docs/                           # Setup, architecture, and workflow guides
└── scripts/
    ├── ensure-neo4j.mjs             # Neo4j Docker bootstrap
    ├── setup-nlp.mjs                # Local model setup and readiness checks
    └── import-collection-export.mjs # Import a portable export
```

## Core Commands

```bash
bun run dev               # Start frontend, Graph Studio, and local API
bun run neo4j:ensure      # Start or verify local Neo4j
bun run nlp:setup         # Install/check local NLP and embedding models
bun run nlp:setup --check # Check local models without downloads
bun run build             # Build frontend and Graph Studio
bun run build:api         # Check and build the local API
bun run build:mcp         # Compile the optional MCP server
bun run start:mcp         # Run the compiled MCP server
bun run dev:mcp           # Compile and run MCP for development
```

For ingestion code changes, run `uv run python -m unittest discover -s tests` from `apps/ingestion-pipeline`. The [Research workflow guide](docs/RESEARCH_WORKFLOW.md#verification) lists the API, UI, graph, setup, and MCP checks.

## Documentation

| Guide | Purpose |
|---|---|
| [Open Source Guide](docs/OPEN_SOURCE_GUIDE.md) | Clone, install, configure Neo4j, seed, and run |
| [Research Workflow](docs/RESEARCH_WORKFLOW.md) | Explore papers, reports, source evidence, and exports |
| [Architecture](docs/ARCHITECTURE.md) | Application layers and graph model |
| [Ingestion for AI Agents](docs/INGESTION_FOR_AGENTS.md) | Clone-and-chat workflow and exact artifact/upload commands |
| [Graph Workspace](graphs/README.md) | Canonical project folder convention |
| [Ingestion Pipeline](apps/ingestion-pipeline/README.md) | Python pipeline internals |
| [Local API](apps/api/README.md) | Ingestion/export endpoints and job lifecycle |
| [Optional MCP](apps/mcp/README.md) | Client setup, tools, and integration limits |

<<<<<<< HEAD
=======
## Screenshots

<details>
<summary>Earlier UI screenshots</summary>

These screenshots show an earlier version. The current UI uses Nitanics branding and the research and ingestion workflows described above.

![Main Screen](docs/assets/Main%20Screen.png)
![Main Info Dashboard](docs/assets/Main%20Info%20dashboard.png)
![Dashboard Graph](docs/assets/Dashboard%20View%20-%20Graph.png)
![Graph Inspector](docs/assets/Graph%20View%20-%20Side%20bar%20details.png)

</details>


>>>>>>> f139419e918c828d3f1672e97139c2ee542ddeb0
## License

MIT — see [LICENSE](LICENSE).
