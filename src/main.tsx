import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import Building from './pages/Building.tsx'
import Dashboard from './pages/Dashboard.tsx'
import BrainDashboard from './pages/brain-dashboard.tsx'
import Status from './pages/Status'
import Changelog from './pages/Changelog'
import EditApp from './pages/EditApp'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ChatProvider } from './store/chatStore.tsx'
import { VisilaChat } from './components/VisilaChat.tsx'

// ── Diagnostic error boundary — shows full stack trace on render failures ─────
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
          <h2>Render error</h2>
          <pre>{err.message}</pre>
          <pre style={{ fontSize: '12px', color: '#666' }}>{err.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ChatProvider>
        <BrowserRouter>
          <AppErrorBoundary>
            <Routes>
              <Route path="/building" element={<Building />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/brain" element={<BrainDashboard />} />
              <Route path="/status" element={<Status />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/app/:buildId/edit" element={<EditApp />} />
              <Route path="/*" element={<App />} />
            </Routes>
          </AppErrorBoundary>
          {/* Global chat — renders on every page */}
          <VisilaChat />
        </BrowserRouter>
      </ChatProvider>
    </ErrorBoundary>
  </StrictMode>
)
