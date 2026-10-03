/**
 * SettingsPage — Database, AI extraction, appearance, about.
 */
import { useState, useEffect } from 'react'
import { testConnection } from '../adapters/neo4j-service'
import { applyTheme, getStoredTheme, type ThemeMode } from '../utils/theme'

export default function SettingsPage() {
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [dbError, setDbError] = useState('')

  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme())
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = localStorage.getItem('nexari_api_provider') || localStorage.getItem('nitanics_api_provider')
    const k = localStorage.getItem('nexari_api_key') || localStorage.getItem('nitanics_api_key')
    if (p === 'gemini' || p === 'openai' || p === 'anthropic') setApiProvider(p)
    if (k) setApiKey(k)
  }, [])

  const checkConnection = async () => {
    setDbStatus('checking')
    setDbError('')
    try {
      await testConnection()
      setDbStatus('connected')
    } catch (err) {
      setDbStatus('error')
      setDbError(String(err))
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode)
    applyTheme(mode)
  }

  const handleSaveAi = () => {
    localStorage.setItem('nexari_api_provider', apiProvider)
    localStorage.setItem('nexari_api_key', apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const neo4jUri = import.meta.env.VITE_NEO4J_URI || 'bolt://localhost:7687'
  const neo4jDatabase = import.meta.env.VITE_NEO4J_DATABASE || 'memorytonic'
  const neo4jUser = import.meta.env.VITE_NEO4J_USER || 'neo4j'

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <h1 className="page-title">Settings</h1>

      <section className="card settings-section">
        <h2>Database</h2>
        <div className="settings-row">
          <span className="settings-label">URI</span>
          <span className="settings-value mono">{neo4jUri}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Database</span>
          <span className="settings-value mono">{neo4jDatabase}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">User</span>
          <span className="settings-value mono">{neo4jUser}</span>
        </div>
        <div className="settings-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span className="settings-label">Status</span>
          <span className={`settings-status settings-status-${dbStatus}`}>
            {dbStatus === 'checking' ? 'Checking...' : dbStatus}
          </span>
        </div>
        {dbStatus === 'error' && dbError && (
          <div className="form-error" style={{ marginTop: 8 }}>{dbError}</div>
        )}
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={checkConnection}>Test connection</button>
        </div>
      </section>

      <section className="card settings-section">
        <h2>AI extraction</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Default provider and API key for document ingestion. Keys are stored locally in your browser.
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
          <span>API key</span>
          <input type="password" placeholder="Optional — uses env variable if empty" value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </label>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--success)' }}>Saved</span>}
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveAi}>Save</button>
        </div>
      </section>

      <section className="card settings-section">
        <h2>Appearance</h2>
        <div className="theme-toggle-group">
          {(['light', 'dark', 'system'] as ThemeMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              className={`btn btn-secondary btn-sm ${theme === mode ? 'theme-active' : ''}`}
              onClick={() => handleThemeChange(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-section">
        <h2>About</h2>
        <div className="settings-row">
          <span className="settings-label">App</span>
          <span className="settings-value">Nitanics</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Version</span>
          <span className="settings-value">4.0.0</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          Open-source local knowledge graph workspace.
        </p>
      </section>
    </div>
  )
}
