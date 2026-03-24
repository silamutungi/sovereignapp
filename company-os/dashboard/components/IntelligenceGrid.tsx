// company-os/dashboard/components/IntelligenceGrid.tsx
// Grid of active intelligence agent cards

import { type FC } from 'react'
import { AgentCard } from './AgentCard.js'

// Minimal agent manifest — in production this would be fetched from marketplace-registry.json
const AGENT_MANIFEST: Record<string, { name: string; description: string; icon: string }> = {
  'cto-agent': {
    name: 'CTO',
    description: 'Technical architecture review, security audit, dependency analysis, and build health monitoring.',
    icon: '🔧',
  },
  'cmo-agent': {
    name: 'CMO',
    description: 'Marketing strategy, positioning, messaging, SEO recommendations, and growth channel prioritisation.',
    icon: '📣',
  },
  'cfo-agent': {
    name: 'CFO',
    description: 'Financial modelling, unit economics, runway projections, and pricing strategy.',
    icon: '📈',
  },
  'cx-agent': {
    name: 'CX',
    description: 'Customer experience analysis, onboarding flow review, retention recommendations.',
    icon: '🎯',
  },
  'legal-agent': {
    name: 'Legal',
    description: 'Privacy policy generation, terms of service, compliance checklist, GDPR/CCPA guidance.',
    icon: '⚖️',
  },
  'people-agent': {
    name: 'People',
    description: 'Team structure recommendations, hiring plan templates, and culture documentation.',
    icon: '👥',
  },
  'fundraising-agent': {
    name: 'Fundraising',
    description: 'Pitch materials, funding readiness assessment, investor outreach templates.',
    icon: '💰',
  },
  'data-agent': {
    name: 'Data Intelligence',
    description: 'Product analytics, funnel analysis, A/B test recommendations, and conversion optimisation.',
    icon: '📊',
  },
  'partnership-agent': {
    name: 'Partnership Scout',
    description: 'Strategic partnership opportunities, outreach scripts, and partnership pipeline tracking.',
    icon: '🤝',
  },
}

function getAgentData(agentId: string) {
  return (
    AGENT_MANIFEST[agentId] ?? {
      name: agentId,
      description: 'Intelligence agent',
      icon: '🤖',
    }
  )
}

interface IntelligenceGridProps {
  agents: string[]
  onAgentClick: (agentId: string) => void
}

export const IntelligenceGrid: FC<IntelligenceGridProps> = ({ agents, onAgentClick }) => {
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
          No intelligence agents active yet. Activate agents from the marketplace below.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px',
      }}
    >
      {agents.map(agentId => {
        const agentData = getAgentData(agentId)
        return (
          <AgentCard
            key={agentId}
            agent={{ id: agentId, ...agentData }}
            active={true}
            onActivate={() => onAgentClick(agentId)}
          />
        )
      })}
    </div>
  )
}

export default IntelligenceGrid
