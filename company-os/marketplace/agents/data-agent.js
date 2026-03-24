// company-os/marketplace/agents/data-agent.js — Data intelligence agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class DataAgent extends AgentBase {
  constructor() {
    super({ name: 'data-agent', phase: 'data-intelligence', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {number} [context.user_count]
   * @param {number} [context.activation_rate] — 0–1 decimal
   * @param {number} [context.d7_retention] — 0–1
   * @param {number} [context.d30_retention] — 0–1
   * @param {number} [context.churn_rate] — monthly 0–1
   * @param {number} [context.conversion_rate] — free to paid 0–1
   * @param {string[]} [context.funnel_steps] — ordered list of funnel steps
   * @param {Record<string, number>} [context.funnel_drop_rates] — step name → drop % 0–1
   * @param {boolean} [context.has_analytics]
   * @param {boolean} [context.has_ab_testing]
   * @param {string} [context.revenue_model]
   * @returns {{ funnel_analysis: object, drop_off_points: string[], ab_test_recommendations: string[] }}
   */
  async run(context) {
    this.log('info', 'Running data intelligence analysis', { users: context.user_count })

    const funnel_analysis = this._buildFunnelAnalysis(context)
    const drop_off_points = this._identifyDropOffPoints(context)
    const ab_test_recommendations = this._buildABTestRecommendations(context, drop_off_points)

    this.log('info', 'Data intelligence analysis complete')

    return {
      funnel_analysis,
      drop_off_points,
      ab_test_recommendations,
    }
  }

  _buildFunnelAnalysis(context) {
    const steps = context.funnel_steps ?? [
      'Visit landing page',
      'Click signup CTA',
      'Complete signup form',
      'Verify email',
      'Complete onboarding',
      'Core activation action',
      'Return (D7)',
      'Convert to paid',
    ]

    const benchmarks = {
      visit_to_signup: 0.03,       // 3% visitor-to-signup is solid for SaaS
      signup_to_activation: 0.40,  // 40% activate within first session
      activation_to_d7: 0.30,      // 30% retention at day 7
      d7_to_d30: 0.50,             // 50% of D7 retained at D30
      free_to_paid: 0.05,          // 5% free-to-paid conversion is SaaS benchmark
    }

    const actuals = {
      activation_rate: context.activation_rate ?? null,
      d7_retention: context.d7_retention ?? null,
      d30_retention: context.d30_retention ?? null,
      conversion_rate: context.conversion_rate ?? null,
      churn_rate: context.churn_rate ?? null,
    }

    const health = {}

    if (actuals.activation_rate !== null) {
      health.activation = {
        value: `${Math.round(actuals.activation_rate * 100)}%`,
        benchmark: `${Math.round(benchmarks.signup_to_activation * 100)}%`,
        status: actuals.activation_rate >= benchmarks.signup_to_activation ? 'ABOVE_BENCHMARK' : 'BELOW_BENCHMARK',
        note: actuals.activation_rate < 0.20
          ? 'Critical: fewer than 1 in 5 signups ever experience the core value. Redesign onboarding immediately.'
          : actuals.activation_rate < benchmarks.signup_to_activation
          ? 'Below benchmark. Map every step from signup to activation and instrument each one.'
          : 'At or above benchmark. Focus on improving D7 retention next.',
      }
    }

    if (actuals.d7_retention !== null) {
      health.d7_retention = {
        value: `${Math.round(actuals.d7_retention * 100)}%`,
        benchmark: `${Math.round(benchmarks.activation_to_d7 * 100)}%`,
        status: actuals.d7_retention >= benchmarks.activation_to_d7 ? 'ABOVE_BENCHMARK' : 'BELOW_BENCHMARK',
        note: actuals.d7_retention < 0.10
          ? 'Critical: <10% D7 retention means the product has no habit loop. Users try it and leave.'
          : 'D7 retention is the best early predictor of long-term retention. Target 40%+ for strong product-market fit.',
      }
    }

    if (actuals.d30_retention !== null) {
      health.d30_retention = {
        value: `${Math.round(actuals.d30_retention * 100)}%`,
        benchmark: '15–25% is typical for SaaS',
        note: actuals.d30_retention >= 0.25
          ? 'Strong D30 retention. Your core use case has genuine repeat value.'
          : 'D30 retention below 25% indicates the product has not become a habit. Interview day-30 churners.',
      }
    }

    if (actuals.churn_rate !== null) {
      health.monthly_churn = {
        value: `${Math.round(actuals.churn_rate * 100)}%`,
        annual_equivalent: `${Math.round((1 - Math.pow(1 - actuals.churn_rate, 12)) * 100)}%`,
        benchmark: '2–5% monthly churn is typical for SMB SaaS',
        note: actuals.churn_rate > 0.10
          ? 'Critical: >10% monthly churn means you replace half your customers every 6 months. Fix this before scaling acquisition.'
          : actuals.churn_rate > 0.05
          ? 'Churn above benchmark. Investigate correlation with cohort, acquisition channel, and onboarding completion.'
          : 'Healthy churn rate. Monitor for increases as you grow into new customer segments.',
      }
    }

    return {
      funnel_steps: steps,
      drop_rate_by_step: context.funnel_drop_rates ?? {},
      health_metrics: health,
      benchmarks,
      overall_assessment: this._overallAssessment(actuals, benchmarks),
    }
  }

  _overallAssessment(actuals, benchmarks) {
    const signals = []

    if (actuals.activation_rate !== null && actuals.activation_rate < benchmarks.signup_to_activation) {
      signals.push('activation_problem')
    }
    if (actuals.d7_retention !== null && actuals.d7_retention < benchmarks.activation_to_d7) {
      signals.push('retention_problem')
    }
    if (actuals.churn_rate !== null && actuals.churn_rate > 0.05) {
      signals.push('churn_problem')
    }
    if (actuals.conversion_rate !== null && actuals.conversion_rate < benchmarks.free_to_paid) {
      signals.push('monetization_problem')
    }

    if (signals.length === 0 && Object.values(actuals).some(v => v !== null)) {
      return 'Metrics are at or above benchmarks. Focus on scale — your unit economics are healthy enough to invest in acquisition.'
    }
    if (signals.includes('activation_problem')) {
      return 'Activation is the critical bottleneck. Every other metric will improve once more users experience the core value. Fix onboarding before anything else.'
    }
    if (signals.includes('retention_problem')) {
      return 'Retention gap detected. Users are activating but not returning. The product habit loop needs strengthening before scaling acquisition spend.'
    }
    if (signals.includes('churn_problem')) {
      return 'Churn is the top priority. High churn makes every acquisition investment a leaky bucket. Survey churned users and ship retention fixes before growth.'
    }
    return 'Some metrics below benchmark. Instrument your funnel, identify the largest drop-off point, and run one experiment at a time.'
  }

  _identifyDropOffPoints(context) {
    const dropOffs = []
    const steps = context.funnel_steps ?? []
    const dropRates = context.funnel_drop_rates ?? {}

    // Analyze provided drop rates
    for (const [step, rate] of Object.entries(dropRates)) {
      if (rate > 0.5) {
        dropOffs.push(`CRITICAL: ${step} — ${Math.round(rate * 100)}% of users drop here. This is the single highest-leverage fix in your entire funnel.`)
      } else if (rate > 0.3) {
        dropOffs.push(`HIGH: ${step} — ${Math.round(rate * 100)}% drop-off. Above acceptable threshold. Investigate with session recordings and user interviews.`)
      } else if (rate > 0.15) {
        dropOffs.push(`MEDIUM: ${step} — ${Math.round(rate * 100)}% drop-off. Expected but worth optimizing after critical issues are resolved.`)
      }
    }

    // Infer likely drop-offs from other signals
    if (context.activation_rate !== null && context.activation_rate < 0.3) {
      dropOffs.push('Inferred: Onboarding → First activation action has significant drop-off. Users are not reaching the aha moment. Add a progress indicator and reduce steps to activation.')
    }

    if (!context.has_analytics) {
      dropOffs.push('Cannot identify drop-off points — no analytics instrumentation detected. Add PostHog (free), Mixpanel, or Amplitude immediately to get funnel visibility.')
    }

    if (dropOffs.length === 0) {
      dropOffs.push('No drop-off data available. Instrument your funnel with event tracking: pageview, signup_started, signup_completed, onboarding_step_N, activation_event, return_visit, upgrade_started, upgrade_completed.')
    }

    return dropOffs
  }

  _buildABTestRecommendations(context, dropOffPoints) {
    const tests = []

    // Always recommend these foundational tests
    tests.push({
      test: 'Landing page headline',
      hypothesis: 'A problem-focused headline ("Stop losing customers to slow response times") outperforms a feature headline ("The all-in-one support platform")',
      metric: 'Signup rate',
      effort: 'Low — 1 day to implement',
      priority: 'High',
    })

    tests.push({
      test: 'Onboarding step count',
      hypothesis: 'A 3-step onboarding (name → use case → first action) activates more users than a 7-step wizard',
      metric: 'Activation rate',
      effort: 'Medium — 1 week',
      priority: 'High',
    })

    if (context.activation_rate !== null && context.activation_rate < 0.4) {
      tests.push({
        test: 'Onboarding email timing',
        hypothesis: 'Sending the onboarding email 30 minutes after signup (when intent is still high) outperforms 24 hours',
        metric: 'Return visit rate',
        effort: 'Low — email config change',
        priority: 'High',
      })
    }

    if (context.churn_rate !== null && context.churn_rate > 0.05) {
      tests.push({
        test: 'In-app retention nudge',
        hypothesis: 'A contextual nudge showing users their progress (e.g., "You have saved 3 hours this week") improves D30 retention',
        metric: 'D30 retention rate',
        effort: 'Medium — requires event tracking',
        priority: 'High',
      })
    }

    if (context.conversion_rate !== null && context.conversion_rate < 0.05) {
      tests.push({
        test: 'Pricing page CTA copy',
        hypothesis: '"Start free trial" outperforms "Get started" for free-trial-to-paid conversion',
        metric: 'Upgrade click-through rate',
        effort: 'Low — copy change',
        priority: 'Medium',
      })

      tests.push({
        test: 'Paywall timing',
        hypothesis: 'Showing the upgrade prompt after users hit a usage limit (value-first) converts better than showing it on day 7',
        metric: 'Conversion rate',
        effort: 'Medium — requires usage tracking',
        priority: 'High',
      })
    }

    tests.push({
      test: 'Social proof placement',
      hypothesis: 'Moving social proof (logos, testimonials) above the fold on the landing page increases signup rate',
      metric: 'Signup conversion rate',
      effort: 'Low — layout change',
      priority: 'Medium',
    })

    if (!context.has_ab_testing) {
      tests.unshift({
        test: 'Setup prerequisite',
        hypothesis: 'N/A — analytics infrastructure must come first',
        metric: 'N/A',
        effort: 'Low — install PostHog or GrowthBook (free tier)',
        priority: 'CRITICAL — do this before any tests',
      })
    }

    return tests.map(t =>
      `[${t.priority}] ${t.test}: ${t.hypothesis} | Metric: ${t.metric} | Effort: ${t.effort}`
    )
  }
}

export default DataAgent
