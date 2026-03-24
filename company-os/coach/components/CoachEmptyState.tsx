import { type FC } from 'react'

const CoachEmptyState: FC = () => {
  return (
    <div
      role="status"
      aria-label="No coach recommendations"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        fontFamily: 'DM Mono, monospace',
      }}
    >
      {/* Checkmark SVG */}
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        aria-hidden="true"
        style={{ marginBottom: '1rem' }}
      >
        <circle cx="28" cy="28" r="28" fill="#f0fdf4" />
        <circle cx="28" cy="28" r="20" fill="#dcfce7" />
        <path
          d="M19 28l7 7 11-11"
          stroke="#22c55e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <h3
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#0e0d0b',
          margin: '0 0 0.375rem',
        }}
      >
        Your product is in good shape
      </h3>

      <p
        style={{
          fontSize: '0.875rem',
          color: '#6b6862',
          margin: '0 0 1.5rem',
          lineHeight: 1.6,
          maxWidth: '260px',
        }}
      >
        No recommendations right now. Keep shipping — the coach will flag anything that needs attention.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          width: '100%',
          maxWidth: '240px',
        }}
      >
        {['Security', 'Performance', 'UX', 'Legal'].map(area => (
          <div
            key={area}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              color: '#6b6862',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="7" fill="#f0fdf4" />
              <path d="M4 7l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {area} looks good
          </div>
        ))}
      </div>
    </div>
  )
}

export default CoachEmptyState
