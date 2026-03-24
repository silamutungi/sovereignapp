// company-os/marketplace/agents/localization-agent.js — Localization strategy agent

import { AgentBase } from '../../../shared/agent-base-class.js'

export class LocalizationAgent extends AgentBase {
  constructor() {
    super({ name: 'localization-agent', phase: 'localization', version: '1.0.0' })
  }

  /**
   * @param {object} context
   * @param {string} [context.industry]
   * @param {string} [context.target_user]
   * @param {number} [context.user_count]
   * @param {string} [context.revenue_model]
   * @param {string[]} [context.current_languages]
   * @param {string[]} [context.user_location_distribution] — e.g. ['US:60%', 'DE:15%', 'FR:10%']
   * @param {boolean} [context.has_i18n]
   * @param {string} [context.stack]
   * @returns {{ top_markets: string[], effort_estimate: object, i18n_checklist: string[] }}
   */
  async run(context) {
    this.log('info', 'Running localization strategy analysis', { current_languages: context.current_languages })

    const top_markets = this._identifyTopMarkets(context)
    const effort_estimate = this._estimateEffort(context)
    const i18n_checklist = this._buildI18nChecklist(context)

    this.log('info', 'Localization strategy complete', { market_count: top_markets.length })

    return {
      top_markets,
      effort_estimate,
      i18n_checklist,
    }
  }

  _identifyTopMarkets(context) {
    const markets = []
    const distribution = context.user_location_distribution ?? []
    const industry = (context.industry ?? '').toLowerCase()
    const isB2B = (context.target_user ?? '').toLowerCase().includes('business') ||
                  (context.target_user ?? '').toLowerCase().includes('founder') ||
                  (context.target_user ?? '').toLowerCase().includes('startup')

    // Parse existing user location signals
    if (distribution.length > 0) {
      distribution.forEach(entry => {
        const [country, pct] = entry.split(':')
        markets.push(`${country} (${pct} of current users) — existing demand signal. Prioritize this market first.`)
      })
    }

    // Global SaaS standard markets
    if (!distribution.some(d => d.startsWith('DE'))) {
      markets.push('Germany (DE) — largest GDP in Europe, strong B2B SaaS adoption, high willingness to pay, prefers German-language interfaces for enterprise sales.')
    }

    if (!distribution.some(d => d.startsWith('FR'))) {
      markets.push('France (FR) — second-largest EU economy, GDPR-first culture, government and enterprise procurement favors French-language products.')
    }

    if (!distribution.some(d => d.startsWith('JP'))) {
      markets.push('Japan (JP) — high-trust market, localization investment pays outsized returns, but requires deep cultural adaptation (not just translation). Partner with a local reseller for B2B.')
    }

    if (!distribution.some(d => d.startsWith('BR'))) {
      markets.push('Brazil (BR) — largest market in Latin America, Portuguese-language, fast-growing SaaS adoption, lower price sensitivity than Europe but high volume opportunity.')
    }

    if (isB2B) {
      markets.push('UK (GB) — English-speaking, EU-adjacent regulation awareness, established SaaS buying culture. Easiest international market for US-built products.')
      markets.push('Australia (AU) — English-speaking, similar buying culture to US/UK, strong fintech and B2B SaaS adoption. Time zone overlap with Asia is a GTM advantage.')
    }

    if (industry.includes('ecommerce') || industry.includes('marketplace')) {
      markets.push('India (IN) — fastest-growing internet economy, enormous SMB market, but price sensitivity requires localized pricing (not just currency conversion).')
    }

    if (industry.includes('developer') || industry.includes('devtools')) {
      markets.push('China (CN) — large developer community, but requires separate infrastructure due to the Great Firewall. Consider a separate Chinese product rather than localization.')
      markets.push('Netherlands (NL) — high English fluency, GDPR-first, developer-dense per capita. Good entry point for Northern European expansion.')
    }

    return markets
  }

