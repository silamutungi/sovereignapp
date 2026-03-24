// company-os/functional/agents/cfo-agent.js — CFO financial analysis agent
// UNLOCKS: when context has payment features

import { AgentBase } from '../../../shared/agent-base-class.js'

export class CFOAgent extends AgentBase {
  constructor() {
    super({ name: 'cfo-agent', phase: 'financial-analysis', version: '1.0.0' })
  }

  static isUnlocked(context) {
    return !!(
      context.has_payments ||
      context.payment_features ||
      context.stripe_enabled ||
      context.pricing_tiers ||
      context.revenue_model
    )
  }

  /**
   * @param {object} context
   * @param {number} [context.monthly_revenue]
   * @param {number} [context.monthly_burn]
   * @param {number} [context.cac] — cost to acquire a customer
   * @param {number} [context.ltv] — lifetime value
   * @param {number} [context.mrr]
   * @param {number} [context.churn_rate] — monthly churn as decimal e.g. 0.05
   * @param {string[]} [context.pricing_tiers]
   * @param {number} [context.team_size]
   * @param {string} [context.revenue_model] — 'saas' | 'marketplace' | 'transactional' | 'freemium'
   * @returns {{ ltv_cac: number, burn_rate: number|null, pricing_recommendations: string[], metrics: object }}
   */
  async run(context) {
    this.log('info', 'Running financial analysis', { model: context.revenue_model })

    const ltv = this._computeLTV(context)
    const cac = context.cac ?? null
    const ltv_cac = ltv !== null && cac !== null && cac > 0 ? Math.round((ltv / cac) * 100) / 100 : null

    const burn_rate = this._computeBurnRate(context)

    const pricing_recommendations = this._buildPricingRecommendations(context, ltv_cac)

    const metrics = {
      mrr: context.mrr ?? null,
      arr: context.mrr != null ? Math.round(context.mrr * 12) : null,
      gross_margin: this._estimateGrossMargin(context),
      runway_months: this._computeRunway(context, burn_rate),
      payback_period_months: ltv !== null && cac !== null && context.monthly_revenue_per_customer
        ? Math.ceil(cac / context.monthly_revenue_per_customer)
        : null,
      churn_rate: context.churn_rate ?? null,
      revenue_model: context.revenue_model ?? 'unknown',
    }

    this.log('info', 'Financial analysis complete', { ltv_cac, burn_rate })

    return {
      ltv_cac: ltv_cac ?? 0,
      burn_rate,
      pricing_recommendations,
      metrics,
      disclaimer: 'This is educational analysis, not financial advice.',
    }
  }

  _computeLTV(context) {
    if (context.ltv != null) return context.ltv
    if (context.monthly_revenue_per_customer != null && context.churn_rate != null && context.churn_rate > 0) {
      return Math.round(context.monthly_revenue_per_customer / context.churn_rate)
    }
    if (context.arpu != null && context.avg_customer_lifetime_months != null) {
      return Math.round(context.arpu * context.avg_customer_lifetime_months)
    }
    return null
  }

  _computeBurnRate(context) {
    if (context.monthly_burn != null) return context.monthly_burn
    if (context.monthly_expenses != null && context.monthly_revenue != null) {
      return Math.max(0, context.monthly_expenses - context.monthly_revenue)
    }
    return null
  }

  _computeRunway(context, burn_rate) {
    if (burn_rate == null || burn_rate === 0) return null
    if (context.cash_on_hand != null) {
      return Math.floor(context.cash_on_hand / burn_rate)
    }
    return null
  }

  _estimateGrossMargin(context) {
    if (context.gross_margin != null) return context.gross_margin
    const model = context.revenue_model
    if (model === 'saas') return 0.75
    if (model === 'marketplace') return 0.30
    if (model === 'transactional') return 0.20
    if (model === 'freemium') return 0.70
    return null
  }

  _buildPricingRecommendations(context, ltv_cac) {
    const recs = []

    if (ltv_cac !== null) {
      if (ltv_cac < 1) {
        recs.push('LTV:CAC ratio is below 1 — acquiring customers costs more than they return. Reduce CAC or increase price.')
      } else if (ltv_cac < 3) {
        recs.push('LTV:CAC ratio is below 3 — the industry benchmark for healthy SaaS. Focus on increasing ACV or reducing churn.')
      } else if (ltv_cac >= 3 && ltv_cac < 5) {
        recs.push('LTV:CAC ratio is healthy (3–5). Maintain current acquisition efficiency while growing.')
      } else {
        recs.push('LTV:CAC ratio above 5 — strong unit economics. Consider increasing marketing spend to accelerate growth.')
      }
    }

    if (context.churn_rate != null) {
      if (context.churn_rate > 0.10) {
        recs.push('Monthly churn above 10% is a critical retention problem. Invest in onboarding and customer success before scaling acquisition.')
      } else if (context.churn_rate > 0.05) {
        recs.push('Monthly churn between 5–10%. Target below 2% for healthy SaaS. Consider adding annual plan incentives to lock in revenue.')
      }
    }

    if (!context.pricing_tiers || context.pricing_tiers.length < 2) {
      recs.push('Single-tier pricing leaves revenue on the table. Introduce a 3-tier Good/Better/Best structure to capture willingness-to-pay across segments.')
    }

    if (context.pricing_tiers && context.pricing_tiers.length >= 2) {
      recs.push('Annual plan with 2-month discount (16% off) typically improves cash flow and reduces churn by 20–30%.')
    }

    if (context.revenue_model === 'freemium') {
      recs.push('Freemium conversion benchmarks: 2–5% is typical. Identify the one feature that drives paid conversion and gate it clearly.')
    }

    if (!context.mrr && context.monthly_revenue) {
      recs.push('Track MRR (Monthly Recurring Revenue) separately from one-time revenue to accurately measure growth trajectory.')
    }

    if (recs.length === 0) {
      recs.push('Establish baseline financial metrics: MRR, CAC, LTV, and churn rate before making pricing changes.')
    }

    return recs
  }
}

export default CFOAgent
