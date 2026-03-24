// company-os/product-intelligence/agents/marketing-agent.js
// Marketing channel recommendation agent — returns channel mix, messaging, and budget allocation.

import { AgentBase } from '../../../shared/agent-base-class.js'

export class MarketingAgent extends AgentBase {
  constructor() {
    super({
      name: 'marketing-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the marketing agent.
   *
   * @param {object} context
   * @param {string} [context.app_type] — 'saas' | 'marketplace' | 'consumer' | 'ecommerce' | 'developer-tools' | 'social'
   * @param {string} [context.stage] — 'pre-launch' | 'early' | 'growth' | 'scale'
   * @param {string} [context.target_audience] — description of target user
   * @param {string} [context.value_proposition] — core value prop in one sentence
   * @param {number} [context.monthly_budget_usd] — marketing budget per month
   * @param {string} [context.primary_goal] — 'signups' | 'revenue' | 'awareness' | 'retention'
   * @returns {{ channels: Channel[], messaging: object, budget_allocation: object }}
   */
  async run(context) {
    const {
      app_type = 'saas',
      stage = 'early',
      target_audience = '',
      value_proposition = '',
      monthly_budget_usd = 0,
      primary_goal = 'signups',
    } = context

    this.log('info', `Running marketing strategy for ${app_type} at ${stage} with $${monthly_budget_usd}/mo budget`)

    const channels = this.selectChannels(app_type, stage, monthly_budget_usd, primary_goal)
    const messaging = this.buildMessagingFramework(app_type, target_audience, value_proposition)
    const budget_allocation = this.allocateBudget(channels, monthly_budget_usd, stage)

    return {
      channels,
      messaging,
      budget_allocation,
    }
  }

  selectChannels(app_type, stage, budget, primary_goal) {
    const allChannels = this.getChannelLibrary()

    // Filter by app type and stage
    const eligible = allChannels.filter(c => {
      if (c.min_budget_usd && budget < c.min_budget_usd) return false
      if (c.stages && !c.stages.includes(stage)) return false
      if (c.app_types && !c.app_types.includes(app_type) && !c.app_types.includes('all')) return false
      return true
    })

    // Sort by fit for goal
    const goalWeights = {
      signups: { cac: 3, awareness: 1, retention: 0 },
      revenue: { cac: 2, awareness: 1, retention: 2 },
      awareness: { awareness: 3, cac: 1, retention: 0 },
      retention: { retention: 3, cac: 1, awareness: 0 },
    }
    const weights = goalWeights[primary_goal] || goalWeights.signups

    eligible.sort((a, b) => {
      const scoreA = Object.entries(weights).reduce((s, [k, w]) => s + (a.scores?.[k] || 0) * w, 0)
      const scoreB = Object.entries(weights).reduce((s, [k, w]) => s + (b.scores?.[k] || 0) * w, 0)
      return scoreB - scoreA
    })

    return eligible.slice(0, 6)
  }

  getChannelLibrary() {
    return [
      {
        id: 'content_seo',
        name: 'Content Marketing + SEO',
        description: 'Blog posts, tutorials, and landing pages targeting high-intent search keywords.',
        effort: 'medium',
        timeline_to_results: '3–6 months',
        min_budget_usd: 0,
        stages: ['pre-launch', 'early', 'growth', 'scale'],
        app_types: ['all'],
        scores: { cac: 3, awareness: 2, retention: 1 },
        tactics: [
          'Publish 2 articles per month targeting your ICP\'s top 3 job-to-be-done searches',
          'Build a comparison page for top 2–3 competitors',
          'Create a free tool or template that earns backlinks',
        ],
        kpis: ['Organic traffic', 'Keyword rankings', 'Demo/trial bookings from organic'],
      },
      {
        id: 'product_hunt',
        name: 'Product Hunt Launch',
        description: 'One-day launch on Product Hunt for early adopter signups and press.',
        effort: 'low',
        timeline_to_results: '1 day',
        min_budget_usd: 0,
        stages: ['early'],
        app_types: ['saas', 'consumer', 'developer-tools'],
        scores: { cac: 3, awareness: 3, retention: 0 },
        tactics: [
          'Build an audience on Twitter/X for 4 weeks before launch',
          'Schedule the launch for a Tuesday at 12:01am PT',
          'Prepare a 3-minute demo video and feature gallery',
          'Email your existing waitlist to upvote on launch day',
        ],
        kpis: ['Daily rank', 'Signups from PH link', 'Newsletter subscribers'],
      },
      {
        id: 'email_marketing',
        name: 'Email Marketing',
        description: 'Lifecycle and promotional emails to convert, retain, and re-engage users.',
        effort: 'medium',
        timeline_to_results: '1–4 weeks',
        min_budget_usd: 0,
        stages: ['pre-launch', 'early', 'growth', 'scale'],
        app_types: ['all'],
        scores: { cac: 2, awareness: 1, retention: 3 },
        tactics: [
          'Onboarding sequence: D0, D1, D3, D7, D14, D30',
          'Weekly or bi-weekly product newsletter for active users',
          'Win-back sequence for 60-day inactive users',
        ],
        kpis: ['Open rate (target >25%)', 'Click rate (target >3%)', 'Revenue per email'],
      },
      {
        id: 'paid_search',
        name: 'Paid Search (Google Ads)',
        description: 'Pay-per-click ads on high-intent search queries from buyers already looking.',
        effort: 'medium',
        timeline_to_results: '2–4 weeks',
        min_budget_usd: 1500,
        stages: ['growth', 'scale'],
        app_types: ['saas', 'ecommerce', 'marketplace'],
        scores: { cac: 2, awareness: 1, retention: 0 },
        tactics: [
          'Start with competitor name keywords + your brand name',
          'Create dedicated landing pages per keyword group — never send to homepage',
          'Track cost per trial/signup, not just cost per click',
        ],
        kpis: ['CPC', 'CTR', 'Cost per trial', 'ROAS'],
      },
      {
        id: 'paid_social',
        name: 'Paid Social (Meta / TikTok)',
        description: 'Image and video ads to drive signups from targeted demographic audiences.',
        effort: 'medium',
        timeline_to_results: '2–6 weeks',
        min_budget_usd: 2000,
        stages: ['growth', 'scale'],
        app_types: ['consumer', 'ecommerce', 'social', 'marketplace'],
        scores: { cac: 2, awareness: 3, retention: 0 },
        tactics: [
          'Start with 3–5 creative variants, kill the bottom 2 after 7 days',
          'Retarget website visitors within 7 days with different creative',
          'Use lookalike audiences based on your top 500 users',
        ],
        kpis: ['CPM', 'CPC', 'Cost per install/signup', 'ROAS'],
      },
      {
        id: 'community',
        name: 'Community-Led Growth',
        description: 'Be present and helpful in communities where your target users already gather.',
        effort: 'low',
        timeline_to_results: '2–8 weeks',
        min_budget_usd: 0,
        stages: ['pre-launch', 'early', 'growth'],
        app_types: ['all'],
        scores: { cac: 3, awareness: 2, retention: 1 },
        tactics: [
          'Identify 3 communities (Reddit, Slack, Discord, LinkedIn groups) where your ICP is active',
          'Spend 4 weeks answering questions and providing value before mentioning your product',
          'Create a public Slack or Discord for your own users to connect',
        ],
        kpis: ['Community members', 'Signups from community links', 'Brand mentions'],
      },
      {
        id: 'influencer_seeding',
        name: 'Influencer / Creator Seeding',
        description: 'Give early access to creators who have the exact audience you want.',
        effort: 'medium',
        timeline_to_results: '2–6 weeks',
        min_budget_usd: 500,
        stages: ['pre-launch', 'early', 'growth'],
        app_types: ['consumer', 'saas', 'ecommerce', 'social'],
        scores: { cac: 2, awareness: 3, retention: 0 },
        tactics: [
          'Target micro-influencers (5k–50k followers) — better engagement and lower cost than macro',
          'Offer free pro access, not cash — you want authentic advocates, not paid posts',
          'Provide a unique discount code to track conversions from each creator',
        ],
        kpis: ['Reach', 'Signups per creator', 'CAC from creator channel'],
      },
      {
        id: 'referral_program',
        name: 'Referral Program',
        description: 'Incentivize existing users to invite others — the only channel with negative CAC.',
        effort: 'medium',
        timeline_to_results: '4–8 weeks',
        min_budget_usd: 0,
        stages: ['early', 'growth', 'scale'],
        app_types: ['all'],
        scores: { cac: 3, awareness: 1, retention: 2 },
        tactics: [
          'Double-sided reward: "Give a friend 20% off, get $20 credit" — both sides win',
          'Trigger the referral prompt at the moment of delight (just after first success)',
          'Make sharing the product itself (not just a referral link) a core feature',
        ],
        kpis: ['K-factor (referrals per user)', 'Referred CAC vs other channels', 'Referral conversion rate'],
      },
      {
        id: 'partnerships',
        name: 'Strategic Partnerships',
        description: 'Distribution partnerships with tools your users already pay for.',
        effort: 'high',
        timeline_to_results: '2–6 months',
        min_budget_usd: 0,
        stages: ['growth', 'scale'],
        app_types: ['saas', 'developer-tools'],
        scores: { cac: 2, awareness: 2, retention: 1 },
        tactics: [
          'Identify 5 non-competing tools with overlapping user bases',
          'Propose co-marketing: joint webinar, integration, or newsletter swap',
          'Build a native integration and get listed in their app marketplace',
        ],
        kpis: ['Partner-referred signups', 'Integration adoption rate', 'Co-marketing reach'],
      },
    ]
  }

  buildMessagingFramework(app_type, targetAudience, valueProp) {
    const frameworks = {
      saas: {
        headline_formula: '[Outcome] without [Pain] — [Time/Effort]',
        headline_example: valueProp || 'Ship your app in days, not months',
        subheadline_focus: 'Eliminate the biggest friction in the workflow your users hate most',
        cta_primary: 'Start free' or 'Get started',
        cta_secondary: 'See how it works',
        social_proof_format: 'X companies use [App] to [Outcome]',
        objection_handling: [
          'How long does it take to set up? → Under 10 minutes.',
          'Do I need to know how to code? → No. [App] handles the technical setup.',
          'What if I outgrow it? → Pricing scales with you. Start free.',
        ],
      },
      consumer: {
        headline_formula: '[Verb] [Desire] — [Social proof or speed]',
        headline_example: valueProp || 'Look amazing on camera. Every time.',
        subheadline_focus: 'Lead with the emotional outcome, not the feature',
        cta_primary: 'Try for free',
        cta_secondary: 'See examples',
        social_proof_format: 'Join X people who [have achieved outcome]',
        objection_handling: [
          'Is it free? → Free to start. Pro features from $X/mo.',
          'Is it safe? → Your data is yours. We never sell it.',
        ],
      },
      ecommerce: {
        headline_formula: '[Product] that [Unique Benefit]',
        headline_example: valueProp || 'The [category] built for [specific use case]',
        subheadline_focus: 'Show the product in use — not on a white background',
        cta_primary: 'Shop now',
        cta_secondary: 'See reviews',
        social_proof_format: 'X five-star reviews',
        objection_handling: [
          'Free shipping? → Free shipping on orders over $X.',
          'Easy returns? → 30-day hassle-free returns.',
          'Is this good quality? → [Number] verified reviews.',
        ],
      },
      'developer-tools': {
        headline_formula: 'The [category] tool that [specific technical outcome]',
        headline_example: valueProp || 'Ship [task] in one command',
        subheadline_focus: 'Show a real code example in the first 10 seconds',
        cta_primary: 'npm install [package]' or 'Get started',
        cta_secondary: 'Read the docs',
        social_proof_format: 'X GitHub stars. Used at [Company A], [Company B].',
        objection_handling: [
          'Does it work with [framework]? → Yes. [Link to integration docs].',
          'What\'s the license? → MIT.',
          'Is it maintained? → [X] releases in the last 30 days.',
        ],
      },
    }

    return frameworks[app_type] || frameworks.saas
  }

  allocateBudget(channels, totalBudget, stage) {
    if (totalBudget === 0) {
      return {
        total: 0,
        note: 'No budget set — all channels are organic/free. Focus on SEO and community first.',
        allocation: channels.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {}),
      }
    }

    // Paid channels get budget; organic channels get 0
    const paidChannels = channels.filter(c => c.min_budget_usd && c.min_budget_usd > 0)
    const organicChannels = channels.filter(c => !c.min_budget_usd)

    if (paidChannels.length === 0) {
      return {
        total: totalBudget,
        note: 'Budget available but no paid channels selected — allocate to content creation and tooling.',
        allocation: { content_creation: Math.round(totalBudget * 0.7), tools_and_software: Math.round(totalBudget * 0.3) },
      }
    }

    // Allocate proportionally by channel score
    const totalScore = paidChannels.reduce((s, c) => s + (c.scores?.cac || 1), 0)
    const allocation = {}

    for (const c of paidChannels) {
      const share = (c.scores?.cac || 1) / totalScore
      allocation[c.id] = Math.round(totalBudget * share)
    }
    for (const c of organicChannels) {
      allocation[c.id] = 0
    }

    return {
      total: totalBudget,
      currency: 'USD',
      period: 'monthly',
      allocation,
      note: stage === 'early'
        ? 'At early stage, minimize paid spend until you have organic traction and know your CAC.'
        : 'Scale paid channels only after confirming positive ROAS on a small test budget first.',
    }
  }

  async verify(output) {
    if (!Array.isArray(output.channels)) throw new Error('MarketingAgent: channels must be an array')
    if (typeof output.messaging !== 'object') throw new Error('MarketingAgent: messaging must be an object')
    if (typeof output.budget_allocation !== 'object') throw new Error('MarketingAgent: budget_allocation must be an object')
    return output
  }
}

export default MarketingAgent
