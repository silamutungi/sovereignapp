// company-os/product-intelligence/agents/customer-success-agent.js
// Customer success patterns agent — health score formula, onboarding steps, intervention triggers.

import { AgentBase } from '../../../shared/agent-base-class.js'

export class CustomerSuccessAgent extends AgentBase {
  constructor() {
    super({
      name: 'customer-success-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the customer success agent.
   *
   * @param {object} context
   * @param {string} [context.app_type] — 'saas' | 'marketplace' | 'consumer' | 'ecommerce' | 'developer-tools'
   * @param {string[]} [context.features] — list of features in the app (auth, payments, dashboard, etc.)
   * @param {string} [context.stage] — 'pre-launch' | 'early' | 'growth' | 'scale'
   * @param {string} [context.plan_type] — 'self-serve' | 'low-touch' | 'high-touch'
   * @returns {{ health_score_formula: object, onboarding_steps: string[], interventions: string[] }}
   */
  async run(context) {
    const {
      app_type = 'saas',
      features = [],
      stage = 'early',
      plan_type = 'self-serve',
    } = context

    this.log('info', `Running customer success design for ${app_type} ${plan_type} model`)

    const health_score_formula = this.buildHealthScoreFormula(app_type, features)
    const onboarding_steps = this.buildOnboardingSteps(app_type, features)
    const interventions = this.buildInterventions(app_type, plan_type, stage)

    return {
      health_score_formula,
      onboarding_steps,
      interventions,
      escalation_paths: this.buildEscalationPaths(plan_type),
      success_metrics: this.buildSuccessMetrics(app_type),
    }
  }

  buildHealthScoreFormula(app_type, features) {
    const hasAuth = features.includes('auth') || features.includes('login')
    const hasBilling = features.includes('billing') || features.includes('payments') || features.includes('stripe')
    const hasCollaboration = features.includes('team') || features.includes('invite') || features.includes('collaboration')

    const dimensions = [
      {
        dimension: 'engagement',
        weight: 0.30,
        metric: 'Login frequency in last 30 days',
        scoring: 'Logins per month: 20+ = 100, 10–19 = 75, 5–9 = 50, 1–4 = 25, 0 = 0',
        data_source: 'auth.users last_sign_in_at or event tracking',
      },
      {
        dimension: 'activation',
        weight: 0.25,
        metric: 'Completion rate of core activation checklist',
        scoring: '100% complete = 100, 75% = 75, 50% = 50, < 50% = 25',
        data_source: 'onboarding_completions table or feature event tracking',
      },
      {
        dimension: 'feature_adoption',
        weight: 0.20,
        metric: 'Number of distinct core features used in last 30 days',
        scoring: 'Uses 5+ features = 100, 3–4 = 75, 2 = 50, 1 = 25, 0 = 0',
        data_source: 'feature_usage events from analytics',
      },
    ]

    if (hasBilling) {
      dimensions.push({
        dimension: 'payment_health',
        weight: 0.15,
        metric: 'Payment and subscription status',
        scoring: 'Active paid = 100, trialing = 75, payment_failed = 0, cancelled = 0',
        data_source: 'Stripe webhook events → builds/subscriptions table',
      })
    }

    if (hasCollaboration) {
      dimensions.push({
        dimension: 'team_expansion',
        weight: 0.10,
        metric: 'Number of active team members in the account',
        scoring: '5+ members = 100, 3–4 = 75, 2 = 50, 1 = 25',
        data_source: 'team_memberships table with last_active_at filter',
      })
    }

    // Add support health if no billing
    if (!hasBilling) {
      dimensions.push({
        dimension: 'support_health',
        weight: 0.15,
        metric: 'Open support tickets in last 30 days',
        scoring: '0 tickets = 100, 1 = 75, 2–3 = 50, 4+ = 25',
        data_source: 'Intercom or support system API',
      })
    }

    const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0)
    const normalizedDimensions = dimensions.map(d => ({
      ...d,
      weight: Math.round((d.weight / totalWeight) * 100) / 100,
    }))

    return {
      formula: 'Weighted sum of dimension scores × weights',
      calculation: 'health_score = Σ (dimension_score × dimension_weight)',
      dimensions: normalizedDimensions,
      thresholds: {
        healthy: '75–100 — no intervention needed',
        at_risk: '50–74 — proactive outreach recommended',
        critical: '25–49 — immediate CS intervention required',
        churned: '0–24 — exit interview and win-back sequence',
      },
      update_frequency: 'Recalculate daily via scheduled cron job',
      storage: 'Add health_score and health_score_updated_at columns to users or accounts table',
    }
  }

  buildOnboardingSteps(app_type, features) {
    const hasAuth = features.includes('auth') || features.includes('login')
    const hasBilling = features.includes('billing') || features.includes('payments')
    const hasTeam = features.includes('team') || features.includes('invite')
    const hasIntegrations = features.includes('integrations') || features.includes('api')

    const typeSteps = {
      saas: [
        'Step 1 — Create account: email + password or OAuth (Google). Limit to one field beyond email.',
        'Step 2 — Tell us about yourself: role, company size, or use case (1 question max, skippable).',
        'Step 3 — Create your first [core object] (project, workspace, form, etc.) with a guided template.',
        'Step 4 — Experience the core value: complete the action that delivers your app\'s primary promise.',
        'Step 5 — Celebrate: confirm completion with a success state and a clear "what\'s next" CTA.',
      ],
      marketplace: [
        'Buyer Step 1 — Browse featured listings without requiring account creation.',
        'Buyer Step 2 — Prompt to create account at the moment of first intent (save listing, send message).',
        'Buyer Step 3 — Complete profile: photo, verification, payment method.',
        'Buyer Step 4 — First inquiry or transaction with escrow safety net prominently shown.',
        'Seller Step 1 — White-glove invite flow: "You\'ve been selected" framing.',
        'Seller Step 2 — Create first listing with AI-assisted description and photo upload.',
        'Seller Step 3 — Set availability, pricing, and response time.',
        'Seller Step 4 — First transaction with payment setup and identity verification.',
      ],
      consumer: [
        'Step 1 — Sign up with social login (Apple, Google) — no form, one tap.',
        'Step 2 — Personalization: 3 preference questions to customize the experience.',
        'Step 3 — See the core content or feature immediately — do not gate behind a long setup.',
        'Step 4 — First action: create, react, share, or follow. Make it feel good.',
        'Step 5 — Social connection: find friends or follow suggested accounts.',
        'Step 6 — Push notification opt-in: ask after they have experienced value, not on first launch.',
      ],
      ecommerce: [
        'Step 1 — Browse and discover without requiring account creation.',
        'Step 2 — Add to cart — only prompt for account at checkout.',
        'Step 3 — Guest checkout available — do not force account creation.',
        'Step 4 — Order confirmation with tracking link — set expectation immediately.',
        'Step 5 — Post-delivery: review request at D+7 after estimated delivery.',
      ],
      'developer-tools': [
        'Step 1 — Installation: one command (npm install, brew install, curl | sh).',
        'Step 2 — Quick start: working example in < 5 minutes, zero configuration.',
        'Step 3 — Guided tutorial: the most common real-world use case, step by step.',
        'Step 4 — IDE integration: VS Code extension or language server for autocomplete.',
        'Step 5 — Documentation reference: full API docs, searchable.',
        'Step 6 — Community: link to Discord, GitHub Discussions, or Slack for help.',
      ],
    }

    const steps = typeSteps[app_type] || typeSteps.saas

    if (hasBilling && !steps.some(s => s.toLowerCase().includes('payment') || s.toLowerCase().includes('billing'))) {
      steps.push('Billing step — add payment method during trial or after activation event, never before value is demonstrated.')
    }
    if (hasTeam && !steps.some(s => s.toLowerCase().includes('team') || s.toLowerCase().includes('invite'))) {
      steps.push('Team step — invite your first teammate. Make this step feel collaborative, not admin.')
    }
    if (hasIntegrations && !steps.some(s => s.toLowerCase().includes('integration') || s.toLowerCase().includes('connect'))) {
      steps.push('Integration step — connect the tool your users already use (Slack, GitHub, Google Drive).')
    }

    return steps
  }

  buildInterventions(app_type, plan_type, stage) {
    const interventions = []

    // Universal triggers
    const universal = [
      {
        trigger: 'No login in 3 days (during trial or onboarding)',
        response: 'Automated email: "Stuck? Here\'s how to get started in 5 minutes." Link to tutorial.',
        priority: 'high',
        automation: 'email + in-app notification',
      },
      {
        trigger: 'Activation event not completed within 48 hours of signup',
        response: 'In-app checklist reminder + CS email for high-value accounts.',
        priority: 'critical',
        automation: 'in-app tooltip + email',
      },
      {
        trigger: 'Health score drops 15+ points week over week',
        response: 'Flag for CS review. If high-touch: outbound call. If self-serve: email with "How can we help?".',
        priority: 'high',
        automation: 'CS alert + email',
      },
      {
        trigger: 'Support ticket opened (any severity)',
        response: 'Acknowledge within 2 hours. Resolution within 24 hours. Follow up 48 hours after resolution.',
        priority: 'high',
        automation: 'support system SLA',
      },
      {
        trigger: 'NPS survey response: detractor (0–6)',
        response: 'Immediate personal response from a human within 24 hours. Do not automate the detractor response.',
        priority: 'critical',
        automation: 'manual — human follow-up only',
      },
    ]

    interventions.push(...universal.map(i => `${i.trigger} → ${i.response} (${i.priority} priority)`))

    if (app_type === 'saas') {
      interventions.push('Trial day 12 of 14 → "Your trial ends in 2 days. Here\'s what you\'ve built." Summarize their activity.')
      interventions.push('Monthly usage below 30% of prior month → proactive "What changed?" outreach for paid accounts.')
    }

    if (plan_type === 'high-touch') {
      interventions.push('30/60/90-day check-in calls scheduled automatically after contract signature.')
      interventions.push('Quarterly business review (QBR) for all accounts above [ARR threshold].')
    }

    if (app_type === 'marketplace') {
      interventions.push('Seller with 0 transactions in 14 days → CS contacts to optimize listing or suggest pricing change.')
      interventions.push('Buyer dispute opened → CS notified immediately; response SLA 2 hours.')
    }

    return interventions
  }

  buildEscalationPaths(plan_type) {
    if (plan_type === 'high-touch') {
      return [
        'L1 — In-app help docs + chatbot (< 2 min response)',
        'L2 — CS email queue (< 4 hour response, business hours)',
        'L3 — CS dedicated rep (same-day response, SLA in contract)',
        'L4 — Engineering escalation for bugs or data issues (< 24 hours)',
        'L5 — Executive escalation for at-risk contract renewal',
      ]
    }
    if (plan_type === 'low-touch') {
      return [
        'L1 — In-app help docs + chatbot',
        'L2 — Email support (< 24 hour response)',
        'L3 — CS queue for accounts above MRR threshold',
        'L4 — Engineering for bug reports',
      ]
    }
    return [
      'L1 — In-app help docs',
      'L2 — Community forum or Discord',
      'L3 — Email support (< 48 hour response)',
      'L4 — Bug reports via GitHub issues (developer tools) or email',
    ]
  }

  buildSuccessMetrics(app_type) {
    return {
      leading_indicators: [
        'Time to first value (minutes from signup to activation event)',
        'Onboarding completion rate (% who complete all steps)',
        'D7 feature adoption rate (# of features used in first 7 days)',
      ],
      lagging_indicators: [
        'Net Revenue Retention (NRR) — should exceed 100% in healthy SaaS',
        'Churn rate — monthly and annual',
        'Expansion revenue — upsells and seat additions from existing customers',
      ],
      cs_efficiency: [
        'Tickets per customer per month — should decrease as docs improve',
        'Time to resolution (median) — target < 24 hours for non-billing issues',
        'CSAT or NPS from support interactions',
      ],
    }
  }

  async verify(output) {
    if (typeof output.health_score_formula !== 'object') throw new Error('CustomerSuccessAgent: health_score_formula must be an object')
    if (!Array.isArray(output.onboarding_steps)) throw new Error('CustomerSuccessAgent: onboarding_steps must be an array')
    if (!Array.isArray(output.interventions)) throw new Error('CustomerSuccessAgent: interventions must be an array')
    return output
  }
}

export default CustomerSuccessAgent
