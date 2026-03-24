// company-os/dashboard/components/MarketplaceGrid.tsx
// Grid of available marketplace agents showing locked/active state with activate buttons

import { type FC } from 'react'
import { AgentCard } from './AgentCard.js'

interface MarketplaceAgent {
  id: string
  name: string
  description: string
  icon: string
  price?: string
  unlock_condition?: string
  [key: string]: unknown
}

interface MarketplaceGridProps {
  agents: MarketplaceAgent[]
  activeAgentIds: string[]
  onActivate: (agentId: string) => void
}

export const MarketplaceGrid: FC<MarketplaceGridProps> = ({
  agents,
  activeAgentIds,
  onActivate,
}) => {
  const activeSet = new Set(activeAgentIds)

  if (agents.length === 0) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: '#fff',
          borderRadius: '12px',
          border: '1px dashed rgba(14,13,11,0.15)',
        }}
      >
        <p
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '14px',
            color: '#6b6862',
            margin: 0,
          }}
        >
          No marketplace agents available.
        </p>
      </div>
    )
  }

  // Separate active from inactive for display ordering
  const sortedAgents = [...agents].sort((a, b) => {
    const aActive = activeSet.has(a.id) ? 0 : 1
    const bActive = activeSet.has(b.id) ? 0 : 1
    return aActive - bActive
  })

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {sortedAgents.map(agent => {
          const isActive = activeSet.has(agent.id)
          return (
            <div key={agent.id} style={{ position: 'relative' }}>
              <AgentCard
                agent={agent}
                active={isActive}
                onActivate={() => onActivate(agent.id)}
              />
              {/* Price badge */}
              {agent.price && agent.price !== 'free' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '9px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: agent.price === 'enterprise' ? '#7c3aed' : '#1d4ed8',
                    background: agent.price === 'enterprise' ? '#f3e8ff' : '#dbeafe',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                  }}
                >
                  {agent.price}
                </div>
              )}
              {/* Unlock condition tooltip */}
              {agent.unlock_condition && !isActive && (
                <p
                  style={{
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '10px',
                    color: '#94a3b8',
                    margin: '6px 4px 0',
                    lineHeight: 1.4,
                  }}
                >
                  Unlocks when: {agent.unlock_condition}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MarketplaceGrid
