import { useEffect, useState, type FC } from 'react'

interface Action {
  label: string
  url?: string
}

interface Intervention {
  title: string
  message: string
  priority: string
  action?: Action
}

interface Props {
  intervention: Intervention
  onDismiss: () => void
}

const PRIORITY_STYLES: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  critical: { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', icon: '⚠' },
  high:     { bg: '#fff7ed', border: '#fdba74', color: '#ea580c', icon: '!' },
  medium:   { bg: '#fefce8', border: '#fde047', color: '#ca8a04', icon: 'i' },
  low:      { bg: '#f0fdf4', border: '#86efac', color: '#16a34a', icon: '✓' },
  info:     { bg: '#eff6ff', border: '#93c5fd', color: '#2563eb', icon: 'i' },
}

const DEFAULT_STYLE = { bg: '#f9fafb', border: '#e5e7eb', color: '#6b6862', icon: 'i' }

const InterventionBanner: FC<Props> = ({ intervention, onDismiss }) => {
  const [visible, setVisible] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleDismiss = () => {
    setDismissing(true)
    setTimeout(onDismiss, 300)
  }

  const priority = intervention.priority.toLowerCase()
  const style = PRIORITY_STYLES[priority] ?? DEFAULT_STYLE

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        width: '100%',
        background: style.bg,
        borderTop: `3px solid ${style.color}`,
        borderBottom: `1px solid ${style.border}`,
        padding: '0.875rem 1.25rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        fontFamily: 'DM Mono, monospace',
        opacity: dismissing ? 0 : visible ? 1 : 0,
        transform: dismissing
          ? 'translateY(-8px)'
          : visible
          ? 'translateY(0)'
          : 'translateY(-4px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Priority icon */}
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: style.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8125rem',
          fontWeight: 700,
          marginTop: '1px',
        }}
      >
        {style.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: style.color,
            }}
          >
            {intervention.priority}
          </span>
          <span
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: '#0e0d0b',
            }}
          >
            {intervention.title}
          </span>
        </div>

        <p
          style={{
            fontSize: '0.875rem',
            color: '#0e0d0b',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {intervention.message}
        </p>

        {intervention.action && (
          <div style={{ marginTop: '0.625rem' }}>
            <a
              href={intervention.action.url ?? '#'}
              target={intervention.action.url ? '_blank' : undefined}
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: style.color,
                textDecoration: 'none',
                borderBottom: `1px solid ${style.color}`,
                paddingBottom: '1px',
              }}
            >
              {intervention.action.label}
              {intervention.action.url && (
                <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>→</span>
              )}
            </a>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          fontSize: '1.125rem',
          lineHeight: 1,
          color: '#6b6862',
          opacity: 0.6,
          transition: 'opacity 0.15s ease',
          marginTop: '-2px',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6' }}
      >
        ×
      </button>
    </div>
  )
}

export default InterventionBanner
