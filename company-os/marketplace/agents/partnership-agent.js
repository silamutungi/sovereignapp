// company-os/marketplace/agents/partnership-agent.js — Strategic partnerships agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class PartnershipAgent extends AgentBase {
  constructor() {
    super({ name: 'partnership-agent', phase: 'partnerships', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {string} [context.industry]
   * @param {string} [context.target_user]
   * @param {string[]} [context.features]
   * @param {string} [context.stack]
   * @param {string} [context.revenue_model]
   * @param {number} [context.user_count]
   * @param {string} [context.value_proposition]
   * @returns {{ partnership_targets: string[], outreach_templates: string[], partnership_types: string[] }}
   */
  async run(context) {
    this.log('info', 'Running partnership strategy analysis', { industry: context.industry })

    const partnership_targets = this._buildPartnershipTargets(context)
    const outreach_templates = this._buildOutreachTemplates(context)
    const partnership_types = this._buildPartnershipTypes(context)

    this.log('info', 'Partnership analysis complete', { target_count: partnership_targets.length })

    return {
      partnership_targets,
      outreach_templates,
      partnership_types,
    }
  }

  _buildPartnershipTargets(context) {
    const targets = []
    const stack = context.stack ?? ''
    const industry = (context.industry ?? '').toLowerCase()
    const features = context.features ?? []

    // Technology integration partners
    if (stack.includes('supabase') || stack.includes('postgres')) {
      targets.push('Supabase — integration partner. List on their marketplace. Co-marketing with their ecosystem newsletter.')
    }
    if (stack.includes('vercel')) {
      targets.push('Vercel — integration partner. Feature in their customer showcase. Access their developer community.')
    }
    if (stack.includes('stripe') || context.has_payments) {
      targets.push('Stripe — Apps marketplace listing. Co-marketing with their fintech newsletter. Stripe partner directory.')
    }

    // Agency / service partners
    targets.push('No-code / low-code consultants (Webflow agencies, Bubble developers) — white-label or referral arrangement')
    targets.push('Startup accelerators (YC, Techstars, On Deck) — preferred vendor relationships give access to a steady stream of new startups')

    // Ecosystem / community partners
    if (industry.includes('saas') || !industry) {
      targets.push('Product Hunt — early launch partnership for featured placement')
      targets.push('Indie Hackers — community partnership for authentic builder-to-builder positioning')
    }

    if (industry.includes('ecommerce') || features.includes('ecommerce')) {
      targets.push('Shopify App Store — distribution channel for e-commerce segment')
      targets.push('WooCommerce plugin directory — access to WordPress ecosystem')
    }

    if (industry.includes('devtools') || features.includes('api') || features.includes('developer')) {
      targets.push('GitHub Marketplace — native developer distribution')
      targets.push('VS Code Extension Marketplace — developer tooling channel')
      targets.push('npm / package registries — open source adoption driver')
    }

    // Content / media partners
    targets.push('Industry newsletters in your space — newsletter swap or sponsored issue for warm audience access')
    targets.push('Podcast co-appearances (founder-facing: Indie Hackers, Build Your SaaS, My First Million)')

    return targets
  }

  _buildOutreachTemplates(context) {
    const productName = context.app_name ?? 'our product'
    const target = context.target_user ?? 'builders'

    return [
      `INTEGRATION PARTNERSHIP OUTREACH

Subject: Partnership opportunity — ${productName} × [Their Company]

Hi [Name],

I am building ${productName}, which helps ${target} ${context.value_proposition ?? 'solve a specific problem'}.

We have ${context.user_count ?? 'growing'} users and many of them are already using [Their Product]. I see a natural integration opportunity that would benefit both of our communities.

Specifically, I am thinking of [exact integration — be specific, one sentence].

Would you be open to a 20-minute call to explore whether there is mutual value here?

[Your name]
[One sentence on traction]`,

      `CO-MARKETING OUTREACH

Subject: Co-marketing idea for our overlapping audiences

Hi [Name],

We serve similar audiences — [Your Target User] who are also heavy [Their Product] users.

I would love to explore a simple co-marketing swap: I feature you to our ${context.user_count ?? 'growing'} community, you share us with yours.

No complex contracts. A newsletter mention, a Twitter/X post, or a joint how-to guide — whatever feels natural.

Happy to go first. Is this something worth a quick conversation?

[Your name]`,

      `RESELLER / AGENCY OUTREACH

Subject: Reseller opportunity for your clients

Hi [Name],

I noticed you work with [agency's client type] — many of whom could benefit from ${productName}.

We are looking for agency partners who can offer ${productName} as part of their service stack. We offer [20–30%] recurring commission on referred customers who stay active for 90+ days.

No integration work required on your end. We handle the product, you handle the relationship.

Would you like to see how it works?

[Your name]`,
    ]
  }

  _buildPartnershipTypes(context) {
    return [
      'Technology integration — embed your product inside another tool via API. Highest distribution leverage, requires engineering.',
      'App marketplace listing — appear in partner ecosystems (Stripe Apps, Notion integrations, Zapier). Passive inbound distribution.',
      'Co-marketing — newsletter swaps, joint webinars, shared blog posts. Zero engineering, immediate mutual benefit.',
      'Reseller / white-label — agencies and consultants sell your product to their clients. Revenue share (typically 20–30%). Scales with no marketing spend.',
      'Affiliate program — influencers and community members earn commission per referral. Best for products with a clear use case that can be demonstrated.',
      'Channel partnership — larger companies distribute your product to their customer base in exchange for revenue share or co-marketing credit.',
      'Academic / nonprofit partnership — build credibility and get product adoption in institutions. Often free-tier relationships that generate social proof.',
    ]
  }
}

export default PartnershipAgent
