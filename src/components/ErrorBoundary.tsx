import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', err, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0e0d0b',
          color: '#f2efe8',
          fontFamily: "'DM Mono', monospace",
          padding: '2rem',
          textAlign: 'center',
          gap: '1rem',
        }}>
          <span style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF1F6E' }}>VISILA</span>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: '#6b6862', fontSize: 14 }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              background: '#FF1F6E',
              color: '#0e0d0b',
              border: 'none',
              padding: '12px 28px',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
