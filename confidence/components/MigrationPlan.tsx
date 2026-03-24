import { type FC } from 'react'

interface Step {
  step: string
  effort: string
  impact: number
}

interface Props {
  migrationPlan: Step[]
}

const EFFORT_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

function isQuickWin(step: Step): boolean {
  const effortKey = step.effort.toLowerCase()
  return step.impact >= 7 && (effortKey === 'low' || effortKey.includes('quick') || effortKey.includes('min'))
}

const effortColor = (effort: string): string => {
  const key = effort.toLowerCase()
  if (key === 'low') return '#16a34a'
  if (key === 'medium') return '#ca8a04'
  if (key === 'high') return '#dc2626'
  return '#6b6862'
}

const effortBg = (effort: string): string => {
  const key = effort.toLowerCase()
  if (key === 'low') return '#f0fdf4'
  if (key === 'medium') return '#fefce8'
  if (key === 'high') return '#fef2f2'
  return '#f9fafb'
}

const impactBar = (impact: number): string => {
  if (impact >= 9) return '#22c55e'
  if (impact >= 7) return '#84cc16'
  if (impact >= 5) return '#eab308'
  if (impact >= 3) return '#f97316'
  return '#ef4444'
}

const MigrationPlan: FC<Props> = ({ migrationPlan }) => {
  if (!migrationPlan || migrationPlan.length === 0) {
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
        No migration steps defined.
      </div>
    )
  }

  const sorted = [...migrationPlan].sort((a, b) => {
    const aWin = isQuickWin(a) ? 0 : 1
    const bWin = isQuickWin(b) ? 0 : 1
    if (aWin !== bWin) return aWin - bWin
    // Within same group, sort by effort (low first) then impact (high first)
    const effortDiff = (EFFORT_ORDER[a.effort.toLowerCase()] ?? 1) - (EFFORT_ORDER[b.effort.toLowerCase()] ?? 1)
    if (effortDiff !== 0) return effortDiff
    return b.impact - a.impact
  })

  return (
    <div style={{ fontFamily: 'DM Mono, monospace' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sorted.map((item, idx) => {
          const win = isQuickWin(item)
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                padding: '0.875rem 1rem',
                borderRadius: '6px',
                marginBottom: '0.5rem',
                background: win ? '#f0fdf4' : '#f9fafb',
                border: win ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
                position: 'relative',
              }}
            >
              {/* Timeline dot */}
              <div
                style={{
                  flexShrink: 0,
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: win ? '#c8f060' : '#e5e7eb',
                  border: win ? '2px solid #84cc16' : '2px solid #d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: win ? '#1a1a1a' : '#6b6862',
                  marginTop: '2px',
                }}
              >
                {idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {win && (
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: '#16a34a',
                      background: '#dcfce7',
                      border: '1px solid #bbf7d0',
                      borderRadius: '4px',
                      padding: '0.1rem 0.4rem',
                      marginBottom: '0.375rem',
                    }}
                  >
                    QUICK WIN
                  </span>
                )}

                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#0e0d0b',
                    lineHeight: 1.5,
                    marginBottom: '0.5rem',
                  }}
                >
                  {item.step}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Effort badge */}
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: effortColor(item.effort),
                      background: effortBg(item.effort),
                      borderRadius: '4px',
                      padding: '0.1rem 0.4rem',
                    }}
                  >
                    Effort: {item.effort}
                  </span>

                  {/* Impact bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#6b6862' }}>Impact:</span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '2px',
                            background: i < item.impact ? impactBar(item.impact) : '#e5e7eb',
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#6b6862' }}>{item.impact}/10</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MigrationPlan
