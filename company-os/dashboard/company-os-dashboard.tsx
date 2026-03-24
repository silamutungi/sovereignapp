// company-os/dashboard/company-os-dashboard.tsx
// Full Company OS dashboard page — shows app overview, unlock progress, agent grid, marketplace

import { type FC, useState, useEffect } from 'react'
import { CompanyOSHeader } from './components/CompanyOSHeader.js'
import { UnlockProgress } from './components/UnlockProgress.js'
import { IntelligenceGrid } from './components/IntelligenceGrid.js'
import { MarketplaceGrid } from './components/MarketplaceGrid.js'
import { ActiveAgentPanel } from './components/ActiveAgentPanel.js'

// ── Types ────────────────────────────────────────────────────────────────────

interface MarketplaceAgent {
  id: string
  name: string
  description: string
  icon: string
  price?: string
  unlock_condition?: string
}

interface BuildData {
  id: string
  app_name: string
  deploy_url?: string
  confidence_score?: number
  launch_gate_passed?: boolean
  active_agents?: string[]
}

interface CompanyOSDashboardProps {
  buildId: string
}

// ── Functional agents — always available ─────────────────────────────────────

const FUNCTIONAL_AGENTS: MarketplaceAgent[] = [
  {
    id: 'cto-agent',
    name: 'CTO',
    description: 'Technical architecture review, security audit, dependency health, and build quality monitoring.',
    icon: '🔧',
    price: 'free',
  },
  {
    id: 'cmo-agent',
    name: 'CMO',
    description: 'Marketing strategy, SEO recommendations, messaging, positioning, and growth channel analysis.',
    icon: '📣',
    price: 'free',
  },
  {
    id: 'cfo-agent',
    name: 'CFO',
    description: 'Financial modelling, pricing strategy, runway projections, and unit economics analysis.',
    icon: '📈',
    price: 'free',
  },
  {
    id: 'cx-agent',
    name: 'Customer Experience',
    description: 'Onboarding review, retention scoring, support gap analysis, and NPS improvement plan.',
    icon: '🎯',
    price: 'free',
  },
  {
    id: 'legal-agent',
    name: 'Legal',
    description: 'Privacy policy, terms of service, GDPR/CCPA compliance checklist, and cookie policy.',
    icon: '⚖️',
    price: 'free',
  },
  {
    id: 'people-agent',
    name: 'People',
    description: 'Team structure, hiring plan templates, role definitions, and culture documentation.',
    icon: '👥',
    price: 'free',
  },
]

// ── Mock marketplace agents ───────────────────────────────────────────────────

const MARKETPLACE_AGENTS: MarketplaceAgent[] = [
  {
    id: 'fundraising-agent',
    name: 'Fundraising Intelligence',
    description: 'Pitch materials, funding readiness, investor targeting, and Series A gap analysis.',
    icon: '💰',
    price: 'pro',
    unlock_condition: 'Any app with revenue > $0 or 1000+ users',
  },
  {
    id: 'data-agent',
    name: 'Data Intelligence',
    description: 'Product analytics, funnel drop-off, A/B test design, and conversion optimisation.',
    icon: '📊',
    price: 'pro',
    unlock_condition: 'Apps with analytics configured',
  },
  {
    id: 'partnership-agent',
    name: 'Partnership Scout',
    description: 'Strategic partnership targets, outreach scripts, and pipeline tracking.',
    icon: '🤝',
    price: 'pro',
    unlock_condition: 'Apps with B2B or platform features',
  },
  {
    id: 'pr-agent',
    name: 'PR & Media',
    description: 'Press releases, journalist targeting, brand mention monitoring, and story angle generation.',
    icon: '📰',
    price: 'pro',
    unlock_condition: 'Any app post-launch',
  },
  {
    id: 'compliance-agent',
    name: 'Compliance Advisor',
    description: 'SOC 2, HIPAA, GDPR gap analysis and policy template generation.',
    icon: '🛡️',
    price: 'enterprise',
    unlock_condition: 'Apps with user data in regulated industries',
  },
  {
    id: 'localization-agent',
    name: 'Localization Engine',
    description: 'UI translation, regional market analysis, and localisation priority ranking.',
    icon: '🌐',
    price: 'pro',
    unlock_condition: 'Apps with international traffic or i18n setup',
  },
]

// ── Mock coach recommendations ───────────────────────────────────────────────

const COACH_RECOMMENDATIONS = [
  {
    id: '1',
    priority: 'high',
    text: 'Add loading and error states to your Dashboard page — async operations currently show a blank screen on failure.',
    action: 'View UX report',
  },
  {
    id: '2',
    priority: 'medium',
    text: 'Your confidence score would improve significantly by adding unit tests for your page components.',
    action: 'View test report',
  },
  {
    id: '3',
    priority: 'low',
    text: 'Consider adding og:image to your index.html for better social sharing previews.',
    action: 'View SEO report',
  },
]

// ── Dashboard component ───────────────────────────────────────────────────────

