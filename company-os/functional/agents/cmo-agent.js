// company-os/functional/agents/cmo-agent.js — CMO marketing strategy agent
// UNLOCKS: when app has marketing pages or 100+ users

import { AgentBase } from '../../../shared/agent-base-class.js'

/**
 * @typedef {object} Channel
 * @property {string} name
 * @property {string} rationale
 * @property {string} priority — 'high' | 'medium' | 'low'
 * @property {string} estimated_cac
 * @property {string[]} tactics
 */

export class CMOAgent extends AgentBase {
  constructor() {
    super({ name: 'cmo-agent', phase: 'marketing-strategy', version: '1.0.0' })
  }

  static isUnlocked(context) {
    return !!(
      context.has_marketing_pages ||
      context.landing_page ||
      (context.user_count != null && context.user_count >= 100)
    )
  }

  /**
   * @param {object} context
   * @param {string} [context.target_user] — who the app is for
   * @param {string} [context.value_proposition] — core benefit
   * @param {string} [context.revenue_model]
   * @param {number} [context.user_count]
   * @param {string[]} [context.features]
   * @param {string} [context.tone] — 'professional' | 'playful' | 'bold' | 'minimal'
   * @param {number} [context.monthly_budget] — marketing budget in USD
   * @param {string} [context.industry]
   * @param {boolean} [context.has_blog]
   * @param {boolean} [context.has_seo]
   * @param {boolean} [context.has_email_marketing]
   * @returns {{ channels: Channel[], messaging: object, content_calendar: string[], budget_split: object }}
   */
  async run(context) {
    this.log('info', 'Running marketing strategy analysis', { target: context.target_user })

    const channels = this._buildChannels(context)
    const messaging = this._buildMessaging(context)
    const content_calendar = this._buildContentCalendar(context)
    const budget_split = this._buildBudgetSplit(context, channels)

    this.log('info', 'Marketing strategy complete', { channels: channels.length })

    return {
      channels,
      messaging,
      content_calendar,
      budget_split,
    }
  }

  _buildChannels(context) {
    /** @type {Channel[]} */
    const channels = []
    const users = context.user_count ?? 0
    const model = context.revenue_model ?? 'saas'

    // Content / SEO — almost always high priority for SaaS
    if (!context.has_seo) {
      channels.push({
        name: 'SEO / Content Marketing',
        rationale: 'Lowest CAC channel for SaaS. Compounds over time. Builds trust and discoverability.',
        priority: 'high',
        estimated_cac: '$20–$80',
        tactics: [
          'Publish one detailed how-to article per week targeting problem-aware keywords',
          'Build comparison pages ("vs competitor") — high buyer intent traffic',
          'Create a free tool or calculator that attracts backlinks naturally',
        ],
      })
    }

    // Product Hunt / launch for early stage
    if (users < 500) {
      channels.push({
        name: 'Product Hunt Launch',
        rationale: 'High-visibility launch moment. Attracts early adopters and press attention.',
        priority: 'high',
        estimated_cac: '$5–$30',
        tactics: [
          'Build a hunter relationship 2–4 weeks before launch',
          'Prepare a launch day email to your waitlist asking for upvotes',
          'Post in relevant Slack communities and Twitter/X 30 minutes after midnight PT',
        ],
      })
    }

    // Email marketing
    if (!context.has_email_marketing) {
      channels.push({
        name: 'Email Marketing',
        rationale: 'Owned channel with highest ROI ($36 per $1 spent average). Essential for SaaS retention.',
        priority: 'high',
        estimated_cac: '$10–$40',
        tactics: [
          'Weekly value-driven newsletter to waitlist and users',
          'Automated onboarding sequence (day 1, 3, 7, 14) driving activation',
          'Monthly product update email with social proof and new features',
        ],
      })
    }

    // Social channels based on target user
    const isBusiness = context.target_user && (
      context.target_user.toLowerCase().includes('business') ||
      context.target_user.toLowerCase().includes('b2b') ||
      context.target_user.toLowerCase().includes('founder') ||
      context.target_user.toLowerCase().includes('startup') ||
      context.target_user.toLowerCase().includes('enterprise')
    )

    if (isBusiness) {
      channels.push({
        name: 'LinkedIn',
        rationale: 'B2B audience with high purchase intent. Decision-maker concentration.',
        priority: 'high',
        estimated_cac: '$80–$200',
        tactics: [
          'Founder-led personal brand: share behind-the-scenes building content',
          'Case study posts with specific results (avoid generic "tips")',
          'LinkedIn outreach to ideal customer profile: personalized, value-first',
        ],
      })
    } else {
      channels.push({
        name: 'Twitter / X',
        rationale: 'B2C and developer audience. Build-in-public creates authentic growth.',
        priority: 'medium',
        estimated_cac: '$15–$60',
        tactics: [
          'Build in public: weekly progress updates with real metrics',
          'Engage with adjacent communities before promoting',
          'Thread format for product insights — more reach than single tweets',
        ],
      })
    }

    // Paid acquisition — only after organic proof
    if (users >= 100 && context.monthly_budget && context.monthly_budget > 1000) {
      channels.push({
        name: 'Paid Search (Google Ads)',
        rationale: 'High intent channel for users actively searching for a solution like yours.',
        priority: 'medium',
        estimated_cac: '$60–$300',
        tactics: [
          'Start with exact-match branded and competitor keywords — tightest intent',
          'Allocate 80% of budget to converting campaigns, 20% to awareness',
          'Pause any keyword with 100+ clicks and 0 conversions immediately',
        ],
      })
    }

    // Community
    channels.push({
      name: 'Community / Forums',
      rationale: 'Trust-based discovery in communities where your target users already gather.',
      priority: 'medium',
      estimated_cac: '$0–$20',
      tactics: [
        `Join and contribute to 3–5 ${context.industry ?? 'relevant'} communities before promoting anything`,
        'Answer questions in Reddit, Slack, Discord, or Indie Hackers — no pitching',
        'Share your product only when directly relevant to a thread asking for solutions',
      ],
    })

    // Referral
    if (users >= 50) {
      channels.push({
        name: 'Referral Program',
        rationale: 'Word-of-mouth amplification with the lowest possible CAC. Best performing channel for PLG.',
        priority: 'high',
        estimated_cac: '$5–$25',
        tactics: [
          'One-sided incentive: give the referrer a meaningful reward (1 month free, credits)',
          'Trigger referral ask at peak satisfaction moments: first success, milestone achieved',
          'Make sharing frictionless: one-click share link generated automatically',
        ],
      })
    }

    return channels
  }

