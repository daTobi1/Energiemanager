import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#e6edf3', background: '#0d1117', minHeight: '100vh' }}>
          <h1 style={{ color: '#f85149', marginBottom: 16 }}>Laufzeitfehler</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#161b22', padding: 16, borderRadius: 8, border: '1px solid #30363d' }}>
            {this.state.error.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#161b22', padding: 16, borderRadius: 8, border: '1px solid #30363d', marginTop: 8, fontSize: 12, color: '#8b949e' }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => {
              localStorage.removeItem('energy-manager-store')
              window.location.reload()
            }}
            style={{ marginTop: 16, padding: '8px 16px', background: '#238636', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            LocalStorage löschen &amp; neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
