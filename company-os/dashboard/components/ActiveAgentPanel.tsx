// company-os/dashboard/components/ActiveAgentPanel.tsx
// Panel showing active agent status, last run time, and latest output summary

import { type FC } from 'react'

interface ActiveAgentPanelProps {
  agentId: string
  agentName: string
  lastRun?: string
  output?: object
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function renderOutputValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.slice(0, 3).join(', ') + (value.length > 3 ? '…' : '')
  if (value === null || value === undefined) return '—'
  return String(value)
}

export const ActiveAgentPanel: FC<ActiveAgentPanelProps> = ({
  agentId,
  agentName,
  lastRun,
  output,
}) => {
  const outputEntries = output ? Object.entries(output).slice(0, 6) : []

  return (
    <div
      style={{
        padding: '20px 24px',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid rgba(200,240,96,0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Agent header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Active pulse indicator */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              flexShrink: 0,
            }}
          />
          <h3
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: '15px',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: 0,
            }}
          >
            {agentName}
          </h3>
          <code
            style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '10px',
              color: '#6b6862',
              background: 'rgba(14,13,11,0.05)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {agentId}
          </code>
        </div>

        {lastRun && (
          <span
            style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '11px',
              color: '#6b6862',
              whiteSpace: 'nowrap',
            }}
          >
            Last run: {formatRelativeTime(lastRun)}
          </span>
        )}
      </div>

      {/* Output summary */}
      {outputEntries.length > 0 ? (
        <div>
          <p
            style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#6b6862',
              margin: '0 0 10px',
            }}
          >
            Latest output
          </p>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: '16px',
              rowGap: '6px',
              margin: 0,
            }}
          >
            {outputEntries.map(([key, value]) => (
              <div
                key={key}
                style={{ display: 'contents' }}
              >
                <dt
                  style={{
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '11px',
                    color: '#6b6862',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {key.replace(/_/g, ' ')}
                </dt>
                <dd
                  style={{
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '11px',
                    color: '#0e0d0b',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {renderOutputValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '12px',
            color: '#94a3b8',
            margin: 0,
          }}
        >
          No output yet — agent has not run. Trigger a manual run or wait for the next scheduled run.
        </p>
      )}
    </div>
  )
}

export default ActiveAgentPanel