  _buildMessaging(context) {
    const tone = context.tone ?? 'professional'
    const target = context.target_user ?? 'users'
    const value = context.value_proposition ?? 'solve their core problem'

    const toneMap = {
      professional: { voice: 'Authoritative and precise', cta_verb: 'Get started' },
      playful: { voice: 'Conversational and energetic', cta_verb: 'Try it free' },
      bold: { voice: 'Direct and confident — no filler words', cta_verb: 'Build now' },
      minimal: { voice: 'Sparse and thoughtful — one idea at a time', cta_verb: 'Start today' },
    }

    const toneData = toneMap[tone] || toneMap.professional

    return {
      positioning: `The fastest way for ${target} to ${value}`,
      voice: toneData.voice,
      primary_cta: toneData.cta_verb,
      headline_formula: 'Verb + Outcome + Time Frame (e.g. "Launch your SaaS in 60 minutes")',
      value_props: [
        'Lead with the outcome the user gets, not the feature you built',
        'Use specific numbers over vague superlatives ("3x faster" not "much faster")',
        'Address the top objection in the sub-headline ("No coding required", "Cancel anytime")',
      ],
      proof_strategy: [
        'Show real logos or names (with permission) — "used by teams at X" outperforms testimonials',
        'Metrics beat quotes: "14,000 apps built" is stronger than "I love this tool"',
        'Video demos drive 80% higher conversion on SaaS landing pages',
      ],
      anti_patterns: [
        'Avoid "AI-powered" as a headline — it is noise. Lead with the problem it solves.',
        'Never use passive voice in CTAs ("Sign Up" not "Register")',
        'Do not put pricing below the fold — visitors who want to pay will leave before they find it',
      ],
    }
  }

  _buildContentCalendar(context) {
    const has_blog = context.has_blog ?? false

    const calendar = [
      'Week 1: Customer story — one user, one result, specific numbers. Publish on blog + LinkedIn/Twitter.',
      'Week 2: How-to guide targeting top search keyword for your ICP. 1500+ words, real screenshots.',
      'Week 3: Competitive comparison post — honest, factual, position your strength clearly.',
      'Week 4: Behind-the-scenes product update — what shipped, what you learned, what is next.',
    ]

    if (!has_blog) {
      calendar.unshift('Pre-launch: Set up a blog (Ghost, Hashnode, or simple markdown in /blog route). Content compounds over 12+ months.')
    }

    if (context.user_count && context.user_count > 100) {
      calendar.push('Monthly: community roundup — curate best user-generated content and share it back to them.')
      calendar.push('Quarterly: state of the product report — growth metrics, roadmap, lessons learned. Builds investor and user trust.')
    }

    return calendar
  }

  _buildBudgetSplit(context, channels) {
    const budget = context.monthly_budget ?? 0
    const highPriority = channels.filter(c => c.priority === 'high')
    const hasPaid = channels.some(c => c.name.toLowerCase().includes('paid'))

    if (budget === 0) {
      return {
        paid_acquisition: '0%',
        content_seo: '0%',
        tools_software: '0%',
        note: 'No marketing budget defined. Focus entirely on organic channels: content, community, and referrals.',
      }
    }

    if (hasPaid && budget > 1000) {
      return {
        paid_acquisition: '40%',
        content_seo: '30%',
        email_tools: '10%',
        community_events: '10%',
        experimentation: '10%',
        note: `$${Math.round(budget * 0.4)}/mo on paid acquisition, $${Math.round(budget * 0.3)}/mo on content. Always test new channels with a 10% experimentation budget.`,
      }
    }

    return {
      content_seo: '50%',
      email_tools: '20%',
      community_events: '20%',
      experimentation: '10%',
      note: `$${budget}/mo total. At this budget, organic channels (content, community, email) will outperform paid. Delay paid acquisition until you have proven organic conversion.`,
    }
  }
}

export default CMOAgent
