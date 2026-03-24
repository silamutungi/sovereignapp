import { type FC } from 'react'

interface Props {
  score: number
  passed: boolean
}

const LAUNCH_THRESHOLD = 70

const LaunchGateBadge: FC<Props> = ({ score, passed }) => {
  const pointsNeeded = Math.max(0, LAUNCH_THRESHOLD - score)

  if (passed) {
    return (
      <div
        role="status"
        aria-label="Launch gate passed"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: '999px',
          fontFamily: 'DM Mono, monospace',
        }}
      >
        {/* Checkmark icon */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="9" fill="#22c55e" />
          <path d="M5 9l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#16a34a', letterSpacing: '0.03em' }}>
          LAUNCHED
        </span>
        <span style={{ fontSize: '0.75rem', color: '#6b6862' }}>
          Score {score}/100
        </span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label={`Launch gate not yet met — needs ${pointsNeeded} more points`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        background: '#fef2f2',
        border: '1.5px solid #fca5a5',
        borderRadius: '999px',
        fontFamily: 'DM Mono, monospace',
      }}
    >
      {/* X icon */}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="9" fill="#ef4444" />
        <path d="M6 6l6 6M12 6l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dc2626', letterSpacing: '0.03em' }}>
        Not ready
      </span>
      <span style={{ fontSize: '0.75rem', color: '#6b6862' }}>
        {pointsNeeded > 0
          ? `needs ${pointsNeeded} more point${pointsNeeded === 1 ? '' : 's'}`
          : `score ${score}/100`}
      </span>
    </div>
  )
}

export default LaunchGateBadge
