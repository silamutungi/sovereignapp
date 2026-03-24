// agents/vision/ceo-agent.js
// Applies Marty Cagan INSPIRED frameworks: outcome-based OKRs, continuous discovery,
// empowered product teams. Returns StrategySpec.
import { AgentBase } from '../../shared/agent-base-class.js'

export class CEOAgent extends AgentBase {
  constructor() {
    super({ name: 'ceo-agent', phase: 'vision', version: '1.0.0' })
  }

  async run(context) {
    const { brief, insights } = context
    this.log('info', 'Building go-to-market strategy and positioning')

    const positioning = this.buildPositioning(brief, insights)
    const valueProp = this.buildValueProp(brief, insights)
    const gtm = this.buildGTM(brief)
    const okrs = this.buildOKRs(brief, insights)
    const pricingHint = this.inferPricingHint(brief)

    return {
      positioning,
      value_proposition: valueProp,
      go_to_market: gtm,
      okrs,
      pricing_hint: pricingHint,
      cagan_principle: 'Outcome over output — measure what changes in user behavior',
    }
  }

  buildPositioning(brief, insights) {
    const competitor = this.inferCompetitor(brief)
    return {
      category: this.inferCategory(brief),
      target_customer: brief?.target_user || 'professionals',
      problem: brief?.problem_statement?.slice(0, 120) || 'inefficient workflows',
      solution: `${brief?.app_name} is the only tool that ${insights?.differentiators?.[0] || 'puts your users first'}`,
      alternative: competitor,
      statement: `For ${brief?.target_user || 'teams'} who need ${brief?.problem_statement?.slice(0, 60) || 'better tools'}, ${brief?.app_name} is the ${this.inferCategory(brief)} that ${insights?.core_job_to_be_done || 'gets the job done'}. Unlike ${competitor}, we ${insights?.differentiators?.[0] || 'actually ship'}.`,
    }
  }

  buildValueProp(brief, insights) {
    const primary = insights?.differentiators?.[0] || `${brief?.app_name} saves you time`
    return {
      primary,
      supporting: insights?.differentiators?.slice(1) || [],
      proof_points: [
        'Production-ready on day one',
        'Built-in security — WCAG AA, RLS, rate limiting',
        'No lock-in — you own every line of code',
      ],
    }
  }

  buildGTM(brief) {
    const channel = this.inferChannel(brief)
    return {
      launch_channel: channel,
      launch_sequence: [
        'Soft launch to 10 beta users',
        'Gather qualitative feedback in week 1',
        'Iterate on top 3 friction points',
        'Public launch with social proof',
      ],
      success_metric: 'Week-2 retention > 40%',
    }
  }

  buildOKRs(brief, _insights) {
    return [
      {
        objective: `Validate that ${brief?.app_name} solves a real problem for ${brief?.target_user}`,
        key_results: [
          '10 users complete core workflow without assistance',
          'NPS > 30 after first session',
          '3 users refer at least 1 friend within 2 weeks',
        ],
      },
      {
        objective: 'Ship a reliable, production-grade MVP',
        key_results: [
          'Zero P0 bugs in week 1',
          'Page load < 2s on 4G',
          '100% uptime SLA on core flows',
        ],
      },
    ]
  }

  inferPricingHint(brief) {
    if (brief?.tech_requirements?.includes('Stripe')) {
      return { model: 'freemium', free_limit: 'up to 3 projects', paid: '$12/mo for unlimited' }
    }
    return { model: 'free', note: 'No billing required — add Stripe in phase 2' }
  }

  inferCategory(brief) {
    const idea = (brief?.problem_statement || '').toLowerCase()
    if (idea.includes('crm') || idea.includes('customer')) return 'CRM'
    if (idea.includes('project') || idea.includes('task')) return 'project management tool'
    if (idea.includes('analytics') || idea.includes('dashboard')) return 'analytics platform'
    if (idea.includes('invoice') || idea.includes('billing')) return 'billing tool'
    return 'productivity app'
  }

  inferCompetitor(brief) {
    const idea = (brief?.problem_statement || '').toLowerCase()
    if (idea.includes('task') || idea.includes('project')) return 'Notion'
    if (idea.includes('crm')) return 'HubSpot'
    if (idea.includes('invoice')) return 'FreshBooks'
    return 'generic SaaS tools'
  }

  inferChannel(brief) {
    const idea = (brief?.problem_statement || '').toLowerCase()
    if (idea.includes('developer')) return 'Hacker News, Twitter/X, GitHub'
    if (idea.includes('designer')) return 'Dribbble, Twitter/X, ProductHunt'
    return 'ProductHunt, Twitter/X, LinkedIn'
  }
}

export default async function run(context) {
  return new CEOAgent().execute(context)
}
