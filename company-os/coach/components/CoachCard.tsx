import { useEffect, useState, type FC } from 'react'

interface Action {
  label: string
  url?: string
}

interface Recommendation {
  title: string
  body: string
  priority: string
  action: Action
  source_agent: string
}

interface Props {
  recommendation: Recommendation
  onDismiss: () => void
  onAction: () => void
}

const PRIORITY_BORDER: Record<string, string> = {
  critical:   '#dc2626',
  high:       '#ea580c',
  medium:     '#ca8a04',
  low:        '#16a34a',
  info:       '#2563eb',
}

const PRIORITY_LABEL_COLOR: Record<string, string> = {
  critical:   '#dc2626',
  high:       '#ea580c',
  medium:     '#ca8a04',
  low:        '#16a34a',
  info:       '#2563eb',
}

const PRIORITY_LABEL_BG: Record<string, string> = {
  critical:   '#fef2f2',
  high:       '#fff7ed',
  medium:     '#fefce8',
  low:        '#f0fdf4',
  info:       '#eff6ff',
}

const CoachCard: FC<Props> = ({ recommendation, onDismiss, onAction }) => {
  const [visible, setVisible] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(timer)
  }, [])

  const handleDismiss = () => {
    setDismissing(true)
    setTimeout(() => {
      onDismiss()
    }, 250)
  }

  const priority = recommendation.priority.toLowerCase()
  const borderColor = PRIORITY_BORDER[priority] ?? '#e5e7eb'
  const labelColor = PRIORITY_LABEL_COLOR[priority] ?? '#6b6862'
  const labelBg = PRIORITY_LABEL_BG[priority] ?? '#f9fafb'

  return (
    <div
      role="article"
      aria-label={`Coach recommendation: ${recommendation.title}`}
      style={{
        display: 'flex',
        gap: '0',
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        opacity: dismissing ? 0 : visible ? 1 : 0,
        transform: dismissing
          ? 'translateX(24px)'
          : visible
          ? 'translateY(0)'
          : 'translateY(8px)',
        transition: dismissing
          ? 'opacity 0.25s ease, transform 0.25s ease'
          : 'opacity 0.2s ease, transform 0.2s ease',
      }}
    >
      {/* Priority left border */}
      <div
        aria-hidden="true"
        style={{
          width: '4px',
          flexShrink: 0,
          background: borderColor,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, padding: '1rem 1rem 0.875rem', minWidth: 0 }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.375rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: 'DM Mono, monospace',
                color: labelColor,
                background: labelBg,
                borderRadius: '4px',
                padding: '0.1rem 0.375rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {recommendation.priority}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontFamily: 'DM Mono, monospace',
                color: '#6b6862',
              }}
            >
              via {recommendation.source_agent}
            </span>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss recommendation"
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              color: '#6b6862',
              fontSize: '1rem',
              lineHeight: 1,
              opacity: 0.6,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6' }}
          >
            ×
          </button>
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#0e0d0b',
            margin: '0 0 0.375rem',
            lineHeight: 1.4,
          }}
        >
          {recommendation.title}
        </h3>

        {/* Body */}
        <p
          style={{
            fontSize: '0.875rem',
            fontFamily: 'DM Mono, monospace',
            color: '#6b6862',
            margin: '0 0 0.875rem',
            lineHeight: 1.6,
          }}
        >
          {recommendation.body}
        </p>

        {/* Action button */}
        <button
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.875rem',
            background: '#c8f060',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'DM Mono, monospace',
            color: '#1a1a1a',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#b8e050' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c8f060' }}
        >
          {recommendation.action.label}
          {recommendation.action.url && (
            <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>→</span>
          )}
        </button>
      </div>
    </div>
  )
}

export default CoachCard
