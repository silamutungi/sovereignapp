// company-os/marketplace/agents/pr-agent.js — PR strategy agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class PRAgent extends AgentBase {
  constructor() {
    super({ name: 'pr-agent', phase: 'pr-strategy', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {string} [context.app_name]
   * @param {string} [context.value_proposition]
   * @param {string} [context.industry]
   * @param {string} [context.target_user]
   * @param {number} [context.user_count]
   * @param {number} [context.mrr]
   * @param {string} [context.stage]
   * @param {string} [context.founder_name]
   * @param {string} [context.founder_background]
   * @returns {{ press_release: string, journalist_targets: string[], story_angles: string[] }}
   */
  async run(context) {
    this.log('info', 'Running PR strategy analysis', { stage: context.stage })

    const press_release = this._buildPressRelease(context)
    const journalist_targets = this._buildJournalistTargets(context)
    const story_angles = this._buildStoryAngles(context)

    this.log('info', 'PR strategy complete')

    return {
      press_release,
      journalist_targets,
      story_angles,
    }
  }

  _buildPressRelease(context) {
    const name = context.app_name ?? '[Product Name]'
    const founder = context.founder_name ?? '[Founder Name]'
    const target = context.target_user ?? 'users'
    const value = context.value_proposition ?? 'solve their core problem'
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    return `FOR IMMEDIATE RELEASE
${today}

${name.toUpperCase()} LAUNCHES TO HELP ${target.toUpperCase()} ${value.toUpperCase()}

[CITY] — ${name}, a new ${context.industry ?? 'software'} product, today launched publicly to help ${target} ${value}. The product has attracted ${context.user_count ?? 'early'} users during its private beta.

"[Quote from ${founder} — one sentence on the problem, one on the vision. Make it human, not corporate.]"

WHAT ${name.toUpperCase()} DOES

${name} [one sentence on the core action the product takes]. Unlike existing solutions, it [one specific differentiator — be concrete and measurable].

TRACTION

Since launching privately in [month], ${name} has:
- [Metric 1: e.g., "attracted X active users"]
- [Metric 2: e.g., "processed $X in transactions"]
- [Metric 3: e.g., "reduced [task] time by X%"]

AVAILABILITY AND PRICING

${name} is available immediately at [URL]. Pricing starts at [Free / $X/month]. [Trial / free tier details if applicable.]

ABOUT ${name.toUpperCase()}

${name} was founded by ${founder} [one sentence founder bio — most relevant credibility]. The company is based in [City] and [backed by / bootstrapped].

MEDIA CONTACT
${founder}
[email]
[phone optional]
[URL]

###

NOTE: High-quality press releases are factual and specific. Remove all adjectives like "revolutionary" and "innovative." Replace every vague claim with a specific number.`
  }

  _buildJournalistTargets(context) {
    const industry = (context.industry ?? '').toLowerCase()
    const targets = []

    // Tech press — always relevant
    targets.push('TechCrunch — senior reporters covering SaaS/tools: Kyle Wiggers, Natasha Mascarenhas. Best angle: unusual founder story or surprising traction numbers.')
    targets.push('The Information — subscription tech press. Best angle: contrarian takes on well-funded incumbents.')
    targets.push('Hacker News (Show HN post) — not a journalist but high-quality technical audience. Write as a founder, not a press release.')
    targets.push('Product Hunt — launch post with a compelling story in the comments. Maker Q&A thread drives more than the post itself.')

    // Business press
    targets.push('Fast Company — innovation + business angle. Best angle: social impact or creative problem-solving approach.')
    targets.push('Inc. Magazine — founder journey stories. Best angle: origin story, personal risk, or underdog narrative.')
    targets.push('Forbes — milestone-driven coverage. Best angle: funding announcements, revenue milestones, notable customers.')

    // Vertical / niche press
    if (industry.includes('fintech') || context.has_payments) {
      targets.push('Fintech Nexus, Banking Day, Payments Dive — cover fintech launches directly relevant to their readers.')
    }
    if (industry.includes('health') || industry.includes('medical')) {
      targets.push('MedCity News, Healthcare IT Today, STAT News — health tech with editorial integrity.')
    }
    if (industry.includes('edtech') || industry.includes('education')) {
      targets.push('EdSurge, EdTech Magazine — dedicated education technology coverage.')
    }
    if (industry.includes('devtools') || industry.includes('developer')) {
      targets.push('The New Stack — developer tools and cloud-native coverage')
      targets.push('InfoQ — in-depth technical coverage with thoughtful developer community')
    }

    // Newsletters
    targets.push('The Pragmatic Engineer (Gergely Orosz) — 250k+ developer subscribers. Best for developer tool launches.')
    targets.push('Lenny\'s Newsletter — product + growth audience. Best for B2B SaaS launches with interesting growth story.')
    targets.push('Morning Brew Tech / Sidekick — business-forward tech news, 4M+ readers.')

    return targets
  }

  _buildStoryAngles(context) {
    const angles = []
    const name = context.app_name ?? 'this product'

    // Founder story
    angles.push(`Founder origin story: Why did ${context.founder_name ?? 'the founder'} build ${name}? The most compelling pitch starts with a personal problem — the more specific and visceral, the better.`)

    // David vs Goliath
    angles.push(`David vs Goliath: ${name} taking on [large incumbent] by serving the customers they ignore. Niche-first strategy. Works especially well when the incumbent raised hundreds of millions and still gets basic UX wrong.`)

    // Contrarian take
    angles.push(`Contrarian take: "[Industry assumption] is wrong." ${name} is built on the opposite premise. Contrarian angles get 3x more press coverage than consensus stories.`)

    // Traction / growth
    if (context.user_count && context.user_count > 100) {
      angles.push(`Organic growth story: ${context.user_count.toLocaleString()} users with $0 in paid marketing. How word-of-mouth works in [industry]. Journalists love zero-budget traction stories.`)
    }

    // Market timing
    angles.push(`Market timing: why ${name} is the right product for [current moment]. Reference a recent trend, regulation change, or technology shift that makes now uniquely the right time for this product.`)

    // Future of work / industry
    angles.push(`Industry transformation angle: how [specific trend] is changing the way ${context.target_user ?? 'people'} work, and how ${name} is building for that future.`)

    // Community / movement
    angles.push(`Community angle: ${name} as a tool for a specific underserved community. Works well when your users are passionate and vocal — their stories tell the narrative better than any press release.`)

    // Competitive displacement
    if (context.mrr && context.mrr > 1000) {
      angles.push(`Enterprise defection story: [Notable company type] switching from [incumbent] to ${name} and what they got. One well-placed case study with specific ROI numbers beats 10 press releases.`)
    }

    return angles
  }
}

export default PRAgent
