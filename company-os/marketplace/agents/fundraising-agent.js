// company-os/marketplace/agents/fundraising-agent.js — Funding readiness assessment agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class FundraisingAgent extends AgentBase {
  constructor() {
    super({ name: 'fundraising-agent', phase: 'fundraising', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {number} [context.mrr]
   * @param {number} [context.mom_growth_rate] — month-over-month as decimal e.g. 0.15
   * @param {number} [context.user_count]
   * @param {number} [context.team_size]
   * @param {boolean} [context.has_technical_founder]
   * @param {string} [context.stage] — 'pre-seed' | 'seed' | 'series-a'
   * @param {string} [context.industry]
   * @param {number} [context.tam] — total addressable market in USD
   * @param {boolean} [context.has_deck]
   * @param {boolean} [context.has_metrics_dashboard]
   * @param {number} [context.months_runway]
   * @returns {{ readiness_score: number, gaps: string[], pitch_template: string, top_investors: string[] }}
   */
  async run(context) {
    this.log('info', 'Running fundraising readiness assessment', { stage: context.stage })

    const { readiness_score, scoring_breakdown } = this._computeReadinessScore(context)
    const gaps = this._identifyGaps(context, scoring_breakdown)
    const pitch_template = this._buildPitchTemplate(context)
    const top_investors = this._buildTopInvestors(context)

    this.log('info', 'Fundraising assessment complete', { readiness_score })

    return {
      readiness_score,
      gaps,
      pitch_template,
      top_investors,
    }
  }

  _computeReadinessScore(context) {
    const scoring_breakdown = {}
    let score = 0

    // Team (25 points)
    if (context.has_technical_founder) { score += 10; scoring_breakdown.technical_founder = 10 }
    if (context.team_size >= 2) { score += 10; scoring_breakdown.team_size = 10 }
    if (context.team_size >= 3) { score += 5; scoring_breakdown.team_bonus = 5 }

    // Traction (35 points)
    if (context.user_count > 0) { score += 5; scoring_breakdown.any_users = 5 }
    if (context.user_count >= 100) { score += 5; scoring_breakdown.users_100 = 5 }
    if (context.user_count >= 1000) { score += 5; scoring_breakdown.users_1000 = 5 }
    if (context.mrr > 0) { score += 5; scoring_breakdown.any_revenue = 5 }
    if (context.mrr >= 1000) { score += 5; scoring_breakdown.mrr_1k = 5 }
    if (context.mrr >= 10000) { score += 5; scoring_breakdown.mrr_10k = 5 }
    if (context.mom_growth_rate >= 0.10) { score += 5; scoring_breakdown.growth_rate = 5 }

    // Market (20 points)
    if (context.tam && context.tam >= 1e9) { score += 10; scoring_breakdown.large_tam = 10 }
    else if (context.tam && context.tam >= 1e8) { score += 5; scoring_breakdown.medium_tam = 5 }
    if (context.industry) { score += 5; scoring_breakdown.industry_defined = 5 }
    if (context.has_paying_customers) { score += 5; scoring_breakdown.paying_customers = 5 }

    // Preparation (20 points)
    if (context.has_deck) { score += 8; scoring_breakdown.has_deck = 8 }
    if (context.has_metrics_dashboard) { score += 7; scoring_breakdown.has_metrics = 7 }
    if (context.months_runway >= 6) { score += 5; scoring_breakdown.runway = 5 }

    return { readiness_score: Math.min(100, score), scoring_breakdown }
  }

  _identifyGaps(context, scoring) {
    const gaps = []

    if (!context.has_technical_founder) gaps.push('No technical co-founder — investors fund teams, not ideas. This is the most common pre-seed rejection reason.')
    if (!context.team_size || context.team_size < 2) gaps.push('Solo founder increases perceived risk significantly. Investors prefer teams of 2–3 at seed.')
    if (!context.mrr || context.mrr < 1000) gaps.push('No meaningful revenue yet. Pre-seed without revenue needs exceptional team or problem insight. Seed requires $1k+ MRR.')
    if (!context.mom_growth_rate || context.mom_growth_rate < 0.10) gaps.push('Growth rate below 10% MoM — investors fund growth, not size. Double growth rate before fundraising.')
    if (!context.has_deck) gaps.push('No pitch deck — create a 10-slide deck: Problem, Solution, Market, Product, Traction, Team, Financials, Ask.')
    if (!context.has_metrics_dashboard) gaps.push('No metrics dashboard — investors will ask for a metrics email within 24 hours. Build a simple Notion or Baremetrics dashboard first.')
    if (!context.months_runway || context.months_runway < 6) gaps.push('Less than 6 months runway — fundraising takes 3–6 months. Extend runway before starting the process.')
    if (!context.tam || context.tam < 1e8) gaps.push('Market size not documented — prepare a bottom-up TAM calculation. Minimum $100M TAM for pre-seed.')

    return gaps
  }

  _buildPitchTemplate(context) {
    const stage = context.stage ?? 'seed'
    return `${stage.toUpperCase()} PITCH DECK TEMPLATE (10 slides)

Slide 1 — COVER: Company name, one-line tagline, founder name. No logos. No decorations.

Slide 2 — PROBLEM: One specific customer, one painful moment. Make it visceral. Investors fund problems they believe in.

Slide 3 — SOLUTION: What you built. One screenshot or demo GIF. One sentence on what makes it different.

Slide 4 — MARKET: Bottom-up TAM ($${context.tam ? (context.tam / 1e9).toFixed(1) + 'B' : 'X'}). SAM (serviceable). SOM (your 3-year target). Show the math.

Slide 5 — PRODUCT: 3 screenshots or a 60-second demo link. Show the actual product, not mockups.

Slide 6 — TRACTION: The most important slide. MRR, growth rate, active users, logos if notable. If pre-revenue: LOIs, pilot commitments, or waitlist size with conversion intent.

Slide 7 — BUSINESS MODEL: How you make money. Pricing tiers. Unit economics (CAC, LTV, payback period) if available.

Slide 8 — GO-TO-MARKET: First channel that is working. One or two channels, not ten. Show distribution insight.

Slide 9 — TEAM: Photo + 1 line per founder. Lead with relevant credibility. Not your full resume.

Slide 10 — THE ASK: How much you are raising. What it buys (milestones in 18 months). Use of funds (high level: 60% eng, 20% GTM, 20% ops). Previous rounds if any.

APPENDIX (optional): Competition slide, detailed financials, technical architecture.

PITCH RULES: Max 10 slides in the main deck. 16pt minimum font. No bullet points with more than 5 words. Every claim needs a number.`
  }

  _buildTopInvestors(context) {
    const stage = context.stage ?? 'seed'
    const industry = context.industry ?? ''
    const baseList = []

    if (stage === 'pre-seed') {
      baseList.push('Y Combinator (YC) — batch program, $500k, best network in the world')
      baseList.push('Tiny Seed — SaaS bootstrapper-friendly, $120k, no growth-at-all-costs pressure')
      baseList.push('Pioneer.app — competitive program for pre-product founders')
      baseList.push('South Park Commons — community-first, good for technical founders exploring ideas')
      baseList.push('Indie.vc — profitability-focused alternative to traditional VC')
    } else if (stage === 'seed') {
      baseList.push('Y Combinator — $500k standard deal, best accelerator network globally')
      baseList.push('First Round Capital — legendary seed fund, operator-heavy portfolio')
      baseList.push('Pear VC — early-stage focus, strong technical founder thesis')
      baseList.push('Precursor Ventures — high conviction pre-traction bets')
      baseList.push('Hustle Fund — fast decisions, operator perspective')
      baseList.push('Backstage Capital — mission-driven, diverse founder focus')
    } else {
      baseList.push('Benchmark — conviction-based, founder-friendly, no board manipulation')
      baseList.push('Sequoia Capital — best for B2B SaaS and infrastructure')
      baseList.push('Andreessen Horowitz (a16z) — media reach, recruiting help, large fund')
      baseList.push('Bessemer Venture Partners — SaaS-first, predictable MRR thesis')
      baseList.push('Index Ventures — strong European + US network')
    }

    if (industry.toLowerCase().includes('fintech')) {
      baseList.push('Ribbit Capital — fintech-specialist, strong sector expertise')
      baseList.push('Plaid Fund — fintech infrastructure focus')
    }

    if (industry.toLowerCase().includes('health')) {
      baseList.push('a16z Bio — dedicated health and bio fund')
      baseList.push('Andreessen Horowitz (health) — strong clinical + digital health portfolio')
    }

    return baseList
  }
}

export default FundraisingAgent
