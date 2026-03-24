import { type FC } from 'react'

interface Props {
  dimension: string
  score: number
  minimum: number
  issueCount: number
}

const DimensionBar: FC<Props> = ({ dimension, score, minimum, issueCount }) => {
  const passing = score >= minimum
  const barColor = passing ? '#84cc16' : '#ef4444'
  const minPct = Math.min(minimum, 100)
  const scorePct = Math.min(score, 100)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        padding: '0.75rem 0',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '0.875rem',
            color: '#0e0d0b',
            fontWeight: 500,
          }}
        >
          {dimension}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {issueCount > 0 && (
            <span
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '0.75rem',
                color: '#ef4444',
                background: '#fef2f2',
                borderRadius: '999px',
                padding: '0.125rem 0.5rem',
              }}
            >
              {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
            </span>
          )}
          <span
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: barColor,
            }}
          >
            {score}
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div style={{ position: 'relative', height: '8px', background: '#e5e7eb', borderRadius: '999px' }}>
        {/* Score fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '8px',
            width: `${scorePct}%`,
            background: barColor,
            borderRadius: '999px',
            transition: 'width 0.4s ease-out',
          }}
        />
        {/* Minimum line marker */}
        <div
          title={`Minimum: ${minimum}`}
          style={{
            position: 'absolute',
            left: `${minPct}%`,
            top: '-3px',
            width: '2px',
            height: '14px',
            background: '#6b6862',
            borderRadius: '1px',
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'DM Mono, monospace',
          fontSize: '0.7rem',
          color: '#6b6862',
        }}
      >
        <span>0</span>
        <span style={{ color: passing ? '#6b6862' : '#ef4444' }}>
          min: {minimum}{!passing && ' — not met'}
        </span>
        <span>100</span>
      </div>
    </div>
  )
}

export default DimensionBar
