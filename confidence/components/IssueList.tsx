import { useState, type FC } from 'react'

interface Issue {
  severity: string
  message: string
  file?: string
  fix?: string
}

interface Props {
  issues: Issue[]
  onIssueClick?: (issue: Issue) => void
}

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; order: number }> = {
  critical: { label: 'CRITICAL', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', order: 0 },
  high:     { label: 'HIGH',     bg: '#fff7ed', color: '#ea580c', border: '#fed7aa', order: 1 },
  medium:   { label: 'MEDIUM',   bg: '#fefce8', color: '#ca8a04', border: '#fde047', order: 2 },
  low:      { label: 'LOW',      bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', order: 3 },
  info:     { label: 'INFO',     bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', order: 4 },
}

const DEFAULT_CONFIG = { label: 'UNKNOWN', bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', order: 5 }

function groupBySeverity(issues: Issue[]): Record<string, Issue[]> {
  const groups: Record<string, Issue[]> = {}
  for (const issue of issues) {
    const key = issue.severity.toLowerCase()
    if (!groups[key]) groups[key] = []
    groups[key].push(issue)
  }
  return groups
}

const IssueRow: FC<{ issue: Issue; onClick?: (issue: Issue) => void }> = ({ issue, onClick }) => {
  const [expanded, setExpanded] = useState(false)
  const config = SEVERITY_CONFIG[issue.severity.toLowerCase()] ?? DEFAULT_CONFIG

  const handleToggle = () => {
    setExpanded(prev => !prev)
    if (onClick) onClick(issue)
  }

  return (
    <div
      style={{
        border: `1px solid ${config.border}`,
        borderRadius: '6px',
        marginBottom: '0.5rem',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            flexShrink: 0,
            fontSize: '0.7rem',
            fontWeight: 700,
            fontFamily: 'DM Mono, monospace',
            color: config.color,
            background: config.bg,
            border: `1px solid ${config.border}`,
            borderRadius: '4px',
            padding: '0.125rem 0.375rem',
            marginTop: '1px',
          }}
        >
          {config.label}
        </span>

        <span
          style={{
            flex: 1,
            fontSize: '0.875rem',
            fontFamily: 'DM Mono, monospace',
            color: '#0e0d0b',
            lineHeight: 1.5,
          }}
        >
          {issue.message}
        </span>

        {(issue.file || issue.fix) && (
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.75rem',
              color: '#6b6862',
              fontFamily: 'DM Mono, monospace',
              marginTop: '2px',
            }}
          >
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {expanded && (issue.file || issue.fix) && (
        <div
          style={{
            padding: '0.75rem 1rem 0.875rem',
            borderTop: `1px solid ${config.border}`,
            background: config.bg,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {issue.file && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', color: '#6b6862', flexShrink: 0 }}>
                File:
              </span>
              <code
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'DM Mono, monospace',
                  color: '#0e0d0b',
                  wordBreak: 'break-all',
                }}
              >
                {issue.file}
              </code>
            </div>
          )}
          {issue.fix && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', color: '#6b6862', flexShrink: 0 }}>
                Fix:
              </span>
              <span style={{ fontSize: '0.8125rem', fontFamily: 'DM Mono, monospace', color: '#0e0d0b', lineHeight: 1.5 }}>
                {issue.fix}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const IssueList: FC<Props> = ({ issues, onIssueClick }) => {
  const groups = groupBySeverity(issues)
  const sortedSeverities = Object.keys(groups).sort(
    (a, b) => (SEVERITY_CONFIG[a]?.order ?? 5) - (SEVERITY_CONFIG[b]?.order ?? 5)
  )

  if (issues.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#6b6862',
          fontFamily: 'DM Mono, monospace',
          fontSize: '0.875rem',
          background: '#f9fafb',
          borderRadius: '8px',
        }}
      >
        No issues found.
      </div>
    )
  }

  return (
    <div>
      {sortedSeverities.map(severity => {
        const config = SEVERITY_CONFIG[severity] ?? DEFAULT_CONFIG
        const severityIssues = groups[severity]
        return (
          <div key={severity} style={{ marginBottom: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.625rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'DM Mono, monospace',
                  color: config.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {config.label}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'DM Mono, monospace',
                  color: '#6b6862',
                }}
              >
                ({severityIssues.length})
              </span>
            </div>

            {severityIssues.map((issue, i) => (
              <IssueRow key={i} issue={issue} onClick={onIssueClick} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default IssueList
