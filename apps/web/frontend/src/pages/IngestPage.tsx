import React, { useState, useEffect, useRef } from 'react'
import { useDirectoryStore } from '../stores/directory-store'
import { useNavigationStore } from '../stores/navigation-store'

interface FileToUpload {
  name: string
  content: string // text or base64 data url for PDFs
  size: number
  type: string
}

export default function IngestPage() {
  const { allCollections, directories, loadDirectories, loadAllCollections } = useDirectoryStore()
  const navigate = useNavigationStore(s => s.navigate)

  const [files, setFiles] = useState<FileToUpload[]>([])
  const [collectionOption, setCollectionOption] = useState<'existing' | 'new'>('existing')
  const [selectedCollection, setSelectedCollection] = useState('')
  const [newCollectionName, setNewCollectionName] = useState('')
  const [selectedDirectory, setSelectedDirectory] = useState('Research')
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini')
  const [apiKey, setApiKey] = useState('')

  // Ingestion execution state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processId, setProcessId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [logs, setLogs] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const logConsoleRef = useRef<HTMLDivElement>(null)

  // Load configuration from local storage
  useEffect(() => {
    loadDirectories()
    loadAllCollections()
    const savedProvider = localStorage.getItem('nitanics_api_provider')
    const savedKey = localStorage.getItem('nitanics_api_key')
    if (savedProvider) setApiProvider(savedProvider as any)
    if (savedKey) setApiKey(savedKey)
  }, [loadDirectories, loadAllCollections])

  // Scroll logs to bottom
  useEffect(() => {
    if (logConsoleRef.current) {
      logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight
    }
  }, [logs])

  // Poll status endpoint
  useEffect(() => {
    if (!processId || status !== 'running') return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5176/api/status?id=${processId}`)
        if (!res.ok) throw new Error('Failed to query status')
        const data = await res.json()
        setLogs(data.logs || '')
        if (data.status !== 'running') {
          setStatus(data.status)
          setIsProcessing(false)
          if (data.status === 'success') {
            // Reload metadata in store
            loadDirectories()
            loadAllCollections()
          }
        }
      } catch (err: any) {
        setLogs(prev => prev + `\n[UI ERROR] Connection to API server lost: ${err.message}\n`)
        setStatus('failed')
        setIsProcessing(false)
        clearInterval(timer)
      }
    }, 1200)

    return () => clearInterval(timer)
  }, [processId, status, loadDirectories, loadAllCollections])

  // Handle file drop/select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    processFiles(e.target.files)
  }

  const processFiles = (fileList: FileList) => {
    const loadedFiles: FileToUpload[] = []
    let processedCount = 0

    Array.from(fileList).forEach(file => {
      const reader = new FileReader()
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')

      reader.onload = (event) => {
        if (event.target?.result) {
          loadedFiles.push({
            name: file.name,
            content: event.target.result as string,
            size: file.size,
            type: isPdf ? 'pdf' : 'text'
          })
        }
        processedCount++
        if (processedCount === fileList.length) {
          setFiles(prev => [...prev, ...loadedFiles])
        }
      }

      if (isPdf) {
        reader.readAsDataURL(file) // read PDF as base64 data url
      } else {
        reader.readAsText(file) // read text/markdown as raw string
      }
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleStartIngest = async () => {
    setErrorMsg('')
    const collection = collectionOption === 'existing' ? selectedCollection : newCollectionName.trim()
    if (!collection) {
      setErrorMsg('Please specify or select a target collection.')
      return
    }
    if (files.length === 0) {
      setErrorMsg('Please upload at least one document.')
      return
    }

    // Save provider & key to localStorage for developer comfort
    localStorage.setItem('nitanics_api_provider', apiProvider)
    localStorage.setItem('nitanics_api_key', apiKey)

    setIsProcessing(true)
    setStatus('running')
    setLogs('[UI] Preparing files for upload...\n')

    try {
      const res = await fetch('http://127.0.0.1:5176/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection,
          directory: selectedDirectory,
          provider: apiProvider,
          apiKey: apiKey.trim() || undefined,
          files: files.map(f => ({ name: f.name, content: f.content }))
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to start ingestion process.')
      }

      const data = await res.json()
      setProcessId(data.processId)
      setLogs(prev => prev + `[UI] Ingestion triggered successfully. Process ID: ${data.processId}\n`)
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('failed')
      setIsProcessing(false)
    }
  }

  const resetPipeline = () => {
    setFiles([])
    setProcessId(null)
    setStatus('idle')
    setLogs('')
    setErrorMsg('')
    setIsProcessing(false)
  }

  const activeCollectionName = collectionOption === 'existing' ? selectedCollection : newCollectionName.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '24px 28px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.05em', color: 'var(--text-primary)', marginBottom: 8 }}>
          Ingest Research Documents
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 680 }}>
          Upload multiple documents, research papers, transcripts, or notes. The system chunks large texts and parses them programmatically using an LLM to build a combined knowledge graph.
        </p>
      </header>

      {status === 'idle' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(320px, 440px)', gap: 26, alignItems: 'start' }}>
          {/* File Upload Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 24,
                background: 'var(--surface-raised)',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.backgroundColor = 'var(--surface-hover)'
                e.currentTarget.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.backgroundColor = 'var(--surface-raised)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                multiple
                accept=".txt,.md,.pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.8"
                style={{ marginBottom: 12, opacity: 0.8 }}
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Drag and drop research files
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Supports Markdown (.md), Text (.txt), and PDF (.pdf) files
              </div>
            </div>

            {/* Selected Files List */}
            {files.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    Files to process ({files.length})
                  </span>
                  <button
                    onClick={() => setFiles([])}
                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {files.map((file, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 6px',
                          borderRadius: 6,
                          background: file.type === 'pdf' ? '#b42318' : '#111827',
                          color: '#fff',
                          textTransform: 'uppercase'
                        }}>
                          {file.type}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(i)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: 14,
                          padding: '0 4px',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Configuration Sidebar */}
          <aside style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Ingestion Target</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select where to save your knowledge graph data.</p>
            </div>

            {/* Collection Option Selection */}
            <div style={{ display: 'flex', gap: 8, background: 'var(--surface-raised)', padding: 4, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setCollectionOption('existing')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: collectionOption === 'existing' ? 'var(--surface)' : 'transparent',
                  boxShadow: collectionOption === 'existing' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  color: 'var(--text-primary)',
                }}
              >
                Existing Collection
              </button>
              <button
                onClick={() => setCollectionOption('new')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: collectionOption === 'new' ? 'var(--surface)' : 'transparent',
                  boxShadow: collectionOption === 'new' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  color: 'var(--text-primary)',
                }}
              >
                New Collection
              </button>
            </div>

            {/* Target inputs */}
            {collectionOption === 'existing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Select Collection
                </label>
                <select
                  value={selectedCollection}
                  onChange={e => setSelectedCollection(e.target.value)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">-- Choose collection --</option>
                  {allCollections.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  New Collection Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. AI Research"
                  value={newCollectionName}
                  onChange={e => setNewCollectionName(e.target.value)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Directory Category
              </label>
              <select
                value={selectedDirectory}
                onChange={e => setSelectedDirectory(e.target.value)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                }}
              >
                {directories.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, marginTop: 12 }}>AI Provider (Optional)</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Specify a key or use the environment keys on the host.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Provider
              </label>
              <select
                value={apiProvider}
                onChange={e => setApiProvider(e.target.value as any)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                }}
              >
                <option value="gemini">Gemini (Recommended)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                API Key
              </label>
              <input
                type="password"
                placeholder={apiKey ? "••••••••••••••••" : "Uses env variable if empty"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {errorMsg && (
              <div style={{ padding: 10, borderRadius: 10, background: 'rgba(180,35,24,0.06)', border: '1px solid rgba(180,35,24,0.18)', fontSize: 12, color: 'var(--error)' }}>
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleStartIngest}
              disabled={files.length === 0}
              className="btn btn-primary"
              style={{ justifyContent: 'center', padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700 }}
            >
              Start Ingestion Pipeline
            </button>
          </aside>
        </div>
      ) : (
        /* Processing / Terminal Status Page */
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {status === 'running' && (
                <div style={{ width: 22, height: 22, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              )}
              {status === 'success' && (
                <span style={{ fontSize: 18, color: 'var(--success)' }}>✓</span>
              )}
              {status === 'failed' && (
                <span style={{ fontSize: 18, color: 'var(--error)' }}>✕</span>
              )}
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {status === 'running' && 'Processing documents...'}
                {status === 'success' && 'Ingestion successful!'}
                {status === 'failed' && 'Ingestion failed.'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {status === 'success' && (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate({ page: 'graph', collectionName: activeCollectionName })}
                >
                  Open Graph Studio
                </button>
              )}
              {(status === 'success' || status === 'failed') && (
                <button className="btn btn-secondary" onClick={resetPipeline}>
                  Start New Ingest
                </button>
              )}
            </div>
          </div>

          {/* Progress Indicators */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: status === 'running' ? 'rgba(56,189,248,0.1)' : status === 'success' ? 'rgba(16,185,129,0.1)' : 'var(--surface-raised)',
              border: status === 'running' ? '1px solid rgba(56,189,248,0.2)' : status === 'success' ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border)',
              color: status === 'success' ? 'var(--success)' : status === 'running' ? 'var(--accent)' : 'var(--text-primary)',
              fontWeight: 600
            }}>
              1. Document Parsing & Chunking
            </span>
            <span style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: status === 'success' ? 'rgba(16,185,129,0.1)' : 'var(--surface-raised)',
              border: status === 'success' ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border)',
              color: status === 'success' ? 'var(--success)' : 'var(--text-muted)',
              fontWeight: 600
            }}>
              2. Entity Discovery & LLM Extraction
            </span>
            <span style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: status === 'success' ? 'rgba(16,185,129,0.1)' : 'var(--surface-raised)',
              border: status === 'success' ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border)',
              color: status === 'success' ? 'var(--success)' : 'var(--text-muted)',
              fontWeight: 600
            }}>
              3. Vector Embeddings & Neo4j Upload
            </span>
          </div>

          {/* Monospace Log Viewer */}
          <div
            ref={logConsoleRef}
            style={{
              height: 420,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 18,
              padding: '16px 20px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 12,
              lineHeight: 1.6,
              color: '#f3f4f6',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              boxShadow: 'inset 0 4px 18px rgba(0,0,0,0.25)'
            }}
          >
            {logs || 'Waiting for pipeline output...'}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}