export const CompanyOSDashboard: FC<CompanyOSDashboardProps> = ({ buildId }) => {
  const [build, setBuild] = useState<BuildData | null>(null)
  const [activeAgents, setActiveAgents] = useState<string[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load build data
  useEffect(() => {
    async function loadBuild() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/dashboard/builds?id=${buildId}`)
        if (!res.ok) throw new Error(`Failed to load build: ${res.status}`)
        const data = await res.json()
        setBuild(data)
        setActiveAgents(data.active_agents ?? ['cto-agent'])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load build data')
      } finally {
        setIsLoading(false)
      }
    }
    loadBuild()
  }, [buildId])

  function handleActivateAgent(agentId: string) {
    setActiveAgents(prev => (prev.includes(agentId) ? prev : [...prev, agentId]))
  }

  function handleAgentClick(agentId: string) {
    setSelectedAgent(prev => (prev === agentId ? null : agentId))
  }

  const allMarketplaceAgents = [...FUNCTIONAL_AGENTS, ...MARKETPLACE_AGENTS]
  const lockedAgentNames = FUNCTIONAL_AGENTS
    .filter(a => !activeAgents.includes(a.id))
    .map(a => a.name)
  const unlockedAgentNames = FUNCTIONAL_AGENTS
    .filter(a => activeAgents.includes(a.id))
    .map(a => a.name)

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f2efe8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '14px',
            color: '#6b6862',
          }}
        >
          Loading Company OS...
        </p>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error || !build) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f2efe8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px',
        }}
      >
        <p
          style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: '20px',
            color: '#0e0d0b',
            margin: 0,
          }}
        >
          Could not load dashboard
        </p>
        <p
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '13px',
            color: '#6b6862',
            margin: 0,
          }}
        >
          {error ?? 'Build not found'}
        </p>
        <button
          onClick={() => window.location.reload()}
          type="button"
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: '12px',
            background: '#c8f060',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            color: '#0e0d0b',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f2efe8',
        fontFamily: '"DM Mono", monospace',
      }}
    >
      {/* Header */}
      <CompanyOSHeader
        appName={build.app_name}
        deployUrl={build.deploy_url}
        confidenceScore={build.confidence_score}
        launchGatePassed={build.launch_gate_passed}
      />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Unlock progress */}
        <section aria-labelledby="unlock-heading">
          <h2
            id="unlock-heading"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: '18px',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: '0 0 16px',
            }}
          >
            Intelligence Overview
          </h2>
          <UnlockProgress
            unlocked={activeAgents.length}
            total={FUNCTIONAL_AGENTS.length + MARKETPLACE_AGENTS.length}
            unlockedAgents={unlockedAgentNames}
            lockedAgents={lockedAgentNames}
          />
        </section>

        {/* Active agents — selected agent detail panel */}
        {selectedAgent && (
          <section aria-labelledby="agent-detail-heading">
            <h2
              id="agent-detail-heading"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: '18px',
                fontWeight: 700,
                color: '#0e0d0b',
                margin: '0 0 16px',
              }}
            >
              Agent Detail
            </h2>
            <ActiveAgentPanel
              agentId={selectedAgent}
              agentName={
                allMarketplaceAgents.find(a => a.id === selectedAgent)?.name ?? selectedAgent
              }
              lastRun={new Date(Date.now() - 1000 * 60 * 47).toISOString()}
              output={{ status: 'healthy', score: 87, last_check: 'security audit', issues_found: 2 }}
            />
          </section>
        )}

        {/* Active intelligence agents grid */}
        <section aria-labelledby="agents-heading">
          <h2
            id="agents-heading"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: '18px',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: '0 0 16px',
            }}
          >
            Active Intelligence Agents
          </h2>
          <IntelligenceGrid
            agents={activeAgents}
            onAgentClick={handleAgentClick}
          />
        </section>

        {/* Coach recommendations */}
        <section aria-labelledby="coach-heading">
          <h2
            id="coach-heading"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: '18px',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: '0 0 16px',
            }}
          >
            Coach Recommendations
          </h2>
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid rgba(14,13,11,0.08)',
              overflow: 'hidden',
            }}
          >
            {COACH_RECOMMENDATIONS.map((rec, i) => (
              <div
                key={rec.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '16px 20px',
                  borderBottom: i < COACH_RECOMMENDATIONS.length - 1
                    ? '1px solid rgba(14,13,11,0.06)'
                    : 'none',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f97316' : '#94a3b8',
                      flexShrink: 0,
                      marginTop: '5px',
                    }}
                  />
                  <p
                    style={{
                      fontFamily: '"DM Mono", monospace',
                      fontSize: '12px',
                      lineHeight: 1.6,
                      color: '#0e0d0b',
                      margin: 0,
                    }}
                  >
                    {rec.text}
                  </p>
                </div>
                <button
                  type="button"
                  style={{
                    fontFamily: '"DM Mono", monospace',
                    fontSize: '11px',
                    color: '#6b6862',
                    background: 'transparent',
                    border: '1px solid rgba(14,13,11,0.15)',
                    borderRadius: '5px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {rec.action}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Marketplace */}
        <section aria-labelledby="marketplace-heading">
          <h2
            id="marketplace-heading"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontSize: '18px',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: '0 0 4px',
            }}
          >
            Agent Marketplace
          </h2>
          <p
            style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '12px',
              color: '#6b6862',
              margin: '0 0 16px',
            }}
          >
            Activate additional intelligence agents for your app.
          </p>
          <MarketplaceGrid
            agents={allMarketplaceAgents}
            activeAgentIds={activeAgents}
            onActivate={handleActivateAgent}
          />
        </section>

      </main>
    </div>
  )
}

export default CompanyOSDashboard
