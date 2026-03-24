// company-os/functional/agents/legal-agent.js — Legal risk assessment agent
// UNLOCKS: when app collects user data or has payments

import { AgentBase } from '../../../shared/agent-base-class.js'

/**
 * @typedef {object} Risk
 * @property {string} area
 * @property {string} severity — 'critical' | 'high' | 'medium' | 'low'
 * @property {string} description
 * @property {string} mitigation
 */

export class LegalAgent extends AgentBase {
  constructor() {
    super({ name: 'legal-agent', phase: 'legal-risk-assessment', version: '1.0.0' })
  }

  static isUnlocked(context) {
    return !!(
      context.collects_user_data ||
      context.has_payments ||
      context.has_user_accounts ||
      context.stores_pii ||
      context.has_subscriptions
    )
  }

  /**
   * @param {object} context
   * @param {boolean} [context.collects_user_data]
   * @param {boolean} [context.has_payments]
   * @param {boolean} [context.has_user_accounts]
   * @param {boolean} [context.stores_pii] — personally identifiable information
   * @param {boolean} [context.has_subscriptions]
   * @param {boolean} [context.has_privacy_policy]
   * @param {boolean} [context.has_terms_of_service]
   * @param {boolean} [context.has_cookie_banner]
   * @param {string[]} [context.target_regions] — e.g. ['EU', 'US', 'UK', 'CA']
   * @param {string} [context.industry] — e.g. 'healthcare' | 'fintech' | 'edtech' | 'saas'
   * @param {boolean} [context.stores_health_data]
   * @param {boolean} [context.serves_children] — under 13
   * @param {boolean} [context.has_user_content] — UGC
   * @returns {{ risks: Risk[], required_policies: string[], compliance_checklist: string[] }}
   */
  async run(context) {
    this.log('info', 'Running legal risk assessment', { industry: context.industry })

    const risks = this._identifyRisks(context)
    const required_policies = this._buildRequiredPolicies(context)
    const compliance_checklist = this._buildComplianceChecklist(context)

    this.log('info', 'Legal assessment complete', {
      risk_count: risks.length,
      critical: risks.filter(r => r.severity === 'critical').length,
    })

    return {
      risks,
      required_policies,
      compliance_checklist,
      disclaimer: 'This is general guidance, not legal advice. Consult a qualified attorney.',
    }
  }

