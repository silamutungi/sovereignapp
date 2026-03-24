// company-os/marketplace/agents/community-agent.js — Community building agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class CommunityAgent extends AgentBase {
  constructor() {
    super({ name: 'community-agent', phase: 'community-building', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {string} [context.target_user]
   * @param {string} [context.industry]
   * @param {number} [context.user_count]
   * @param {string} [context.tone] — 'professional' | 'playful' | 'bold' | 'minimal'
   * @param {string} [context.revenue_model]
   * @param {boolean} [context.has_free_tier]
   * @param {string} [context.stage]
   * @returns {{ platform_recommendation: string, launch_playbook: string[], engagement_tactics: string[] }}
   */
  async run(context) {
    this.log('info', 'Running community building strategy', { users: context.user_count })

    const platform_recommendation = this._recommendPlatform(context)
    const launch_playbook = this._buildLaunchPlaybook(context)
    const engagement_tactics = this._buildEngagementTactics(context)

    this.log('info', 'Community strategy complete')

    return {
      platform_recommendation,
      launch_playbook,
      engagement_tactics,
    }
  }

  _recommendPlatform(context) {
    const industry = (context.industry ?? '').toLowerCase()
    const target = (context.target_user ?? '').toLowerCase()
    const tone = context.tone ?? 'professional'
    const users = context.user_count ?? 0

    const isDevFocused = industry.includes('dev') || target.includes('developer') || target.includes('engineer') || target.includes('builder')
    const isB2B = target.includes('business') || target.includes('founder') || target.includes('startup') || target.includes('enterprise')
    const isConsumer = !isB2B

    if (isDevFocused) {
      return `Discord — recommended platform for ${context.target_user ?? 'your audience'}.

Rationale: Developers and builders live on Discord. Real-time chat fits a product community where members help each other debug, share configurations, and celebrate launches. Low friction to join. Notification model keeps engagement high.

Setup: Create channels — #announcements (owner-only), #general, #show-and-tell, #help, #feedback, #changelog. Add a welcome bot that onboards new members to the right channels. Keep the structure flat — too many channels kills community.

Alternative: GitHub Discussions if your product is code-adjacent and your users prefer async. Combines issue tracking with community in one place developers already visit.`
    }

    if (isB2B && users < 500) {
      return `Slack Community — recommended platform for ${context.target_user ?? 'your audience'}.

Rationale: B2B founders and operators already live in Slack. A private Slack community feels like an exclusive room, not a public forum. High signal-to-noise ratio. Members are more likely to share real business problems.

Setup: Create channels — #intros, #wins, #questions, #resources, #[industry-specific topics]. Use Slack's Workflow Builder to auto-post a welcome message with channel guide when someone joins.

Alternative: Circle.so if you want member profiles, events, and content in one place. Better for cohort-based communities and paid memberships.`
    }

    if (isConsumer && tone === 'playful') {
      return `Reddit community (subreddit) — recommended for ${context.target_user ?? 'your audience'}.

Rationale: Reddit communities have massive organic discovery when seeded with genuine content. Self-moderation at scale. Users trust Reddit communities over branded forums.

Setup: Create r/[YourProductName] or contribute to existing adjacent subreddits first to build trust before launching your own. Post rules, a wiki with resources, and a weekly thread to anchor engagement.

Alternative: Facebook Groups for consumer products with older demographics or strong visual sharing patterns.`
    }

    return `Discord — recommended platform for ${context.target_user ?? 'your audience'} at your current stage.

Rationale: Discord is the default community platform for product-led communities. Free, scalable, and familiar. At ${users} users, a single community in Discord gives you direct access to your most engaged customers.

Setup: Start with 5 channels maximum. Grow the structure only as you see demand for new topics from members. Premature channel creation fragments engagement.

Alternative: Slack for B2B, Circle.so for paid communities, Reddit for consumer scale.`
  }

  _buildLaunchPlaybook(context) {
    const name = context.app_name ?? 'your community'
    return [
      'Step 1 — Seed before launch: invite your first 10 most engaged users personally before opening to anyone. A community with 10 active members is more welcoming than an empty one with 1000 lurkers.',
      `Step 2 — Write the community manifesto: one paragraph on why ${name} exists and who it is for. Pin it in #announcements and in the welcome DM. Membership criteria should be clear.`,
      'Step 3 — Post the first 5 pieces of content yourself: a welcome post, a "share your project" thread, a resource you find genuinely useful, a question that sparks discussion, and a changelog post with what you just shipped.',
      'Step 4 — Launch announcement: post to Product Hunt, Twitter/X, LinkedIn, and relevant subreddits on the same day. Link from your product directly — add a "Join the community" button in the app footer and onboarding email.',
      'Step 5 — First week: respond to every single message personally. Send a DM to every new member who does not post within 48 hours. This non-scalable behavior sets the culture that scales later.',
      'Step 6 — Week 2 onward: introduce weekly recurring threads (e.g., "Monday: What are you building?", "Friday: Wins & learnings"). Recurring formats reduce the activation energy to post.',
      'Step 7 — First community event: host a 30-minute voice chat or video call for anyone who wants to join. No agenda. Just conversations. Even 5 members on a call creates disproportionate community cohesion.',
      'Step 8 — Identify and reward early contributors: give a special role or badge to your most active members in the first 30 days. Public recognition creates the community\'s first culture leaders.',
    ]
  }

  _buildEngagementTactics(context) {
    const tactics = [
      'Daily: respond to every question within 4 hours during business hours. Questions without responses are a community killer.',
      'Weekly: post a product update with what shipped, what you learned, and one thing you are working on. Transparency builds trust faster than any announcement.',
      'Weekly: run a "show and tell" thread where members share what they built or accomplished. Celebrate every post, no matter how small.',
      'Monthly: run an AMA (Ask Me Anything) session as the founder. Questions that come in during an AMA reveal your community\'s deepest concerns and desires.',
      'Monthly: share a community health metric ("We hit 100 members this month!"). Members stay in communities that feel like they are growing.',
      'User-generated milestones: when a member hits a goal using your product, ask to share their story. User success stories, posted by the user themselves, are more powerful than any case study you write.',
      'Bug and feedback loop: create a visible #feedback channel and respond to every post with "added to our list" or "shipped in v[x]". Closing the feedback loop is the single highest-leverage community retention tactic.',
      'Seasonal campaigns: organize community challenges aligned to external moments (new year planning, launch season). Time-bounded challenges spike engagement and bring lurkers into active participation.',
      'Community-exclusive content: share things in the community that you do not share anywhere else (early access, raw data, behind-the-scenes). Members who feel they get exclusive value become your strongest advocates.',
      'Anti-pattern to avoid: do not create a community purely for marketing. Communities where the operator only shows up to announce things die within 6 months.',
    ]

    if (context.has_free_tier) {
      tactics.push('Free-to-paid conversion: the community is your highest-trust conversion channel. Share upgrade stories from community members naturally — never pitch directly in community spaces.')
    }

    return tactics
  }
}

export default CommunityAgent
