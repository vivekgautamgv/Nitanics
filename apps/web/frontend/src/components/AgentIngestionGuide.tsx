import { useState } from 'react'
import { useDirectoryStore } from '../stores/directory-store'
import { useNavigationStore } from '../stores/navigation-store'

export default function AgentIngestionGuide() {
  const [collection, setCollection] = useState('Research library')
  const [directory, setDirectory] = useState('Research')
  const [copyStatus, setCopyStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState('')
  const navigate = useNavigationStore(s => s.navigate)
  const loadDirectories = useDirectoryStore(s => s.loadDirectories)
  const loadCollections = useDirectoryStore(s => s.loadAllCollections)
  const destinationReady = Boolean(collection.trim() && directory.trim())
  const prompt = `You are working in my local Nitanics repository.
Read AGENTS.md, CLAUDE.md, and docs/INGESTION_FOR_AGENTS.md first.

Use all the documents attached to this chat. Read their complete contents, not only a preview or summary. If an attachment is inaccessible, tell me which file needs a local path before continuing with it.
Destination: ${JSON.stringify({ collection: collection.trim(), directory: directory.trim() })}

Before ingestion, follow the repository setup guide and verify that the pipeline and web UI target the same Neo4j server and database using read-only queries. Report configuration mismatches without exposing passwords.
Save each complete source in a new, uniquely named project under graphs/. Preserve original files and readable source text. Follow the agent ingestion guide to generate all six artifacts with local NLP and real embeddings. Use your current agent model for semantic extraction; do not call a separate extraction provider.
Extract source-supported entities and connections with exact evidence quotes. Do not invent facts or causal chains to meet a quota. Reuse clearly matching entities across documents so their shared connections appear in Bridges.
Validate each project before upload. Upload with create-only protection to the configured local Neo4j database. Preserve every existing collection and project. Report any failed documents and their saved artifact paths.
After upload, verify the new projects and graph counts with read-only queries. Report the collection name, project IDs, verified counts, and the actual Nitanics web UI URL from the running environment so I can inspect documents, source evidence, and the graph. Use the configured host and port; do not assume a default address. If the UI is not running or its URL cannot be confirmed, say so and provide the startup command instead of guessing.`

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyStatus('Prompt copied. Paste it into your agent chat with the documents attached.')
    } catch {
      setCopyStatus('Select the prompt below and copy it manually. Clipboard access is unavailable.')
    }
  }

  const refreshCollections = async () => {
    if (refreshing) return
    setRefreshing(true)
    setRefreshStatus('')
    try {
      await Promise.all([loadDirectories(), loadCollections()])
      const error = useDirectoryStore.getState().error
      setRefreshStatus(error ? `Unable to refresh: ${error}` : 'Collections refreshed. Open Home to explore your new research.')
    } catch {
      setRefreshStatus('Unable to refresh collections. Check the database connection in Settings, then try again.')
    } finally { setRefreshing(false) }
  }

  return (
    <section className="card agent-ingestion-guide" aria-label="AI agent workflow">
      <div className="agent-guide-heading"><span className="workspace-eyebrow">Your agent, your local graph</span><h2>Attach documents in your agent chat</h2></div>
      <p>Open this cloned repository in Claude Code, Codex, or another coding agent that can read files and run commands. The agent writes to the same Neo4j graph that you explore here.</p>
      <ol className="agent-workflow-steps">
        <li><strong>Open the repository.</strong> Start Docker, Neo4j, and the web app using the setup guide.</li>
        <li><strong>Attach your full documents.</strong> Add papers or reports to the agent chat, or give their local file paths. Scanned PDFs need OCR.</li>
        <li><strong>Paste the prompt.</strong> Your agent creates and validates a project for each source, then adds it to Neo4j.</li>
        <li><strong>Explore the result.</strong> Refresh collections here, then open Documents, Graph, or Bridges.</li>
      </ol>
      <div className="agent-destination-fields">
        <label className="form-field"><span>Collection name</span><input type="text" maxLength={200} value={collection} onChange={e => { setCollection(e.target.value); setCopyStatus('') }} /></label>
        <label className="form-field"><span>Workspace folder</span><input type="text" maxLength={200} value={directory} onChange={e => { setDirectory(e.target.value); setCopyStatus('') }} /></label>
      </div>
      <div className="agent-prompt-heading"><label htmlFor="agent-ingestion-prompt">Prompt for your agent</label><button type="button" className="btn btn-primary btn-sm" disabled={!destinationReady} onClick={copyPrompt}>Copy prompt</button></div>
      <textarea id="agent-ingestion-prompt" className="agent-prompt" readOnly value={prompt} spellCheck={false} />
      {copyStatus && <p className="agent-guide-status" role="status">{copyStatus}</p>}
      <p className="agent-guide-note">This route uses your agent's model for extraction. A separate extraction API key is needed for the Upload with API route. A remote chat needs tools connected to this repository and Neo4j to publish a graph locally.</p>
      <p className="agent-guide-note">Repository guides: <code>docs/OPEN_SOURCE_GUIDE.md</code> and <code>docs/INGESTION_FOR_AGENTS.md</code>.</p>
      <div className="agent-guide-actions"><button type="button" className="btn btn-secondary" disabled={refreshing} onClick={refreshCollections}>{refreshing ? 'Refreshing…' : 'Refresh collections'}</button><button type="button" className="btn btn-secondary" onClick={() => navigate({ page: 'home' })}>Open research workspace</button></div>
      {refreshStatus && <p className="agent-guide-status" role="status">{refreshStatus}</p>}
    </section>
  )
}