  _identifyRisks(context) {
    /** @type {Risk[]} */
    const risks = []
    const regions = context.target_regions ?? []
    const hasEU = regions.includes('EU') || regions.includes('UK')
    const hasCA = regions.includes('CA')

    if (context.collects_user_data && !context.has_privacy_policy) {
      risks.push({
        area: 'Privacy Policy',
        severity: 'critical',
        description: 'Collecting user data without a privacy policy violates GDPR (EU), CCPA (CA), and most other data protection laws.',
        mitigation: 'Publish a privacy policy before collecting any user data. Use a generator like Termly or iubenda to get started, then have an attorney review it.',
      })
    }

    if (!context.has_terms_of_service && context.has_user_accounts) {
      risks.push({
        area: 'Terms of Service',
        severity: 'high',
        description: 'No Terms of Service means no enforceable agreement with users — liability is unlimited and abuse cannot be addressed.',
        mitigation: 'Publish Terms of Service before launch. At minimum define: acceptable use, IP ownership, limitation of liability, dispute resolution.',
      })
    }

    if (hasEU && context.collects_user_data && !context.has_cookie_banner) {
      risks.push({
        area: 'GDPR / Cookie Consent',
        severity: 'critical',
        description: 'Processing EU user data without consent mechanisms violates GDPR. Fines can reach 4% of global annual turnover.',
        mitigation: 'Implement a GDPR-compliant cookie banner with genuine opt-in (not pre-ticked boxes). Use Cookiehub, Osano, or CookieYes.',
      })
    }

    if (hasCA && context.collects_user_data) {
      risks.push({
        area: 'CCPA (California)',
        severity: 'high',
        description: 'California users have rights to know, delete, and opt-out of sale of their data under CCPA.',
        mitigation: 'Add a "Do Not Sell My Personal Information" link in the footer. Update your privacy policy with CCPA-required disclosures.',
      })
    }

    if (context.stores_health_data) {
      risks.push({
        area: 'HIPAA Compliance',
        severity: 'critical',
        description: 'Storing health data in the US requires HIPAA compliance — technical safeguards, business associate agreements, breach notification procedures.',
        mitigation: 'HIPAA compliance requires a healthcare attorney. Do not launch with health data until you have a signed BAA with all vendors (including Supabase/AWS).',
      })
    }

    if (context.serves_children) {
      risks.push({
        area: 'COPPA (Children Under 13)',
        severity: 'critical',
        description: 'Apps that knowingly collect data from children under 13 in the US must comply with COPPA — parental consent is mandatory.',
        mitigation: 'Add age verification at signup. Do not collect any data from users under 13 without verified parental consent. Consult a COPPA attorney.',
      })
    }

    if (context.has_payments && !context.has_pci_compliance) {
      risks.push({
        area: 'Payment Card Data / PCI DSS',
        severity: 'high',
        description: 'Handling payment card data requires PCI DSS compliance. Non-compliance can result in fines and loss of ability to process payments.',
        mitigation: 'Use Stripe or Paddle — they handle PCI DSS compliance when you use their hosted checkout. Never store raw card numbers yourself.',
      })
    }

    if (context.has_user_content) {
      risks.push({
        area: 'User-Generated Content / DMCA',
        severity: 'medium',
        description: 'Hosting user-generated content creates IP and DMCA liability risk.',
        mitigation: 'Add a DMCA takedown procedure to your Terms of Service. Implement a content reporting mechanism and respond to valid takedown requests within 10 business days.',
      })
    }

    if (context.industry === 'fintech' && !context.has_money_transmitter_license) {
      risks.push({
        area: 'Money Transmission / Financial Licensing',
        severity: 'critical',
        description: 'Moving money between users or acting as a financial intermediary in the US may require a money transmitter license in each state.',
        mitigation: 'Use licensed payment infrastructure (Stripe Connect, Plaid) that handles transmission licensing. Consult a fintech attorney before enabling P2P transfers.',
      })
    }

    if (!context.has_acceptable_use_policy && context.has_user_accounts) {
      risks.push({
        area: 'Acceptable Use Policy',
        severity: 'medium',
        description: 'Without an Acceptable Use Policy, you have no contractual basis for terminating abusive users.',
        mitigation: 'Include an Acceptable Use Policy in your Terms of Service. Explicitly prohibit illegal use, harassment, and spam.',
      })
    }

    if (context.has_ai_features && !context.has_ai_disclosures) {
      risks.push({
        area: 'AI / Algorithmic Decision Disclosure',
        severity: 'medium',
        description: 'EU AI Act and emerging US state laws require disclosure when AI makes or influences decisions affecting users.',
        mitigation: 'Disclose AI use in your privacy policy and product UI. Provide a human review option for consequential AI-driven decisions.',
      })
    }

    return risks.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
    })
  }

  _buildRequiredPolicies(context) {
    const policies = []
    const regions = context.target_regions ?? []
    const hasEU = regions.includes('EU') || regions.includes('UK')
    const hasCA = regions.includes('CA')

    if (context.collects_user_data || context.has_user_accounts) {
      policies.push('Privacy Policy — required before collecting any user data. Minimum: what you collect, why, retention period, user rights, contact.')
    }

    if (context.has_user_accounts) {
      policies.push('Terms of Service — defines the contract between you and users. Covers IP, liability, account termination, dispute resolution.')
    }

    if (hasEU && context.collects_user_data) {
      policies.push('Cookie Policy (GDPR) — required for EU users. Must list all cookies, categorize by purpose, and allow granular opt-in.')
      policies.push('GDPR Data Processing Addendum (DPA) — required when processing EU user data. Must define legal basis for each processing activity.')
    }

    if (hasCA) {
      policies.push('CCPA Privacy Notice — required for CA users. Must include "Do Not Sell" rights, data categories collected, and third-party sharing.')
    }

    if (context.has_user_content) {
      policies.push('DMCA Policy — required to maintain safe harbor protection for user-generated content under the Digital Millennium Copyright Act.')
    }

    if (context.has_payments || context.has_subscriptions) {
      policies.push('Refund Policy — required by Stripe and most payment processors. Must clearly state refund eligibility and process.')
    }

    if (context.has_user_accounts) {
      policies.push('Acceptable Use Policy — governs what users can and cannot do with your platform. Basis for account termination.')
    }

    return policies
  }

  _buildComplianceChecklist(context) {
    const checklist = []
    const regions = context.target_regions ?? []
    const hasEU = regions.includes('EU') || regions.includes('UK')

    checklist.push('[ ] Privacy Policy live at /privacy before first external user')
    checklist.push('[ ] Terms of Service live at /terms before first external user')
    checklist.push('[ ] Footer links to Privacy Policy and Terms of Service on every page')

    if (context.has_payments) {
      checklist.push('[ ] Using Stripe or another PCI-compliant payment processor — never handling raw card data')
      checklist.push('[ ] Stripe webhook signatures validated server-side on every webhook')
      checklist.push('[ ] Refund Policy published and linked from checkout flow')
    }

    if (hasEU) {
      checklist.push('[ ] Cookie consent banner implemented with genuine opt-in (not pre-ticked)')
      checklist.push('[ ] Data retention policy defined and enforced in database (soft deletes + scheduled cleanup)')
      checklist.push('[ ] User data export endpoint exists (right to portability)')
      checklist.push('[ ] Account deletion flow permanently removes user PII (right to erasure)')
    }

    if (context.collects_user_data) {
      checklist.push('[ ] Email addresses stored encrypted at rest')
      checklist.push('[ ] Supabase Row-Level Security enabled on all tables storing user data')
      checklist.push('[ ] Password hashing using bcrypt or Argon2 — never MD5 or SHA1')
      checklist.push('[ ] No PII in application logs or error tracking')
    }

    if (context.has_user_accounts) {
      checklist.push('[ ] MFA option available for user accounts')
      checklist.push('[ ] Session invalidation on logout (server-side token revocation)')
      checklist.push('[ ] Account lockout after N failed login attempts')
    }

    checklist.push('[ ] Security contact email (security@yourdomain.com) published')
    checklist.push('[ ] Incident response plan documented (even a simple one) before launch')
    checklist.push('[ ] All third-party vendors (Supabase, Resend, Stripe) have Data Processing Agreements in place')

    return checklist
  }
}

export default LegalAgent
