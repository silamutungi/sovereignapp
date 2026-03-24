// company-os/functional/agents/cx-agent.js — Customer experience audit agent
// UNLOCKS: when app has support email or 50+ users

import { AgentBase } from '../../../shared/agent-base-class.js'

export class CXAgent extends AgentBase {
  constructor() {
    super({ name: 'cx-agent', phase: 'customer-experience', version: '1.0.0' })
  }

  static isUnlocked(context) {
    return !!(
      context.support_email ||
      context.has_support ||
      (context.user_count != null && context.user_count >= 50)
    )
  }

  /**
   * @param {object} context
   * @param {number} [context.user_count]
   * @param {string} [context.support_email]
   * @param {boolean} [context.has_onboarding_flow]
   * @param {boolean} [context.has_help_docs]
   * @param {boolean} [context.has_in_app_chat]
   * @param {boolean} [context.has_email_onboarding]
   * @param {number} [context.avg_response_time_hours]
   * @param {number} [context.churn_rate]
   * @param {number} [context.activation_rate] — 0–1 decimal
   * @param {string[]} [context.top_support_topics]
   * @param {string} [context.stage]
   * @returns {{ nps_formula: object, support_playbook: string[], friction_points: string[], improvement_plan: string[] }}
   */
  async run(context) {
    this.log('info', 'Running CX audit', { users: context.user_count })

    const nps_formula = this._buildNPSFormula(context)
    const support_playbook = this._buildSupportPlaybook(context)
    const friction_points = this._identifyFrictionPoints(context)
    const improvement_plan = this._buildImprovementPlan(context, friction_points)

    this.log('info', 'CX audit complete', { friction_count: friction_points.length })

    return {
      nps_formula,
      support_playbook,
      friction_points,
      improvement_plan,
    }
  }

  _buildNPSFormula(context) {
    return {
      question: 'How likely are you to recommend [Product Name] to a friend or colleague? (0–10)',
      scoring: {
        promoters: '9–10 (loyal enthusiasts who will fuel growth)',
        passives: '7–8 (satisfied but not enthusiastic, vulnerable to competitors)',
        detractors: '0–6 (unhappy customers who can damage your brand)',
        formula: 'NPS = % Promoters − % Detractors',
        benchmark_saas: 'Industry average is +31. World-class SaaS scores +50 or higher.',
      },
      when_to_ask: [
        'After a user completes their first meaningful action (activation moment)',
        '30 days after signup — enough time to form an opinion',
        'Quarterly pulse: send to all active users every 90 days',
        'Immediately after resolving a support ticket',
      ],
      how_to_ask: [
        'In-app modal: show after key success moments, not on login',
        'Email survey: send at 30-day mark to users who have reached activation',
        'Never ask during checkout or immediately after an error',
        'One question only — follow-up open text for context, but keep the survey under 60 seconds',
      ],
      closing_the_loop: [
        'Detractors (0–6): personal outreach within 24 hours. Understand the problem, do not defend.',
        'Passives (7–8): ask one follow-up question: "What would make this a 9 or 10?"',
        'Promoters (9–10): ask for a G2/Capterra review or LinkedIn testimonial. This is your referral engine.',
      ],
      current_estimate: context.churn_rate && context.churn_rate > 0.1
        ? 'High churn suggests NPS is likely below +10. Fix the product before measuring.'
        : 'Measure NPS as soon as you have 50+ active users to get statistically meaningful results.',
    }
  }

  _buildSupportPlaybook(context) {
    const playbook = []
    const avgResponse = context.avg_response_time_hours ?? null
    const users = context.user_count ?? 0

    // Response time standards
    playbook.push('Response Time SLA: acknowledge within 1 business hour, resolve within 24 hours for non-critical issues, 2 hours for critical (data loss, billing, access blocked).')

    // Tiering
    playbook.push('Issue severity tiers: P0 = data loss or complete outage (2hr SLA), P1 = core feature broken (4hr SLA), P2 = degraded experience (24hr SLA), P3 = cosmetic or nice-to-have (next sprint).')

    // First response quality
    playbook.push('First response formula: acknowledge the problem → confirm your understanding → give a timeline → next step. Never respond with "Looking into it" without a timeline.')

    // Tooling
    if (users < 200) {
      playbook.push('At <200 users: a shared Gmail inbox or Notion inbox is sufficient. Do not over-invest in ticketing tooling yet.')
    } else if (users < 1000) {
      playbook.push('At 200–1000 users: migrate to Intercom, Crisp, or Plain. These tools give you conversation history and metrics without overhead.')
    } else {
      playbook.push('At 1000+ users: implement a proper help desk (Zendesk, Freshdesk, Linear for bugs). Separate support from bug tracking.')
    }

    // Response time feedback
    if (avgResponse != null) {
      if (avgResponse > 24) {
        playbook.push(`Current response time (${avgResponse}h) is above the 24h standard. Users who wait >24h are 3x more likely to churn. Prioritize reducing this immediately.`)
      } else if (avgResponse > 4) {
        playbook.push(`Response time is ${avgResponse}h. Good target is under 4h during business hours. Consider a triage bot for first acknowledgment.`)
      } else {
        playbook.push(`Response time (${avgResponse}h) is excellent. Maintain this as you scale by building a help center to deflect repetitive questions.`)
      }
    }

    // Help documentation
    if (!context.has_help_docs) {
      playbook.push('No help docs detected. A basic FAQ page reduces support volume by 20–40%. Build docs for your top 5 support topics first.')
    }

    // Escalation path
    playbook.push('Escalation path: front-line support → product team (for bugs with reproduction steps) → founder (for billing disputes and data requests). Every escalation must have a defined owner.')

    // Post-resolution
    playbook.push('After every P0/P1: write a 5-sentence post-mortem (what happened, root cause, fix, prevention, user communication). Share internally even if small.')

    // Self-service
    playbook.push('Self-service goal: 60% of tickets should be resolvable with docs. Track top ticket categories monthly and write a help article for each recurring topic.')

    // Support topics
    if (context.top_support_topics && context.top_support_topics.length > 0) {
      playbook.push(`Top support topics identified: ${context.top_support_topics.join(', ')}. These are your highest-priority help doc targets.`)
    }

    return playbook
  }

