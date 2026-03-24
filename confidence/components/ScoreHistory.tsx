import { type FC } from 'react'

interface HistoryEntry {
  timestamp: string
  overall_score: number
}

interface Props {
  history: HistoryEntry[]
}

const WIDTH = 480
const HEIGHT = 160
const PADDING = { top: 16, right: 24, bottom: 32, left: 36 }

function formatDate(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function trendDirection(history: HistoryEntry[]): 'up' | 'down' | 'flat' {
  if (history.length < 2) return 'flat'
  const last = history[history.length - 1].overall_score
  const prev = history[history.length - 2].overall_score
  if (last > prev) return 'up'
  if (last < prev) return 'down'
  return 'flat'
}

const ScoreHistory: FC<Props> = ({ history }) => {
  if (!history || history.length === 0) {
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
        No history yet.
      </div>
    )
  }

  const scores = history.map(h => h.overall_score)
  const minScore = Math.max(0, Math.min(...scores) - 10)
  const maxScore = Math.min(100, Math.max(...scores) + 10)
  const innerW = WIDTH - PADDING.left - PADDING.right
  const innerH = HEIGHT - PADDING.top - PADDING.bottom

  const xScale = (i: number) =>
    PADDING.left + (history.length === 1 ? innerW / 2 : (i / (history.length - 1)) * innerW)

  const yScale = (score: number) =>
    PADDING.top + innerH - ((score - minScore) / (maxScore - minScore)) * innerH

  const points = history.map((h, i) => ({ x: xScale(i), y: yScale(h.overall_score), ...h }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(PADDING.top + innerH).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} Z`

  const trend = trendDirection(history)
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b6862'
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const latestScore = scores[scores.length - 1]

  return (
    <div style={{ fontFamily: 'DM Mono, monospace' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <span style={{ fontSize: '0.875rem', color: '#0e0d0b', fontWeight: 600 }}>
          Score History
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: trendColor }}>
            {trendArrow}
          </span>
          <span style={{ fontSize: '0.875rem', color: trendColor, fontWeight: 600 }}>
            {latestScore}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6b6862' }}>/ 100</span>
        </div>
      </div>

      {/* SVG chart */}
      <svg
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ display: 'block', overflow: 'visible' }}
        aria-label="Score history chart"
      >
        {/* Y-axis gridlines */}
        {[0, 25, 50, 75, 100]
          .filter(v => v >= minScore && v <= maxScore)
          .map(v => {
            const y = yScale(v)
            return (
              <g key={v}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={PADDING.left + innerW}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
                <text
                  x={PADDING.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#6b6862"
                  fontFamily="DM Mono, monospace"
                >
                  {v}
                </text>
              </g>
            )
          })}

        {/* Area fill */}
        <path d={areaPath} fill="#c8f060" opacity={0.15} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#84cc16"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#84cc16" stroke="#fff" strokeWidth={2} />
            {/* X-axis label */}
            <text
              x={p.x}
              y={PADDING.top + innerH + 20}
              textAnchor="middle"
              fontSize={10}
              fill="#6b6862"
              fontFamily="DM Mono, monospace"
            >
              {formatDate(p.timestamp)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default ScoreHistory