  _estimateEffort(context) {
    const hasI18n = context.has_i18n ?? false
    const stack = context.stack ?? ''
    const isReact = stack.includes('react') || stack.includes('vite')
    const currentLangs = (context.current_languages ?? ['en']).length

    const efforts = {}

    // Foundation
    efforts.infrastructure = {
      effort: hasI18n ? 'Already set up' : (isReact ? '3–5 days' : '1–2 weeks'),
      tasks: hasI18n
        ? ['Verify i18n library covers all text in the app', 'Confirm right-to-left (RTL) support if targeting Arabic/Hebrew']
        : [
          isReact ? 'Install react-i18next + i18next' : 'Install appropriate i18n library',
          'Extract all hardcoded strings to translation key files',
          'Set up locale detection (browser language → user preference → default)',
          'Handle pluralization, date formats, number formats, currency',
        ],
    }

    // Per-language translation
    efforts.per_language = {
      effort: '1–3 days (with professional translation)',
      cost_estimate: '$500–$2,000 per language (professional translation of a SaaS app ~5,000–20,000 words)',
      tasks: [
        'Extract all translation keys to JSON file',
        'Send to professional translator (DeepL Pro for fast drafts, then human review)',
        'Review UI for string expansion (German is 30% longer than English — test layouts)',
        'Handle locale-specific: date formats, number formats, currency symbols, phone number formats',
        'Test RTL layout if targeting Arabic, Hebrew, or Persian',
      ],
    }

    // Legal / compliance per market
    efforts.legal_per_market = {
      effort: '2–5 days',
      tasks: [
        'Update privacy policy for local data protection laws',
        'Add local payment methods (iDEAL in Netherlands, SEPA direct debit in EU, PIX in Brazil)',
        'Localized terms of service if selling in regulated industries',
        'VAT / GST handling: Stripe Tax covers this automatically for most EU/AU/CA cases',
      ],
    }

    // Total estimate for first international market
    efforts.first_market_total = {
      effort: hasI18n ? '1–2 weeks' : '3–5 weeks',
      prerequisite: 'i18n infrastructure must be in place before any translation work begins',
      recommendation: `Start with ${currentLangs > 1 ? 'the next highest-volume market from your user data' : 'German or UK English'} — both have clear ROI for B2B SaaS and manageable translation complexity.`,
    }

    return efforts
  }

  _buildI18nChecklist(context) {
    const checklist = []
    const hasI18n = context.has_i18n ?? false
    const isReact = (context.stack ?? '').includes('react') || (context.stack ?? '').includes('vite')

    if (!hasI18n) {
      checklist.push('[ ] Choose i18n library: react-i18next (React), next-i18next (Next.js), vue-i18n (Vue), or i18next standalone')
      checklist.push('[ ] Set up translation key files: public/locales/en/common.json as the base')
      checklist.push('[ ] Replace all hardcoded UI strings with translation keys — zero raw strings in JSX')
      checklist.push('[ ] Implement locale detection: browser language → user preference (stored in DB) → default (en)')
      checklist.push('[ ] Add locale switcher to user settings and/or navbar')
    }

    checklist.push('[ ] Format dates with Intl.DateTimeFormat(locale) — never hardcode date format strings')
    checklist.push('[ ] Format numbers with Intl.NumberFormat(locale) — decimal separators differ by region')
    checklist.push('[ ] Format currency with Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })')
    checklist.push('[ ] Handle plural forms: do not use template strings like "${count} items" — use i18n plural rules')
    checklist.push('[ ] Test all layouts with German text (30% longer than English) and French text (20% longer)')

    if (isReact) {
      checklist.push('[ ] Use <Trans> component for strings with embedded HTML or React components')
      checklist.push('[ ] Lazy-load translation namespaces to avoid shipping all languages to every user')
    }

    checklist.push('[ ] Set lang attribute on <html> element dynamically based on current locale')
    checklist.push('[ ] Add hreflang meta tags to <head> for each locale variant')
    checklist.push('[ ] Handle RTL: add dir="rtl" to <html> for Arabic, Hebrew, Persian locales')
    checklist.push('[ ] Use CSS logical properties (margin-inline-start not margin-left) for RTL-compatible layouts')

    // Email localization
    checklist.push('[ ] Localize transactional emails: store user language preference, send email in their language')
    checklist.push('[ ] Localize error messages: HTTP error responses should use user locale if available')

    // SEO
    checklist.push('[ ] Create locale-specific URL structure: /en/, /de/, /fr/ or use subdomain: de.yourapp.com')
    checklist.push('[ ] Submit localized sitemaps to Google Search Console for each locale')

    // Payment
    checklist.push('[ ] Enable Stripe Tax for automatic VAT/GST calculation in EU, AU, CA')
    checklist.push('[ ] Add local payment methods via Stripe (iDEAL, SEPA, BACS, PIX) for key markets')

    return checklist
  }
}

export default LocalizationAgent
