// company-os/marketplace/agents/investor-relations-agent.js — Investor relations agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class InvestorRelationsAgent extends AgentBase {
  constructor() {
    super({ name: 'investor-relations-agent', phase: 'investor-relations', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {string} [context.app_name]
   * @param {number} [context.mrr]
   * @param {number} [context.mom_growth_rate]
   * @param {number} [context.user_count]
   * @param {number} [context.churn_rate]
   * @param {number} [context.months_runway]
   * @param {string[]} [context.key_milestones] — milestones hit this period
   * @param {string[]} [context.next_milestones] — milestones planned next period
   * @param {string[]} [context.current_investors]
   * @param {string} [context.stage]
   * @param {string} [context.founder_name]
   * @param {number} [context.arr]
   * @param {number} [context.nps]
   * @returns {{ update_template: string, key_metrics_to_track: string[], cap_table_notes: string }}
   */
  async run(context) {
    this.log('info', 'Running investor relations analysis', { stage: context.stage })

    const update_template = this._buildUpdateTemplate(context)
    const key_metrics_to_track = this._buildKeyMetrics(context)
    const cap_table_notes = this._buildCapTableNotes(context)

    this.log('info', 'Investor relations analysis complete')

    return {
      update_template,
      key_metrics_to_track,
      cap_table_notes,
    }
  }

  _buildUpdateTemplate(context) {
    const name = context.app_name ?? '[Product Name]'
    const founder = context.founder_name ?? '[Founder]'
    const mrr = context.mrr != null ? `$${context.mrr.toLocaleString()}` : '[MRR]'
    const growth = context.mom_growth_rate != null ? `${Math.round(context.mom_growth_rate * 100)}%` : '[X%]'
    const runway = context.months_runway != null ? `${context.months_runway} months` : '[X months]'
    const users = context.user_count != null ? context.user_count.toLocaleString() : '[X]'
    const milestones = context.key_milestones ?? ['[Milestone 1]', '[Milestone 2]']
    const nextMilestones = context.next_milestones ?? ['[Next milestone 1]', '[Next milestone 2]']
    const investors = context.current_investors ?? []

    return `SUBJECT: ${name} — Monthly Update [Month YYYY]

Hi ${investors.length > 0 ? investors.join(', ') : '[Investor Names]'},

Here is the monthly update for ${name}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE NUMBER THAT MATTERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MRR: ${mrr} (${growth} MoM)
Runway: ${runway}
Active users: ${users}
${context.churn_rate != null ? `Monthly churn: ${Math.round(context.churn_rate * 100)}%` : ''}
${context.nps != null ? `NPS: ${context.nps}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT SHIPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${milestones.map(m => `• ${m}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT IS NEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${nextMilestones.map(m => `• ${m}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHERE I NEED HELP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[One specific ask — a warm intro, a candidate referral, a customer connection. Be specific. Vague asks get ignored.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT CONCERNS ME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[One honest risk or challenge. This builds trust faster than anything else. Investors who are surprised by problems become ex-investors.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DASHBOARD LINK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Link to live metrics dashboard — Baremetrics, ChartMogul, or Notion. Make it a one-click view, not an attachment.]

Thanks,
${founder}

---

INVESTOR UPDATE RULES:
• Send monthly — not quarterly. Investors who hear from you monthly invest in future rounds. Investors who hear quarterly forget you exist.
• Keep it under 5 minutes to read. If you need more than 300 words, you are burying the signal in noise.
• Always include one honest concern. Transparency builds trust faster than polish.
• Always include one specific ask. Generic "let me know if you can help" asks get no response.
• Never miss a month. A missed update is the #1 way to lose investor confidence without a single bad metric.`
  }

  _buildKeyMetrics(context) {
    const model = context.revenue_model ?? 'saas'
    const metrics = []

    // Universal SaaS metrics
    metrics.push('MRR (Monthly Recurring Revenue) — the single most important number. Track with stripe or ChartMogul, not a spreadsheet.')
    metrics.push('MRR Growth Rate (month-over-month %) — 10–15% MoM is strong for early-stage SaaS. 20%+ is exceptional.')
    metrics.push('Net MRR (New MRR + Expansion MRR − Churned MRR) — measures the health of the revenue engine holistically.')
    metrics.push('Monthly churn rate (% of MRR lost per month) — target below 2% for SMB SaaS, below 1% for enterprise.')
    metrics.push('Active users (DAU / WAU / MAU depending on product frequency) — define "active" as completing a core action, not just logging in.')

    // Revenue quality
    metrics.push('Average Revenue Per Account (ARPA) — tracks pricing health over time.')
    metrics.push('LTV (Lifetime Value) — MRR per customer / monthly churn rate. The denominator matters more than the numerator.')
    metrics.push('CAC (Customer Acquisition Cost) — total sales + marketing spend / new customers acquired in the period.')
    metrics.push('LTV:CAC ratio — must be >3x to be a healthy SaaS business. Target >5x at scale.')
    metrics.push('CAC payback period (months) — total CAC / ARPA. Target <12 months for SMB, <18 for mid-market.')

    // Retention
    metrics.push('D7 retention (% of new users who return on day 7) — best early predictor of long-term retention.')
    metrics.push('D30 retention (% of new users still active at day 30) — target 25%+ for strong PMF signal.')
    metrics.push('Net Revenue Retention (NRR) — (Starting MRR + Expansion − Contraction − Churn) / Starting MRR. Target >100% (means existing customers are growing faster than they churn).')

    if (model === 'freemium') {
      metrics.push('Free-to-paid conversion rate — industry benchmark is 2–5%. Below 1% indicates a pricing or value alignment problem.')
      metrics.push('Time-to-convert (days from signup to first payment) — shorter is better; reduces risk of churn before monetization.')
    }

    if (model === 'marketplace') {
      metrics.push('GMV (Gross Merchandise Value) — total transaction value flowing through the platform.')
      metrics.push('Take rate (revenue / GMV %) — reflects pricing power and marketplace health.')
      metrics.push('Liquidity (% of listings that transact within 30 days) — the most important marketplace health metric.')
    }

    // Operational
    metrics.push('Runway (months of operating capital remaining at current burn) — maintain >12 months before starting a fundraise.')
    metrics.push('Burn multiple (net burn / net new ARR) — target <1x; burning more than you are generating in new ARR is unsustainable.')
    metrics.push('Headcount — total team size and monthly payroll as % of revenue. Key input to sustainable growth decisions.')

    return metrics
  }

  _buildCapTableNotes(context) {
    const stage = context.stage ?? 'pre-seed'

    const notes = []

    notes.push(`CAP TABLE PRINCIPLES FOR ${stage.toUpperCase()} STAGE:`)
    notes.push('')

    if (stage === 'pre-seed') {
      notes.push('Pre-seed: Protect your ownership aggressively. It is very hard to get back equity once given away.')
      notes.push('Acceptable pre-seed dilution: 5–15% for $250k–$750k. More than 20% at pre-seed is founder-unfriendly.')
      notes.push('Y Combinator standard deal: $500k SAFE at $10M cap + $125k uncapped MFN. This is the market benchmark for pre-seed.')
      notes.push('Do not give equity to advisors without a vesting schedule: 0.1–0.5% with 1-year cliff and 4-year total vest.')
      notes.push('Employee option pool: create a 10% pool pre-seed; expand to 15–20% at Series A. The pool is almost always created pre-money (diluting founders, not new investors).')
    } else if (stage === 'seed') {
      notes.push('Seed: Target $1M–$3M on a SAFE or priced round. Typical seed dilution: 15–25%.')
      notes.push('SAFE vs priced round: SAFEs are faster and cheaper but have no governance. Priced rounds give institutional investors a board seat.')
      notes.push('Post-money SAFE (Y Combinator standard) — use this. Pre-money SAFEs are more complex and founder-unfriendly.')
      notes.push('Pro-rata rights: standard in seed rounds. Gives investors the right to participate in future rounds to maintain ownership percentage.')
      notes.push('Information rights: standard in priced rounds. Commit to quarterly financials and annual audited accounts for investors over $25k.')
    } else if (stage === 'series-a') {
      notes.push('Series A: Typical range $5M–$15M for 20–25% dilution. Lead investor takes a board seat.')
      notes.push('Board composition: after Series A, typical structure is 2 founders, 1 lead investor, 1 independent. Maintain founder control by keeping the independent seat friendly.')
      notes.push('Protective provisions: Series A investors will request veto rights on major decisions (sale, additional raises, large expenditures). These are normal — negotiate the thresholds.')
      notes.push('Anti-dilution: broad-based weighted average is standard and founder-friendly. Full ratchet anti-dilution is investor-friendly and should be resisted.')
    }

    notes.push('')
    notes.push('CAP TABLE HYGIENE (applies to all stages):')
    notes.push('• Use Carta or Pulley from day one — never manage your cap table in a spreadsheet.')
    notes.push('• Every equity grant (founder, employee, advisor) needs a board resolution and signed agreement.')
    notes.push('• 83(b) election: US founders must file within 30 days of receiving restricted stock. Missing this window is an irreversible tax mistake.')
    notes.push('• Cliff and vest: 1-year cliff, 4-year vest is the standard for all equity (founders who leave before the cliff get nothing).')
    notes.push('• Single vs double trigger acceleration: double trigger (change of control + termination) is standard for founders and senior employees.')

    return notes.join('\n')
  }
}

export default InvestorRelationsAgent
