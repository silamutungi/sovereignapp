# Sovereign Component Library

Reusable React component patterns for every generated app. Copy-paste ready, TypeScript-typed, WCAG AA compliant.

---

## LoadingSpinner

```tsx
export default function LoadingSpinner({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      style={{ animation: 'spin 0.8s linear infinite' }}
      aria-label="Loading"
      role="status"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" opacity={0.2} />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}
```

---

## ErrorBoundary

```tsx
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error.message)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem' }}>Something went wrong.</p>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
```

---

## EmptyState

```tsx
import { type ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      {icon && <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{icon}</div>}
      <h3 style={{ fontFamily: 'Playfair Display, serif', marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ color: 'var(--text-dim, #6b6862)', marginBottom: action ? '1.5rem' : 0 }}>{description}</p>
      {action && (
        <button onClick={action.onClick} style={{ background: 'var(--color-green, #c8f060)', color: '#0e0d0b', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
```

---

## ConfettiCelebration

```tsx
import { useState, useEffect, type CSSProperties } from 'react'

const COLORS = ['#c8f060', '#0e0d0b', '#f2efe8', '#ff6b6b', '#4ecdc4', '#45b7d1']

export default function ConfettiCelebration({ trigger = true }: { trigger?: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (trigger) {
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 4000)
      return () => clearTimeout(t)
    }
  }, [trigger])

  if (!visible) return null

  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: COLORS[i % COLORS.length],
    delay: `${Math.random() * 0.5}s`,
    drift: `${(Math.random() - 0.5) * 80}px`,
    duration: `${0.8 + Math.random() * 0.6}s`,
  }))

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-10px',
            left: p.left,
            width: '8px',
            height: '8px',
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            '--drift': p.drift,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}
```

---

## useInView Hook

```tsx
import { useRef, useState, useEffect, type RefObject } from 'react'

export function useInView(threshold = 0.1): { ref: RefObject<HTMLDivElement>; visible: boolean } {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, visible }
}

// Usage:
// function Section() {
//   const { ref, visible } = useInView()
//   return (
//     <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.4s ease' }}>
//       content
//     </div>
//   )
// }
```

---

## ProtectedRoute

```tsx
import { Navigate } from 'react-router-dom'
import { type ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const userJson = sessionStorage.getItem('sovereign_user')
  if (!userJson) return <Navigate to="/login" replace />
  try {
    JSON.parse(userJson)
    return <>{children}</>
  } catch {
    sessionStorage.removeItem('sovereign_user')
    return <Navigate to="/login" replace />
  }
}
```

---

## Navbar with Auth State

```tsx
import { Link, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const userJson = sessionStorage.getItem('sovereign_user')
  const user = userJson ? JSON.parse(userJson) : null

  function signOut() {
    sessionStorage.removeItem('sovereign_user')
    navigate('/login')
  }

  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'var(--color-paper, #f2efe8)' }}>
      <Link to="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', color: 'var(--color-ink, #0e0d0b)', textDecoration: 'none', fontWeight: 700 }}>
        AppName
      </Link>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {user ? (
          <>
            <span style={{ color: 'var(--text-dim, #6b6862)', fontSize: '0.875rem', fontFamily: 'DM Mono, monospace' }}>{user.email}</span>
            <button onClick={signOut} style={{ background: 'none', border: '1px solid #ddd', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.875rem' }}>Sign out</button>
          </>
        ) : (
          <Link to="/login" style={{ color: 'var(--color-ink, #0e0d0b)', textDecoration: 'none', fontFamily: 'DM Mono, monospace', fontSize: '0.875rem' }}>Sign in</Link>
        )}
      </div>
    </nav>
  )
}
```

---

## Toast Notification

```tsx
import { useState, useCallback, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast { id: number; message: string; type: ToastType }

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  let nextId = 0

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  return { toasts, show }
}

const COLORS: Record<ToastType, string> = {
  success: '#22c55e', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b'
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 9998 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: '#0e0d0b', color: '#fff', padding: '0.75rem 1rem', borderRadius: '6px', borderLeft: `3px solid ${COLORS[t.type]}`, fontFamily: 'DM Mono, monospace', fontSize: '0.875rem', minWidth: '200px', animation: 'slideIn 0.2s ease' }}>
          <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: none } }`}</style>
          {t.message}
        </div>
      ))}
    </div>
  )
}
```
