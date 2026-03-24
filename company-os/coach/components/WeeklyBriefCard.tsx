import { type FC } from 'react'

interface Metric {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'flat'
}

interface FocusItem {
  title: string
  description?: string
}

interface NextStep {
  action: string
  owner?: string
  due?: string
}

interface BriefSections {
  key_metrics: Metric[]
  wins: string[]
  focus: FocusItem
  intelligence: string
  next_steps: NextStep[]
}

interface Brief {
  sections: BriefSections
}

interface Props {
  brief: Brief
}

const trendIcon = (trend?: 'up' | 'down' | 'flat') => {
  if (trend === 'up') return <span style={{ color: '#22c55e' }}>↑</span>
  if (trend === 'down') return <span style={{ color: '#ef4444' }}>↓</span>
  return <span style={{ color: '#6b6862' }}>→</span>
}

const SectionHeader: FC<{ children: string }> = ({ children }) => (
  <div
    style={{
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: '#6b6862',
      fontFamily: 'DM Mono, monospace',
      marginBottom: '0.75rem',
      paddingBottom: '0.375rem',
      borderBottom: '1px solid #f3f4f6',
    }}
  >
    {children}
  </div>
)

const WeeklyBriefCard: FC<Props> = ({ brief }) => {
  const { key_metrics, wins, focus, intelligence, next_steps } = brief.sections

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        fontFamily: 'DM Mono, monospace',
        maxWidth: '600px',
        width: '100%',
      }}
    >
      {/* Card header */}
      <div
        style={{
          background: '#0e0d0b',
          padding: '1.25rem 1.5rem',
        }}
      >
        <h2
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#f2efe8',
            margin: '0 0 0.25rem',
          }}
        >
          Weekly Brief
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Section 1: Key metrics */}
        {key_metrics && key_metrics.length > 0 && (
          <section>
            <SectionHeader>Key Metrics</SectionHeader>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {key_metrics.map((m, i) => (
                <div
                  key={i}
                  style={{
                    background: '#f9fafb',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    border: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: '#6b6862', marginBottom: '0.25rem' }}>
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: '#0e0d0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {m.value}
                    {m.trend && trendIcon(m.trend)}
                  </div>
                  {m.change && (
                    <div style={{ fontSize: '0.7rem', color: '#6b6862', marginTop: '0.125rem' }}>
                      {m.change}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 2: Wins */}
        {wins && wins.length > 0 && (
          <section>
            <SectionHeader>Wins This Week</SectionHeader>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {wins.map((win, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '0.625rem',
                    alignItems: 'flex-start',
                    fontSize: '0.875rem',
                    color: '#0e0d0b',
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#22c55e', flexShrink: 0, marginTop: '2px' }}>✓</span>
                  {win}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 3: Focus */}
        {focus && (
          <section>
            <SectionHeader>This Week's Focus</SectionHeader>
            <div
              style={{
                background: '#f2efe8',
                borderRadius: '8px',
                padding: '1rem',
                borderLeft: '3px solid #c8f060',
              }}
            >
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0e0d0b', marginBottom: focus.description ? '0.375rem' : 0 }}>
                {focus.title}
              </div>
              {focus.description && (
                <div style={{ fontSize: '0.8125rem', color: '#6b6862', lineHeight: 1.6 }}>
                  {focus.description}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section 4: Intelligence */}
        {intelligence && (
          <section>
            <SectionHeader>Market Intelligence</SectionHeader>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#0e0d0b',
                lineHeight: 1.7,
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              {intelligence}
            </p>
          </section>
        )}

        {/* Section 5: Next steps */}
        {next_steps && next_steps.length > 0 && (
          <section>
            <SectionHeader>Next Steps</SectionHeader>
            <ol
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
              }}
            >
              {next_steps.map((step, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: '#0e0d0b',
                      color: '#f2efe8',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '1px',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', color: '#0e0d0b', lineHeight: 1.5 }}>
                      {step.action}
                    </div>
                    {(step.owner || step.due) && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.75rem',
                          fontSize: '0.75rem',
                          color: '#6b6862',
                          marginTop: '0.2rem',
                        }}
                      >
                        {step.owner && <span>Owner: {step.owner}</span>}
                        {step.due && <span>Due: {step.due}</span>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}

export default WeeklyBriefCard
