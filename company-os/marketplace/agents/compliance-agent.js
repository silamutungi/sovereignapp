// company-os/marketplace/agents/compliance-agent.js — Compliance guidance agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class ComplianceAgent extends AgentBase {
  constructor() {
    super({ name: 'compliance-agent', phase: 'compliance', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {string[]} [context.target_regions] — e.g. ['US', 'EU', 'UK', 'CA', 'AU']
   * @param {string} [context.industry] — 'saas' | 'fintech' | 'healthcare' | 'edtech' | 'ecommerce'
   * @param {boolean} [context.has_payments]
   * @param {boolean} [context.collects_user_data]
   * @param {boolean} [context.stores_pii]
   * @param {boolean} [context.stores_health_data]
   * @param {boolean} [context.serves_children]
   * @param {boolean} [context.has_user_accounts]
   * @param {boolean} [context.has_ai_features]
   * @param {boolean} [context.b2b_enterprise_target]
   * @returns {{ applicable_frameworks: string[], gaps: string[], checklist: object }}
   */
  async run(context) {
    this.log('info', 'Running compliance assessment', { regions: context.target_regions, industry: context.industry })

    const applicable_frameworks = this._identifyFrameworks(context)
    const gaps = this._identifyGaps(context, applicable_frameworks)
    const checklist = this._buildChecklist(context, applicable_frameworks)

    this.log('info', 'Compliance assessment complete', {
      frameworks: applicable_frameworks.length,
      gaps: gaps.length,
    })

    return {
      applicable_frameworks,
      gaps,
      checklist,
      disclaimer: 'This is general compliance guidance, not legal advice.',
    }
  }

  _identifyFrameworks(context) {
    const frameworks = []
    const regions = context.target_regions ?? []
    const hasEU = regions.some(r => ['EU', 'UK', 'EEA'].includes(r))
    const hasCA = regions.includes('CA')
    const hasUS = regions.includes('US') || regions.length === 0
    const hasAU = regions.includes('AU')
    const industry = (context.industry ?? '').toLowerCase()

    if (hasEU && context.collects_user_data) {
      frameworks.push('GDPR (General Data Protection Regulation) — EU/UK data protection law. Applies to any company that processes data of EU/UK residents, regardless of where the company is based.')
    }

    if (hasCA && context.collects_user_data) {
      frameworks.push('CCPA / CPRA (California Consumer Privacy Act) — California data privacy law. Applies if you have 100k+ CA consumers/year, or earn 50%+ of revenue from selling their data.')
    }

    if (hasUS && context.stores_health_data) {
      frameworks.push('HIPAA (Health Insurance Portability and Accountability Act) — US health data law. Applies to all entities handling protected health information (PHI). Non-compliance fines: $100–$50,000 per violation.')
    }

    if (context.serves_children && hasUS) {
      frameworks.push('COPPA (Children\'s Online Privacy Protection Act) — US law protecting children under 13. Requires verifiable parental consent before collecting any data from minors.')
    }

    if (context.has_payments) {
      frameworks.push('PCI DSS (Payment Card Industry Data Security Standard) — global standard for handling payment card data. Level 4 (self-assessment) for <20k transactions/year. Level 1 (full audit) for 6M+/year.')
    }

    if (context.b2b_enterprise_target || industry.includes('enterprise')) {
      frameworks.push('SOC 2 Type II — enterprise trust framework audited by a CPA firm. Required by most enterprise procurement teams. Takes 6–12 months and $15k–$50k to complete initially.')
    }

    if (hasAU && context.collects_user_data) {
      frameworks.push('Australian Privacy Act 1988 (APPs) — Australia\'s federal privacy law. Applies to organizations with >$3M annual turnover or that deal in personal information.')
    }

    if (industry.includes('fintech') && hasUS) {
      frameworks.push('FinCEN / BSA (Bank Secrecy Act) — AML/KYC requirements for US financial services. Required if you facilitate money movement between parties.')
    }

    if (context.has_ai_features) {
      frameworks.push('EU AI Act (2024) — risk-based AI regulation. High-risk AI systems require conformity assessments. Limited risk AI systems require transparency disclosures. Applies to EU users.')
    }

    if (context.b2b_enterprise_target) {
      frameworks.push('ISO 27001 — international information security management standard. Not legally required, but frequently requested by enterprise procurement teams in Europe and Asia.')
    }

    if (frameworks.length === 0) {
      frameworks.push('General data protection best practices apply even without a specific legal framework. Follow GDPR principles as a baseline — they represent the current global standard for ethical data handling.')
    }

    return frameworks
  }

  _identifyGaps(context, applicable_frameworks) {
    const gaps = []

    const hasGDPR = applicable_frameworks.some(f => f.includes('GDPR'))
    const hasPCI = applicable_frameworks.some(f => f.includes('PCI'))
    const hasHIPAA = applicable_frameworks.some(f => f.includes('HIPAA'))
    const hasSOC2 = applicable_frameworks.some(f => f.includes('SOC 2'))

    if (hasGDPR) {
      if (!context.has_privacy_policy) gaps.push('GDPR: No privacy policy — required before processing any EU/UK data.')
      if (!context.has_cookie_consent) gaps.push('GDPR: No cookie consent mechanism — pre-ticked boxes and assumed consent are non-compliant.')
      if (!context.has_data_deletion) gaps.push('GDPR: No account deletion flow — right to erasure is a core GDPR requirement.')
      if (!context.has_data_export) gaps.push('GDPR: No data export feature — right to portability requires a machine-readable export.')
      if (!context.has_dpa_with_vendors) gaps.push('GDPR: No Data Processing Agreements with vendors (Supabase, Resend, Stripe) — required before sharing any EU data.')
    }

    if (hasPCI) {
      if (!context.uses_hosted_checkout) gaps.push('PCI DSS: Handling raw card numbers directly requires Level 1 PCI DSS audit. Use Stripe hosted checkout to avoid this entirely.')
      if (!context.has_webhook_validation) gaps.push('PCI DSS: Unvalidated payment webhooks can be replayed. Validate Stripe webhook signatures on every event.')
    }

    if (hasHIPAA) {
      if (!context.has_baa_with_vendors) gaps.push('HIPAA: No Business Associate Agreement (BAA) with cloud vendors — required for any vendor who processes PHI on your behalf.')
      if (!context.has_audit_log) gaps.push('HIPAA: No audit log for PHI access — required to detect and investigate unauthorized access.')
      if (!context.has_encryption_at_rest) gaps.push('HIPAA: PHI must be encrypted at rest and in transit.')
    }

    if (hasSOC2 && !context.has_soc2_in_progress) {
      gaps.push('SOC 2: Not started. For enterprise targets, begin the SOC 2 process 6–9 months before your first enterprise sales conversation.')
    }

    if (!context.has_incident_response_plan) {
      gaps.push('All frameworks: No incident response plan. GDPR requires breach notification within 72 hours. Document a basic response plan before launch.')
    }

    if (!context.has_vendor_security_review) {
      gaps.push('General: Third-party vendors (Supabase, Resend, Stripe, Vercel) have not been reviewed for compliance certifications. Confirm each has SOC 2 Type II before storing user data with them.')
    }

    return gaps
  }

  _buildChecklist(context, applicable_frameworks) {
    const checklist = {
      immediate: [],
      before_launch: [],
      within_90_days: [],
      within_12_months: [],
    }

    // Immediate
    checklist.immediate.push('[ ] Review all applicable frameworks above with your attorney')
    checklist.immediate.push('[ ] Confirm all third-party vendors (Supabase, Stripe, Resend) have SOC 2 Type II certifications')
    if (!context.has_privacy_policy) {
      checklist.immediate.push('[ ] Draft privacy policy using Termly or iubenda, then have an attorney review')
    }

    // Before launch
    checklist.before_launch.push('[ ] Privacy Policy live at /privacy')
    checklist.before_launch.push('[ ] Terms of Service live at /terms')
    checklist.before_launch.push('[ ] All secrets in environment variables — zero hardcoded credentials')
    checklist.before_launch.push('[ ] Row-Level Security enabled on all Supabase tables containing user data')
    checklist.before_launch.push('[ ] Security contact email published (security@yourdomain.com)')

    if (applicable_frameworks.some(f => f.includes('GDPR'))) {
      checklist.before_launch.push('[ ] GDPR cookie consent banner implemented with genuine opt-in')
      checklist.before_launch.push('[ ] Data retention policy defined and enforced (auto-delete stale data)')
      checklist.before_launch.push('[ ] DPAs signed with all vendors processing EU data')
    }

    if (applicable_frameworks.some(f => f.includes('PCI'))) {
      checklist.before_launch.push('[ ] Using Stripe hosted checkout — zero raw card data touches your servers')
      checklist.before_launch.push('[ ] Stripe webhook signature validation in place')
    }

    // Within 90 days
    checklist.within_90_days.push('[ ] User data export endpoint live (GDPR right to portability)')
    checklist.within_90_days.push('[ ] Account deletion flow removes all PII within 30 days of request')
    checklist.within_90_days.push('[ ] Basic incident response plan documented')
    checklist.within_90_days.push('[ ] Penetration test or security audit completed')

    // Within 12 months
    if (context.b2b_enterprise_target) {
      checklist.within_12_months.push('[ ] Begin SOC 2 Type II process — hire a CISO or compliance consultant')
    }
    checklist.within_12_months.push('[ ] Annual security review of all third-party integrations')
    checklist.within_12_months.push('[ ] User access review — remove stale accounts and permissions')
    checklist.within_12_months.push('[ ] Review and update privacy policy with any new data processing activities')

    return checklist
  }
}

export default ComplianceAgent
