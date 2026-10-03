import React, { useState, useEffect, useRef } from 'react'
import { useDirectoryStore } from '../stores/directory-store'
import { useNavigationStore } from '../stores/navigation-store'
import Stepper from '../components/ui/Stepper'
import AgentIngestionGuide from '../components/AgentIngestionGuide'
import {
  INGESTION_API_URL, INGESTION_JOB_KEY, clearIngestionJob, collectUploadDocuments,
  loadIngestionJob, parseIngestionJob, saveIngestionJob, watchIngestionJob,
  type IngestionJob, type UploadDocument,
} from '../services/ingestion'

const STEPS = ['Upload', 'Destination', 'Extraction', 'Progress']

export default function IngestPage() {
  const { allCollections, directories, loadDirectories, loadAllCollections } = useDirectoryStore()
  const navigate = useNavigationStore(s => s.navigate)

  const [initialJob] = useState(loadIngestionJob)
  const [step, setStep] = useState(initialJob ? 4 : 1)
  const [method, setMethod] = useState<'api' | 'agent'>('api')
  const [files, setFiles] = useState<UploadDocument[]>([])
  const [collectionOption, setCollectionOption] = useState<'existing' | 'new'>('existing')
  const [selectedCollection, setSelectedCollection] = useState('')
  const [newCollectionName, setNewCollectionName] = useState('')
  const [selectedDirectory, setSelectedDirectory] = useState('Research')
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini')
  const [apiKey, setApiKey] = useState('')

  const [job, setJob] = useState<IngestionJob | null>(initialJob)
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>(initialJob ? 'running' : 'idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [logs, setLogs] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [connectionNotice, setConnectionNotice] = useState('')
  const [storageNotice, setStorageNotice] = useState('')
  const [pollVersion, setPollVersion] = useState(0)

  const logConsoleRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readingRef = useRef(false)
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    loadDirectories()
    loadAllCollections()
    try {
      const savedProvider = localStorage.getItem('nexari_api_provider') || localStorage.getItem('nitanics_api_provider')
      const savedKey = localStorage.getItem('nexari_api_key') || localStorage.getItem('nitanics_api_key')
      if (savedProvider === 'gemini' || savedProvider === 'openai' || savedProvider === 'anthropic') setApiProvider(savedProvider)
      if (savedKey) setApiKey(savedKey)
    } catch { /* Use this session's settings if browser storage is disabled. */ }
  }, [loadDirectories, loadAllCollections])

  useEffect(() => {
    if (directories.length && !directories.some(directory => directory.name === selectedDirectory)) {
      setSelectedDirectory(directories[0].name)
    }
  }, [directories, selectedDirectory])

  useEffect(() => {
    const resumeJob = (event: StorageEvent) => {
      if (event.key !== INGESTION_JOB_KEY || status === 'running') return
      const savedJob = parseIngestionJob(event.newValue)
      if (savedJob) {
        setJob(savedJob)
        setStatus('running')
        setErrorMsg('')
        setStep(4)
      }
    }
    window.addEventListener('storage', resumeJob)
    return () => window.removeEventListener('storage', resumeJob)
  }, [status])

  useEffect(() => {
    if (logConsoleRef.current) {
      logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    if (!job || status !== 'running') return
    return watchIngestionJob(job, {
      onUpdate: data => {
        setLogs(data.logs)
        setConnectionNotice('')
        if (data.status === 'running') return
        setStatus(data.status)
        if (data.status === 'success') {
          loadDirectories()
          loadAllCollections()
        } else {
          setErrorMsg(data.error || 'Extraction did not finish. Review the pipeline output below, check the selected provider and API key, then try again.')
        }
      },
      onRetry: setConnectionNotice,
      onUnavailable: message => {
        setErrorMsg(message)
        setConnectionNotice('')
        setStatus('failed')
      },
    })
  }, [job, status, pollVersion, loadDirectories, loadAllCollections])

  const processFiles = async (fileList: FileList) => {
    if (readingRef.current || status !== 'idle') return
    readingRef.current = true
    setIsReading(true)
    setUploadErrors([])
    try {
      const result = await collectUploadDocuments(Array.from(fileList), files)
      if (!mountedRef.current) return
      setFiles(previous => [...previous, ...result.documents])
      setUploadErrors(result.errors)
    } catch {
      if (mountedRef.current) setUploadErrors(['Unable to read the selected documents. Select them again.'])
    } finally {
      readingRef.current = false
      if (mountedRef.current) setIsReading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void processFiles(e.target.files)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) void processFiles(e.dataTransfer.files)
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const activeCollectionName = collectionOption === 'existing' ? selectedCollection : newCollectionName.trim()

  const handleStartIngest = async () => {
    if (submittingRef.current || status === 'running' || readingRef.current) return
    setErrorMsg('')
    const collection = activeCollectionName
    if (!collection) {
      setErrorMsg('Please specify or select a target collection.')
      return
    }
    if (files.length === 0) {
      setErrorMsg('Please upload at least one document.')
      return
    }

    const savedJob = loadIngestionJob()
    if (savedJob) {
      setJob(savedJob)
      setStatus('running')
      setStep(4)
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    try {
      localStorage.setItem('nexari_api_provider', apiProvider)
      localStorage.setItem('nexari_api_key', apiKey)
    } catch { /* Credentials remain available for this request. */ }

    const submittedJob: IngestionJob = {
      processId: crypto.randomUUID(), collection, directory: selectedDirectory,
      fileNames: files.map(file => file.name), startedAt: Date.now(),
    }
    if (!saveIngestionJob(submittedJob)) {
      setStorageNotice('Browser storage is unavailable. Keep this tab open to retain access to extraction progress.')
    }

    setStep(4)
    setJob(submittedJob)
    setStatus('running')
    setConnectionNotice('')
    setLogs('[UI] Preparing files for upload...\n')

    const controller = new AbortController()
    const requestTimeout = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(`${INGESTION_API_URL}/api/ingest`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection,
          directory: selectedDirectory,
          provider: apiProvider,
          apiKey: apiKey.trim() || undefined,
          requestId: submittedJob.processId,
          files: files.map(f => ({ name: f.name, content: f.content })),
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        clearIngestionJob()
        if (mountedRef.current) {
          setJob(null)
          setErrorMsg(typeof data?.error === 'string' ? data.error : `The ingestion service could not accept the documents (${res.status}). Check that the API server is running, then try again.`)
          setStatus('failed')
        }
        return
      }
      if (data?.processId !== submittedJob.processId) {
        throw new Error('The ingestion service did not return the submitted job ID. Restart the API server to load the latest version.')
      }
    } catch (err: unknown) {
      // The service may have accepted the request even if its response was lost.
      // Continue polling the saved request ID instead of starting another job.
      if (mountedRef.current) {
        setConnectionNotice(err instanceof Error && err.message.includes('latest version')
          ? err.message
          : 'The upload response was interrupted. Checking whether the service accepted this extraction...')
      }
    } finally {
      clearTimeout(requestTimeout)
      submittingRef.current = false
      if (mountedRef.current) setIsSubmitting(false)
    }
  }

  const resetPipeline = () => {
    setFiles([])
    clearIngestionJob()
    setJob(null)
    setStatus('idle')
    setLogs('')
    setErrorMsg('')
    setConnectionNotice('')
    setStorageNotice('')
    setUploadErrors([])
    setStep(1)
  }

  const reviewSetup = () => {
    clearIngestionJob()
    setJob(null)
    setStatus('idle')
    setConnectionNotice('')
    setStep(3)
  }

  const canAdvanceFromUpload = files.length > 0 && !isReading
  const canAdvanceFromDestination = activeCollectionName.length > 0

  const displayStep = status !== 'idle' ? 4 : step

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Add documents</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Use an API provider here or attach documents in your coding agent's chat. Both routes build the same local knowledge graph.
        </p>
      </header>

      {displayStep === 1 && status === 'idle' && <fieldset className="ingestion-methods">
        <legend>Choose how to create your graph</legend>
        <label className={`ingestion-method ${method === 'api' ? 'ingestion-method-active' : ''}`}><input type="radio" name="ingestion-method" checked={method === 'api'} onChange={() => setMethod('api')} /><span><strong>Upload with API</strong><span>Upload files here and use a provider API key.</span></span></label>
        <label className={`ingestion-method ${method === 'agent' ? 'ingestion-method-active' : ''}`}><input type="radio" name="ingestion-method" checked={method === 'agent'} onChange={() => setMethod('agent')} /><span><strong>Use AI agent</strong><span>Attach files in your agent chat with this repo open.</span></span></label>
      </fieldset>}

      {method === 'agent' && displayStep === 1 && status === 'idle' ? <AgentIngestionGuide /> : <>
      <Stepper steps={STEPS} current={displayStep} />

      {displayStep === 1 && status === 'idle' && (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <input ref={fileInputRef} id="file-upload-input" type="file" multiple accept=".txt,.md,.pdf" onChange={handleFileChange} disabled={isReading} style={{ display: 'none' }} />
          <div
            className="ingest-dropzone"
            role="button"
            tabIndex={0}
            aria-label="Choose documents to upload"
            aria-busy={isReading}
            aria-disabled={isReading}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !isReading && fileInputRef.current?.click()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (!isReading) fileInputRef.current?.click()
              }
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{isReading ? 'Reading documents...' : 'Drag and drop files or browse'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Markdown (.md), text (.txt), PDF (.pdf)</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Up to 20 documents · 10 MB per file · 25 MB total</div>
          </div>

          {uploadErrors.length > 0 && (
            <div className="form-error" role="alert" style={{ marginTop: 12 }}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{uploadErrors.map(message => <li key={message}>{message}</li>)}</ul>
            </div>
          )}

          {files.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </div>
              <ul className="ingest-file-list">
                {files.map((file, i) => (
                  <li key={file.name} className="ingest-file-item">
                    <span>{file.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(file.size / 1024).toFixed(1)} KB</span>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isReading} aria-label={`Remove ${file.name}`} onClick={() => handleRemoveFile(i)}>Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-primary" disabled={!canAdvanceFromUpload} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {displayStep === 2 && status === 'idle' && (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <div className="ingest-segment" style={{ marginBottom: 16 }}>
            <button type="button" className={collectionOption === 'existing' ? 'active' : ''} onClick={() => setCollectionOption('existing')}>Existing collection</button>
            <button type="button" className={collectionOption === 'new' ? 'active' : ''} onClick={() => setCollectionOption('new')}>New collection</button>
          </div>

          {collectionOption === 'existing' ? (
            <label className="form-field">
              <span>Collection</span>
              <select value={selectedCollection} onChange={e => {
                setSelectedCollection(e.target.value)
                const directory = allCollections.find(collection => collection.name === e.target.value)?.directory
                if (directory) setSelectedDirectory(directory)
              }}>
                <option value="">Choose collection</option>
                {allCollections.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="form-field">
              <span>New collection name</span>
              <input type="text" maxLength={200} placeholder="e.g. Finance Research" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} />
            </label>
          )}

          <label className="form-field" style={{ marginTop: 12 }}>
            <span>Workspace folder</span>
            <select value={selectedDirectory} onChange={e => setSelectedDirectory(e.target.value)}>
              {directories.length === 0 && <option value="Research">Research</option>}
              {directories.map(d => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="btn btn-primary" disabled={!canAdvanceFromDestination} onClick={() => setStep(3)}>Continue</button>
          </div>
        </div>
      )}

      {displayStep === 3 && status === 'idle' && (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{files.length} document{files.length !== 1 ? 's' : ''} → {activeCollectionName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Workspace folder: {selectedDirectory}. Extraction adds projects to your collection.</div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Configure AI extraction provider. Keys are stored locally in your browser.
            {' '}Document text is sent to your selected provider for extraction.
            {' '}
            <button type="button" className="data-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => navigate({ page: 'settings' })}>
              Manage in Settings
            </button>
          </p>

          <label className="form-field">
            <span>Provider</span>
            <select value={apiProvider} onChange={e => setApiProvider(e.target.value as typeof apiProvider)}>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>

          <label className="form-field" style={{ marginTop: 12 }}>
            <span>API key (optional)</span>
            <input type="password" placeholder="Uses environment variable if empty" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          </label>

          {errorMsg && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{errorMsg}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="btn btn-primary" disabled={isSubmitting || isReading} onClick={handleStartIngest}>{isSubmitting ? 'Starting extraction...' : 'Start extraction'}</button>
          </div>
        </div>
      )}

      {displayStep === 4 && status !== 'idle' && (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h2 aria-live="polite" style={{ fontSize: 16, fontWeight: 600 }}>
              {status === 'running' && 'Extracting knowledge graph...'}
              {status === 'success' && 'Extraction complete'}
              {status === 'failed' && 'Extraction failed'}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {status === 'success' && job?.collection && (
                <button type="button" className="btn btn-primary" onClick={() => navigate({ page: 'collection', name: job.collection, tab: 'graph' })}>
                  View collection
                </button>
              )}
              {(status === 'success' || status === 'failed') && !isSubmitting && (
                <button type="button" className="btn btn-secondary" onClick={resetPipeline}>{status === 'failed' ? 'Start a new extraction' : 'Add more documents'}</button>
              )}
              {status === 'failed' && files.length > 0 && !isSubmitting && (
                <button type="button" className="btn btn-primary" onClick={reviewSetup}>Review setup</button>
              )}
            </div>
          </div>

          {job && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {job.fileNames.length} document{job.fileNames.length !== 1 ? 's' : ''} · {job.collection} · {job.directory}
            </p>
          )}
          {status === 'running' && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              You can explore the workspace while extraction runs. Return to Add documents to check progress.
            </p>
          )}
          {errorMsg && <div className="form-error" role="alert" style={{ marginBottom: 12 }}>{errorMsg}</div>}
          {storageNotice && <p role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{storageNotice}</p>}
          {connectionNotice && status === 'running' && (
            <div role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {connectionNotice}{' '}
              <button type="button" className="btn btn-secondary btn-sm" disabled={isSubmitting} onClick={() => setPollVersion(version => version + 1)}>Check again</button>
            </div>
          )}

          <div ref={logConsoleRef} className="log-console" role="region" aria-label="Extraction pipeline output" tabIndex={0}>
            {logs || 'Waiting for pipeline output...'}
          </div>
        </div>
      )}
      </>}
    </div>
  )
}