  _identifyFrictionPoints(context) {
    const friction = []

    if (!context.has_onboarding_flow) {
      friction.push('No structured onboarding — users reach the product with no guidance on first action. Activation rate suffers.')
    }

    if (!context.has_email_onboarding) {
      friction.push('No email onboarding sequence — users who do not activate on day 1 have no mechanism to bring them back.')
    }

    if (context.activation_rate != null && context.activation_rate < 0.3) {
      friction.push(`Low activation rate (${Math.round(context.activation_rate * 100)}%) — fewer than 30% of signups reach the core action. The onboarding flow needs a complete redesign.`)
    } else if (context.activation_rate != null && context.activation_rate < 0.6) {
      friction.push(`Activation rate (${Math.round(context.activation_rate * 100)}%) below benchmark (60%+). Map the activation path and find the drop-off step.`)
    }

    if (!context.has_in_app_chat && context.user_count > 100) {
      friction.push('No in-app chat — users who get stuck have no real-time support option. In-app chat reduces churn for confused users by 15–25%.')
    }

    if (!context.has_help_docs) {
      friction.push('No help documentation — every user question becomes a support ticket. This does not scale beyond 200 users.')
    }

    if (context.churn_rate != null && context.churn_rate > 0.05) {
      friction.push(`High monthly churn (${Math.round(context.churn_rate * 100)}%) indicates a systemic experience problem. Survey churned users within 7 days of cancellation.`)
    }

    if (context.avg_response_time_hours != null && context.avg_response_time_hours > 24) {
      friction.push(`Support response time (${context.avg_response_time_hours}h) is above acceptable threshold. Unresolved issues become churn within 48 hours.`)
    }

    if (!context.has_empty_states) {
      friction.push('Missing empty states — new users see blank screens instead of guidance. Empty states with a primary action are one of the highest-ROI UX improvements.')
    }

    if (!context.has_error_messages) {
      friction.push('Generic or missing error messages — users who hit errors cannot self-resolve and flood support.')
    }

    if (!context.has_loading_states) {
      friction.push('Missing loading states on async operations — users cannot tell if the app is working or broken during fetches.')
    }

    return friction
  }

  _buildImprovementPlan(context, friction_points) {
    const plan = []

    // Priority: activation
    if (!context.has_onboarding_flow) {
      plan.push('P0 — Build a 3-step onboarding checklist shown to new users on first login. Goal: reach the activation moment (first success) before the end of session 1.')
    }

    if (!context.has_email_onboarding) {
      plan.push('P0 — Implement a 5-email onboarding drip: Day 1 (welcome + single action), Day 3 (value reminder), Day 7 (activation nudge), Day 14 (power feature reveal), Day 30 (NPS survey).')
    }

    // Priority: deflection
    if (!context.has_help_docs) {
      plan.push('P1 — Build a help center (Mintlify, Notion public pages, or an /help route) with articles for the top 5 support topics. Target: 40% ticket deflection.')
    }

    // Priority: retention signals
    if (context.churn_rate != null && context.churn_rate > 0.05) {
      plan.push('P1 — Set up a churned-user exit survey (Typeform or in-app modal before cancellation). The reason users leave is the most valuable product data you can collect.')
    }

    // Priority: real-time support
    if (!context.has_in_app_chat && context.user_count > 100) {
      plan.push('P2 — Add in-app chat (Crisp free tier or Intercom) on core pages. Route to a shared inbox and commit to <4h response during business hours.')
    }

    // NPS program
    if (context.user_count && context.user_count >= 50) {
      plan.push('P2 — Launch your first NPS survey this week. Even a manual Typeform sent to your first 50 users gives you signal. Schedule quarterly cadence.')
    }

    // Quick wins
    plan.push('Quick win — Add loading spinners and skeleton states to every async operation. Zero-effort improvement to perceived performance.')
    plan.push('Quick win — Add empty states with helpful copy and a primary action to every list view. "No projects yet — Create your first one" beats a blank screen.')
    plan.push('Quick win — Review your top 3 error messages. Replace "Something went wrong" with specific, actionable text: what happened, and what to do next.')

    // Measurement
    plan.push('Baseline metrics to track from this week: activation rate (% of signups who complete core action within 7 days), D30 retention (% of signups still active at day 30), support ticket volume per 100 users.')

    return plan
  }
}

export default CXAgent
