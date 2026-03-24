// company-os/dashboard/components/AgentCard.tsx
// Individual card for an intelligence agent — shows icon, name, description,
// active state badge, and activate button

import { type FC } from 'react'

interface Agent {
  id: string
  name: string
  description: string
  icon: string
}

interface AgentCardProps {
  agent: Agent
  active: boolean
  onActivate: () => void
}

export const AgentCard: FC<AgentCardProps> = ({ agent, active, onActivate }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        borderRadius: '12px',
        border: active
          ? '1px solid rgba(200,240,96,0.6)'
          : '1px solid rgba(14,13,11,0.08)',
        background: active ? 'rgba(200,240,96,0.06)' : '#fff',
        transition: 'all 200ms ease',
        gap: '12px',
      }}
    >
      {/* Icon + name + active badge row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '24px',
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {agent.icon}
          </span>
          <h3
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: '15px',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: 0,
            }}
          >
            {agent.name}
          </h3>
        </div>

        {active && (
          <span
            style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#15803d',
              background: '#c8f060',
              padding: '2px 8px',
              borderRadius: '100px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Active
          </span>
        )}
      </div>

      {/* Description */}
      <p
        style={{
          fontFamily: '"DM Mono", monospace',
          fontSize: '12px',
          lineHeight: 1.6,
          color: '#6b6862',
          margin: 0,
          flexGrow: 1,
        }}
      >
        {agent.description}
      </p>

      {/* Activate button — only shown when not yet active */}
      {!active && (
        <button
          onClick={onActivate}
          type="button"
          aria-label={`Activate ${agent.name}`}
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '12px',
            fontWeight: 600,
            color: '#0e0d0b',
            background: '#c8f060',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 14px',
            cursor: 'pointer',
            alignSelf: 'flex-start',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#b8e050'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = '#c8f060'
          }}
        >
          Activate agent
        </button>
      )}
    </div>
  )
}

export default AgentCard
