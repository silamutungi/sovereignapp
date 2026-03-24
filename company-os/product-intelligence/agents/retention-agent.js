// company-os/product-intelligence/agents/retention-agent.js
// Retention improvement agent — analyzes churn points and recommends interventions.

import { AgentBase } from '../../../shared/agent-base-class.js'

export class RetentionAgent extends AgentBase {
  constructor() {
    super({
      name: 'retention-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the retention agent.
   *
   * @param {object} context
   * @param {string} [context.app_type] — 'saas' | 'marketplace' | 'consumer' | 'ecommerce' | 'developer-tools'
   * @param {number} [context.d7_retention] — D7 retention rate as decimal (0.0–1.0)
   * @param {number} [context.d30_retention] — D30 retention rate as decimal
   * @param {number} [context.monthly_churn_rate] — monthly churn rate as decimal (SaaS)
   * @param {string[]} [context.known_churn_reasons] — qualitative churn reasons from surveys
   * @param {string[]} [context.current_interventions] — interventions already in place
   * @returns {{ risk_level: string, interventions: string[], email_sequence: string[] }}
   */
  async run(context) {
    const {
      app_type = 'saas',
      d7_retention = null,
      d30_retention = null,
      monthly_churn_rate = null,
      known_churn_reasons = [],
      current_interventions = [],
    } = context

    this.log('info', `Running retention analysis for ${app_type}`)

    const risk_level = this.assessRiskLevel(app_type, d7_retention, d30_retention, monthly_churn_rate)
    const interventions = this.buildInterventions(app_type, risk_level, known_churn_reasons, current_interventions)
    const email_sequence = this.buildEmailSequence(app_type, risk_level)

    return {
      risk_level,
      interventions,
      email_sequence,
      benchmarks: this.getBenchmarks(app_type),
      diagnosis: this.diagnose(app_type, d7_retention, d30_retention, monthly_churn_rate, known_churn_reasons),
    }
  }

  assessRiskLevel(app_type, d7, d30, monthlyChurn) {
    // SaaS: use monthly churn rate
    if (app_type === 'saas' && monthlyChurn !== null) {
      if (monthlyChurn > 0.08) return 'critical'
      if (monthlyChurn > 0.05) return 'high'
      if (monthlyChurn > 0.02) return 'medium'
      return 'low'
    }

    // Consumer/social: use D7/D30 retention
    if (d7 !== null) {
      if (d7 < 0.10) return 'critical'
      if (d7 < 0.20) return 'high'
      if (d7 < 0.30) return 'medium'
      return 'low'
    }

    if (d30 !== null) {
      if (d30 < 0.05) return 'critical'
      if (d30 < 0.10) return 'high'
      if (d30 < 0.20) return 'medium'
      return 'low'
    }

    // No data — default to medium (prompt for data)
    return 'unknown'
  }

  diagnose(app_type, d7, d30, monthlyChurn, knownReasons) {
    const diagnosis = []

    if (d7 !== null && d7 < 0.25) {
      diagnosis.push(`D7 retention of ${Math.round(d7 * 100)}% is below the ${app_type === 'saas' ? '40%' : '25%'} benchmark — users are not finding enough value in the first week.`)
    }
    if (d30 !== null && d30 < 0.10) {
      diagnosis.push(`D30 retention of ${Math.round(d30 * 100)}% is critically low — habit loop is not forming in month 1.`)
    }
    if (monthlyChurn !== null && monthlyChurn > 0.02) {
      diagnosis.push(`Monthly churn of ${Math.round(monthlyChurn * 100)}% exceeds the 2% SaaS benchmark — every 100 users, you lose ${Math.round(monthlyChurn * 100)} per month.`)
    }
    if (knownReasons.includes('onboarding') || knownReasons.includes('confusing')) {
      diagnosis.push('Onboarding confusion is a reported churn reason — simplify to 3 steps max and use progress indicators.')
    }
    if (knownReasons.includes('price') || knownReasons.includes('cost')) {
      diagnosis.push('Price is a reported churn reason — this often signals insufficient perceived value, not just price sensitivity.')
    }
    if (knownReasons.includes('missing_feature') || knownReasons.includes('feature')) {
      diagnosis.push('Missing features are a reported churn reason — identify the top 3 requested features and prioritize them.')
    }
    if (diagnosis.length === 0) {
      diagnosis.push('Insufficient retention data to diagnose root cause. Add D7 retention tracking as the first analytics priority.')
    }

    return diagnosis
  }

  buildInterventions(app_type, risk_level, knownReasons, currentInterventions) {
    const all = []

    // Universal interventions
    const universal = [
      {
        id: 'onboarding_checklist',
        intervention: 'Add an in-app onboarding checklist with 3–5 steps that lead users to their first "aha moment"',
        effort: 'medium',
        impact: 'high',
      },
      {
        id: 'activation_tracking',
        intervention: 'Define and track your activation event — the single action that most predicts long-term retention',
        effort: 'low',
        impact: 'high',
      },
      {
        id: 'day7_email',
        intervention: 'Send a D+7 email to users who have not reached the activation event — share a tip or case study',
        effort: 'low',
        impact: 'medium',
      },
      {
        id: 'exit_survey',
        intervention: 'Add a cancellation or churn survey — "What is your main reason for leaving?" with 5 options',
        effort: 'low',
        impact: 'high',
      },
    ]

    // Type-specific interventions
    const typeInterventions = {
      saas: [
        {
          id: 'health_score',
          intervention: 'Build a customer health score (login frequency + feature usage + support tickets) and alert CS team on drops',
          effort: 'high',
          impact: 'high',
        },
        {
          id: 'trial_nudges',
          intervention: 'Send "trial expiry" nudge at T-3 days with a summary of what the user accomplished in their trial',
          effort: 'medium',
          impact: 'high',
        },
        {
          id: 'feature_gates',
          intervention: 'Gate advanced features behind paid plan with "upgrade to unlock" moments inside the product',
          effort: 'medium',
          impact: 'medium',
        },
      ],
      consumer: [
        {
          id: 'push_reengagement',
          intervention: 'Send push notification at D+2 to users who have not returned — personalized based on first session action',
          effort: 'low',
          impact: 'high',
        },
        {
          id: 'streak_mechanic',
          intervention: 'Add a usage streak to create daily habit loop — Duolingo-style loss aversion is extremely effective',
          effort: 'medium',
          impact: 'high',
        },
        {
          id: 'social_proof_loop',
          intervention: 'Show activity from followed users in re-engagement emails — "5 people you follow posted today"',
          effort: 'medium',
          impact: 'medium',
        },
      ],
      marketplace: [
        {
          id: 'first_transaction_nudge',
          intervention: 'Target users with zero transactions in their first 7 days — email with featured listings or first-purchase discount',
          effort: 'low',
          impact: 'high',
        },
        {
          id: 'seller_success',
          intervention: 'Proactively coach new sellers who have listed but not had a first transaction within 14 days',
          effort: 'medium',
          impact: 'high',
        },
      ],
      ecommerce: [
        {
          id: 'cart_abandonment',
          intervention: 'Cart abandonment email sequence: 1h (still thinking?), 24h (items selling fast), 72h (last chance)',
          effort: 'low',
          impact: 'high',
        },
        {
          id: 'winback_campaign',
          intervention: 'Win-back campaign for customers who have not purchased in 90 days — discount or "what\'s new" email',
          effort: 'low',
          impact: 'medium',
        },
      ],
      'developer-tools': [
        {
          id: 'upgrade_nudge_on_limit',
          intervention: 'Trigger in-app upgrade prompt when user hits usage limit — never just fail silently',
          effort: 'low',
          impact: 'high',
        },
        {
          id: 'changelog_digest',
          intervention: 'Weekly changelog email to active users showing new features — developers appreciate being in the loop',
          effort: 'low',
          impact: 'medium',
        },
      ],
    }

    for (const item of universal) {
      if (!currentInterventions.includes(item.id)) {
        all.push(item.intervention)
      }
    }
    for (const item of (typeInterventions[app_type] || [])) {
      if (!currentInterventions.includes(item.id)) {
        all.push(item.intervention)
      }
    }

    // Risk-level specific additions
    if (risk_level === 'critical') {
      all.unshift('URGENT: Schedule 5 user interviews this week to understand why users are churning. Do not optimize without qualitative data.')
    }

    return all.slice(0, 8)
  }

  buildEmailSequence(app_type, risk_level) {
    const baseSequence = [
      'Day 0 — Welcome email: what to do first (3 steps max), link to getting started guide',
      'Day 1 — Tip email: the single most useful feature most users miss in their first 24 hours',
      'Day 3 — Check-in: "Have you tried X yet?" with a tutorial link. If user is inactive, offer help.',
      'Day 7 — Value reinforcement: case study or example of what users like them achieved in their first week',
      'Day 14 — Feature spotlight: second most-used feature that predicts long-term retention',
      'Day 30 — Milestone email: celebrate 30 days, show their progress, prompt to upgrade or refer a friend',
    ]

    const typeAdditions = {
      saas: [
        'Day 45 — Social proof: customer story from someone in the same industry as the user',
        'Day 60 — Expansion email: team plan or advanced feature that is relevant based on their usage',
      ],
      consumer: [
        'Day 7 — "Your friends are here" — social connection prompt if the platform has social features',
        'Day 14 — Achievement email: gamification milestone, streak record, or personalized summary',
      ],
      ecommerce: [
        'Day 7 post-purchase — Review request: "How did you like your order?"',
        'Day 30 post-purchase — Replenishment or cross-sell email based on purchase category',
        'Day 90 inactivity — Win-back: "We miss you" with discount or curated new arrivals',
      ],
      'developer-tools': [
        'Day 3 — Advanced usage tip: shows power users a shortcut or flag they probably missed',
        'Day 14 — Integration suggestion: "Did you know you can connect X?" based on their stack',
        'Week 6 — Changelog digest: top 3 features shipped since they signed up',
      ],
    }

    return [...baseSequence, ...(typeAdditions[app_type] || [])]
  }

  getBenchmarks(app_type) {
    const benchmarks = {
      saas: { monthly_churn: '< 2%', ltv_cac: '> 3x', nrr: '> 100%' },
      consumer: { d1: '> 40%', d7: '> 25%', d30: '> 10%', dau_mau: '> 20%' },
      marketplace: { repeat_transaction_rate: '> 40% in 90 days', time_to_first_transaction: '< 7 days' },
      ecommerce: { repeat_purchase_rate: '> 25% in 90 days', cart_abandonment_recovery: '> 10%' },
      'developer-tools': { d7_active_use: '> 30%', oss_to_paid_conversion: '1–5%' },
    }
    return benchmarks[app_type] || benchmarks.saas
  }

  async verify(output) {
    if (!['critical', 'high', 'medium', 'low', 'unknown'].includes(output.risk_level)) {
      throw new Error('RetentionAgent: risk_level must be critical, high, medium, low, or unknown')
    }
    if (!Array.isArray(output.interventions)) throw new Error('RetentionAgent: interventions must be an array')
    if (!Array.isArray(output.email_sequence)) throw new Error('RetentionAgent: email_sequence must be an array')
    return output
  }
}

export default RetentionAgent
