import { type FC } from 'react'
import ConfidenceScore from './ConfidenceScore.js'
import DimensionBar from './DimensionBar.js'
import LaunchGateBadge from './LaunchGateBadge.js'
import IssueList from './IssueList.js'

interface Dimension {
  name: string
  score: number
  minimum: number
  issues: Array<{ severity: string; message: string; file?: string; fix?: string }>
}

interface Report {
  overall_score: number
  band: string
  passed: boolean
  dimensions?: Dimension[]
  issues?: Array<{ severity: string; message: string; file?: string; fix?: string }>
}

interface Props {
  report: Report
}

const ConfidenceDashboard: FC<Props> = ({ report }) => {
  const allIssues = report.issues ?? (report.dimensions?.flatMap(d => d.issues ?? []) ?? [])
  const criticalCount = allIssues.filter(i => i.severity.toLowerCase() === 'critical').length
  const highCount = allIssues.filter(i => i.severity.toLowerCase() === 'high').length

  return (
    <div
      style={{
        fontFamily: 'DM Mono, monospace',
        background: '#f2efe8',
        minHeight: '100vh',
        padding: '2rem',
        color: '#0e0d0b',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '2rem',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: '0 0 0.25rem',
            }}
          >
            Confidence Report
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b6862', margin: 0 }}>
            {allIssues.length > 0
              ? `${allIssues.length} issue${allIssues.length === 1 ? '' : 's'} found${criticalCount > 0 ? ` — ${criticalCount} critical` : ''}`
              : 'No issues found'}
          </p>
        </div>

        {/* Score card */}
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            marginBottom: '1.5rem',
            overflow: 'hidden',
          }}
        >
          <ConfidenceScore
            score={report.overall_score}
            band={report.band}
            showDimensions={!!report.dimensions?.length}
          />

          {/* Launch gate badge */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '0 2rem 1.75rem',
            }}
          >
            <LaunchGateBadge score={report.overall_score} passed={report.passed} />
          </div>

          {/* Summary row */}
          {(criticalCount > 0 || highCount > 0) && (
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                padding: '1rem 2rem',
                borderTop: '1px solid #f3f4f6',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {criticalCount > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                    {criticalCount}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b6862', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Critical
                  </div>
                </div>
              )}
              {highCount > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ea580c' }}>
                    {highCount}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b6862', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    High
                  </div>
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0e0d0b' }}>
                  {allIssues.length}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b6862', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dimension bars */}
        {report.dimensions && report.dimensions.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#0e0d0b',
                margin: '0 0 1rem',
              }}
            >
              Dimensions
            </h2>
            {report.dimensions.map(dim => (
              <DimensionBar
                key={dim.name}
                dimension={dim.name}
                score={dim.score}
                minimum={dim.minimum}
                issueCount={dim.issues?.length ?? 0}
              />
            ))}
          </div>
        )}

        {/* Issue list */}
        {allIssues.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '1.5rem',
            }}
          >
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#0e0d0b',
                margin: '0 0 1rem',
              }}
            >
              Issues
            </h2>
            <IssueList issues={allIssues} />
          </div>
        )}

        {/* All clear */}
        {allIssues.length === 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #bbf7d0',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ display: 'inline-block' }} aria-hidden="true">
                <circle cx="20" cy="20" r="20" fill="#f0fdf4" />
                <path d="M12 20l6 6 10-10" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#16a34a', margin: '0 0 0.25rem' }}>
              No issues found
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b6862', margin: 0 }}>
              Your app meets all confidence criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfidenceDashboard
