import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import Building from './pages/Building.tsx'
import Dashboard from './pages/Dashboard.tsx'
import BrainDashboard from './pages/brain-dashboard.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ChatProvider } from './store/chatStore.tsx'
import { SovereignChat } from './components/SovereignChat.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ChatProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/building" element={<Building />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/brain" element={<BrainDashboard />} />
            <Route path="/*" element={<App />} />
          </Routes>
          {/* Global chat — renders on every page */}
          <SovereignChat />
        </BrowserRouter>
      </ChatProvider>
    </ErrorBoundary>
  </StrictMode>
)
