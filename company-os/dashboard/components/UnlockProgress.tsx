// company-os/dashboard/components/UnlockProgress.tsx
// Progress bar showing how many Company OS agents have been unlocked

import { type FC } from 'react'

interface UnlockProgressProps {
  unlocked: number
  total: number
  unlockedAgents: string[]
  lockedAgents: string[]
}

export const UnlockProgress: FC<UnlockProgressProps> = ({
  unlocked,
  total,
  unlockedAgents,
  lockedAgents,
}) => {
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0

  return (
    <div
      style={{
        padding: '20px 24px',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid rgba(14,13,11,0.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h2
          style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: '16px',
            fontWeight: 700,
            color: '#0e0d0b',
            margin: 0,
          }}
        >
          Intelligence Unlock Progress
        </h2>
        <span
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '13px',
            color: '#6b6862',
          }}
        >
          {unlocked} / {total} agents
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '8px',
          borderRadius: '100px',
          background: 'rgba(14,13,11,0.08)',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: '100px',
            background: '#c8f060',
            transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>

      {/* Agent lists */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Unlocked */}
        {unlockedAgents.length > 0 && (
          <div style={{ flex: '1 1 200px' }}>
            <p
              style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#6b6862',
                margin: '0 0 8px',
              }}
            >
              Unlocked
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {unlockedAgents.map(agent => (
                <li
                  key={agent}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '12px',
                    color: '#15803d',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#c8f060',
                      flexShrink: 0,
                    }}
                  />
                  {agent}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Locked */}
        {lockedAgents.length > 0 && (
          <div style={{ flex: '1 1 200px' }}>
            <p
              style={{
                fontFamily: '"DM Mono", monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#6b6862',
                margin: '0 0 8px',
              }}
            >
              Locked
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {lockedAgents.map(agent => (
                <li
                  key={agent}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '12px',
                    color: '#94a3b8',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#e2e8f0',
                      flexShrink: 0,
                    }}
                  />
                  {agent}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default UnlockProgress
