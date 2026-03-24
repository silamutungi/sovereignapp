import { useState, type FC } from 'react'
import CoachCard from './CoachCard.js'
import CoachEmptyState from './CoachEmptyState.js'

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
  category?: string
}

interface Props {
  buildId: string
  recommendations: Recommendation[]
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

function sortRecs(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority.toLowerCase()] ?? 5
    const pb = PRIORITY_ORDER[b.priority.toLowerCase()] ?? 5
    return pa - pb
  })
}

function groupByCategory(recs: Recommendation[]): Record<string, Recommendation[]> {
  const groups: Record<string, Recommendation[]> = {}
  for (const rec of recs) {
    const cat = rec.category ?? 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(rec)
  }
  return groups
}

const CoachPanel: FC<Props> = ({ buildId, recommendations }) => {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  const visible = sortRecs(recommendations).filter((_, i) => !dismissed.has(i))
  const groups = groupByCategory(visible)
  const categories = Object.keys(groups).sort()

  return (
    <aside
      aria-label="Coach recommendations"
      style={{
        width: '100%',
        maxWidth: '380px',
        fontFamily: 'DM Mono, monospace',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '1rem 1.25rem 0.875rem',
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#0e0d0b',
              margin: 0,
            }}
          >
            Coach
          </h2>
          {visible.length > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                fontFamily: 'DM Mono, monospace',
                color: '#6b6862',
              }}
            >
              {visible.length} recommendation{visible.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: '0.75rem',
            color: '#6b6862',
            margin: '0.25rem 0 0',
          }}
        >
          Build ID: {buildId}
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem 1.25rem',
          background: '#f9fafb',
        }}
      >
        {visible.length === 0 ? (
          <CoachEmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {categories.map(cat => (
              <div key={cat}>
                <div
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6b6862',
                    marginBottom: '0.625rem',
                    paddingBottom: '0.375rem',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {cat}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {groups[cat].map((rec, i) => {
                    // Find global index for dismissal tracking
                    const globalIdx = sortRecs(recommendations).findIndex(
                      r => r.title === rec.title && r.body === rec.body
                    )
                    return (
                      <CoachCard
                        key={`${cat}-${i}`}
                        recommendation={rec}
                        onDismiss={() => setDismissed(prev => new Set([...prev, globalIdx]))}
                        onAction={() => {
                          if (rec.action.url) {
                            window.open(rec.action.url, '_blank', 'noopener,noreferrer')
                          }
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

export default CoachPanel
