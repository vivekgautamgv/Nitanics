/**
 * SettingsPage — Neo4j connection status + app info.
 * Source of truth: DESIGN-SPEC.md Section 12
 */
import { useState, useEffect } from 'react'
import { testConnection, closeDriver } from '../adapters/neo4j-service'

export default function SettingsPage() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [errorMsg, setErrorMsg] = useState('')

  const checkConnection = async () => {
    setStatus('checking')
    setErrorMsg('')
    try {
      await testConnection()
      setStatus('connected')
    } catch (err) {
      setStatus('error')
      setErrorMsg(String(err))
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  const neo4jUri = import.meta.env.VITE_NEO4J_URI || 'bolt://localhost:7687'
  const neo4jDatabase = import.meta.env.VITE_NEO4J_DATABASE || 'memorytonic'
  const neo4jUser = import.meta.env.VITE_NEO4J_USER || 'neo4j'

  return (
    <div className="page-container" style={{ maxWidth: '600px' }}>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>
        Settings
      </h1>

      {/* Neo4j Connection */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
          Neo4j Connection
        </h2>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>URI</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-mono, monospace)' }}>
              {neo4jUri}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Database</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-mono, monospace)' }}>
              {neo4jDatabase}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>User</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-mono, monospace)' }}>
              {neo4jUser}
            </span>
          </div>
          <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Status</span>
            <div className="flex items-center gap-2">
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: status === 'connected' ? 'var(--success)'
                  : status === 'error' ? 'var(--error)'
                  : 'var(--warning)',
              }} />
              <span style={{
                color: status === 'connected' ? 'var(--success)'
                  : status === 'error' ? 'var(--error)'
                  : 'var(--text-muted)',
                fontSize: '13px',
                textTransform: 'capitalize',
              }}>
                {status === 'checking' ? 'Checking...' : status}
              </span>
            </div>
          </div>

          {status === 'error' && errorMsg && (
            <div style={{ color: 'var(--error)', fontSize: '12px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)' }}>
              {errorMsg}
            </div>
          )}

          <div className="flex gap-2 justify-end" style={{ marginTop: '4px' }}>
            <button className="btn btn-secondary" onClick={checkConnection}>
              Test Connection
            </button>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
          About
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>App</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Nitanics</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Version</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>4.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Component</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>03-frontend</span>
          </div>
        </div>
      </div>
    </div>
  )
}
