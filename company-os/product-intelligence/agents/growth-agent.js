// company-os/product-intelligence/agents/growth-agent.js
// Growth strategy agent — analyzes current user count and recommends next acquisition channels.

import { AgentBase } from '../../../shared/agent-base-class.js'

export class GrowthAgent extends AgentBase {
  constructor() {
    super({
      name: 'growth-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the growth agent.
   *
   * @param {object} context
   * @param {string} context.app_type — 'saas' | 'marketplace' | 'consumer' | 'developer-tools' | 'ecommerce'
   * @param {number} [context.user_count] — current user count
   * @param {string[]} [context.current_channels] — channels already in use
   * @param {string} [context.stage] — 'pre-launch' | 'early' | 'growth' | 'scale'
   * @param {number} [context.mrr] — monthly recurring revenue in USD (if applicable)
   * @returns {{ recommendations: Recommendation[], quick_wins: string[] }}
   */
  async run(context) {
    const {
      app_type = 'saas',
      user_count = 0,
      current_channels = [],
      stage = this.inferStage(user_count),
      mrr = 0,
    } = context

    this.log('info', `Running growth analysis for ${app_type} at stage ${stage} with ${user_count} users`)

    const recommendations = this.buildRecommendations(app_type, stage, user_count, current_channels, mrr)
    const quick_wins = this.buildQuickWins(app_type, stage, current_channels)

    return { recommendations, quick_wins }
  }

  inferStage(user_count) {
    if (user_count === 0) return 'pre-launch'
    if (user_count < 100) return 'early'
    if (user_count < 10000) return 'growth'
    return 'scale'
  }

  buildRecommendations(app_type, stage, user_count, current_channels, mrr) {
    const recs = []
    const allChannels = this.getChannelsForType(app_type)

    for (const channel of allChannels) {
      if (current_channels.includes(channel.id)) continue
      if (channel.min_stage && this.stageOrder(stage) < this.stageOrder(channel.min_stage)) continue

      recs.push({
        channel: channel.id,
        title: channel.title,
        description: channel.description,
        effort: channel.effort,
        expected_impact: channel.expected_impact,
        priority: channel.priority,
        stage_fit: stage,
        rationale: channel.rationale,
      })
    }

    // Sort by priority descending
    recs.sort((a, b) => b.priority - a.priority)

    return recs.slice(0, 8)
  }

  buildQuickWins(app_type, stage, current_channels) {
    const wins = []

    if (!current_channels.includes('seo_landing')) {
      wins.push('Add SEO meta tags to every page — title, description, OG image. 30-minute effort, permanent gain.')
    }
    if (!current_channels.includes('email_capture')) {
      wins.push('Add waitlist or email capture to landing page — every visitor is a potential future user.')
    }
    if (!current_channels.includes('referral')) {
      wins.push('Add a "Share this app" button — even without a formal referral program, sharing reduces CAC.')
    }
    if (stage === 'early' && !current_channels.includes('community')) {
      wins.push('Post in one online community your target users already use — Reddit, Slack, Discord, or a niche forum.')
    }
    if (app_type === 'developer-tools' && !current_channels.includes('github')) {
      wins.push('Create a GitHub repo if not already public — GitHub stars are social proof for developer tools.')
    }
    if (app_type === 'saas' && !current_channels.includes('product_hunt')) {
      wins.push('Schedule a Product Hunt launch — takes 1 day to prepare, can deliver 500+ signups in 24 hours.')
    }
    if (app_type === 'ecommerce' && !current_channels.includes('social_proof')) {
      wins.push('Add customer reviews with photos to your most popular product pages — converts 15–25% better.')
    }

    return wins.slice(0, 5)
  }

  getChannelsForType(app_type) {
    const baseChannels = [
      {
        id: 'seo',
        title: 'SEO — Organic Search',
        description: 'Optimize pages for search engines. Long-tail keywords with clear user intent convert best.',
        effort: 'medium',
        expected_impact: 'high',
        priority: 9,
        min_stage: 'early',
        rationale: 'Compounds over time — the highest ROI channel for most apps at 6+ months.',
      },
      {
        id: 'content_marketing',
        title: 'Content Marketing',
        description: 'Blog posts, tutorials, and guides targeting the exact problems your users have.',
        effort: 'medium',
        expected_impact: 'medium',
        priority: 7,
        min_stage: 'early',
        rationale: 'Builds authority, earns backlinks, and attracts users already searching for solutions.',
      },
      {
        id: 'community',
        title: 'Community Building',
        description: 'Be present in communities where your target users already gather.',
        effort: 'low',
        expected_impact: 'medium',
        priority: 8,
        min_stage: 'pre-launch',
        rationale: 'Lowest CAC at early stage — trust is already present in communities.',
      },
      {
        id: 'referral',
        title: 'Referral Program',
        description: 'Incentivize existing users to invite others — give $10, get $10 or similar.',
        effort: 'medium',
        expected_impact: 'high',
        priority: 8,
        min_stage: 'early',
        rationale: 'Viral coefficient above 1.0 means your users pay for acquisition themselves.',
      },
      {
        id: 'email_capture',
        title: 'Email List / Waitlist',
        description: 'Capture emails from visitors before they leave. Nurture with value-first sequences.',
        effort: 'low',
        expected_impact: 'high',
        priority: 9,
        min_stage: 'pre-launch',
        rationale: 'Email has the highest ROI of any marketing channel ($36 for every $1 spent, DMA 2023).',
      },
    ]

    const channelsByType = {
      saas: [
        ...baseChannels,
        {
          id: 'product_hunt',
          title: 'Product Hunt Launch',
          description: 'Launch on Product Hunt for tech-savvy early adopters and press coverage.',
          effort: 'low',
          expected_impact: 'high',
          priority: 8,
          min_stage: 'early',
          rationale: '500–3000 signups in 24 hours is typical for a well-prepared launch.',
        },
        {
          id: 'integration_marketplace',
          title: 'Integration Marketplace Listings',
          description: 'List in Zapier, Make, or partner app stores where your target buyers already are.',
          effort: 'medium',
          expected_impact: 'medium',
          priority: 6,
          min_stage: 'growth',
          rationale: 'Inbound from buyers already looking for solutions in adjacent tools.',
        },
      ],
      'developer-tools': [
        ...baseChannels,
        {
          id: 'github',
          title: 'GitHub Open Source',
          description: 'Make the project or a version of it open source. GitHub stars = trust.',
          effort: 'low',
          expected_impact: 'high',
          priority: 9,
          min_stage: 'pre-launch',
          rationale: 'Developer tools that are OSS get 10x more discovery than closed-source equivalents.',
        },
        {
          id: 'hacker_news',
          title: 'Hacker News Show HN',
          description: 'Post a Show HN when you have something working. 10–30% of dev tool startups get their first 1000 users this way.',
          effort: 'low',
          expected_impact: 'high',
          priority: 9,
          min_stage: 'early',
          rationale: 'HN readers are the exact ICP for developer tools — technical, influential, early adopters.',
        },
      ],
      marketplace: [
        ...baseChannels,
        {
          id: 'supply_seeding',
          title: 'Supply-Side Seeding',
          description: 'Personally recruit top sellers or service providers with white-glove onboarding.',
          effort: 'high',
          expected_impact: 'high',
          priority: 10,
          min_stage: 'pre-launch',
          rationale: 'You cannot attract buyers to an empty marketplace. Solve supply first, always.',
        },
      ],
      consumer: [
        ...baseChannels,
        {
          id: 'influencer_seeding',
          title: 'Influencer Seeding',
          description: 'Find 50 power users in your niche and give them early access. Their audience becomes yours.',
          effort: 'medium',
          expected_impact: 'high',
          priority: 9,
          min_stage: 'pre-launch',
          rationale: "Instagram's growth was driven entirely by photography influencers in the first 6 months.",
        },
      ],
      ecommerce: [
        ...baseChannels,
        {
          id: 'paid_social',
          title: 'Paid Social (Meta / TikTok)',
          description: 'Run conversion campaigns on Meta or TikTok targeting lookalike audiences.',
          effort: 'medium',
          expected_impact: 'high',
          priority: 7,
          min_stage: 'growth',
          rationale: 'Scalable with positive ROAS once you have product-market fit and a proven AOV.',
        },
      ],
    }

    return channelsByType[app_type] || baseChannels
  }

  stageOrder(stage) {
    const order = { 'pre-launch': 0, early: 1, growth: 2, scale: 3 }
    return order[stage] ?? 0
  }

  async verify(output) {
    if (!output.recommendations || !Array.isArray(output.recommendations)) {
      throw new Error('GrowthAgent: recommendations must be an array')
    }
    if (!output.quick_wins || !Array.isArray(output.quick_wins)) {
      throw new Error('GrowthAgent: quick_wins must be an array')
    }
    return output
  }
}

export default GrowthAgent
