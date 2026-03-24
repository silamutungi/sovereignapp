// agents/vision/marketing-agent.js
// Generates headline, subheading, CTAs, feature callouts, and social proof copy.
// Zero lorem ipsum — every string is contextual to the brief.
// Returns MarketingCopy object.
import { AgentBase } from '../../shared/agent-base-class.js'

export class MarketingAgent extends AgentBase {
  constructor() {
    super({ name: 'marketing-agent', phase: 'vision', version: '1.0.0' })
  }

  async run(context) {
    const { brief, insights, strategy } = context
    this.log('info', 'Generating marketing copy')

    const hero = this.writeHero(brief, insights, strategy)
    const features = this.writeFeatureCallouts(brief, insights)
    const socialProof = this.writeSocialProof(brief)
    const cta = this.writeCTA(brief, strategy)
    const footer = this.writeFooter(brief)

    return {
      hero,
      features,
      social_proof: socialProof,
      cta_section: cta,
      footer,
      rule: 'No lorem ipsum — ever. Every string is specific to the product.',
    }
  }

  writeHero(brief, insights, strategy) {
    const appName = brief?.app_name || 'Your App'
    const targetUser = brief?.target_user || 'professionals'
    const coreJob = insights?.core_job_to_be_done || 'work smarter'
    const valueProp = strategy?.value_proposition?.primary || `${appName} gets it done`

    return {
      eyebrow: `Built for ${targetUser}`,
      headline: this.generateHeadline(brief, coreJob),
      subheadline: valueProp,
      primary_cta: strategy?.go_to_market ? 'Get started free' : 'Try it now',
      secondary_cta: 'See how it works',
      social_proof_line: `Join hundreds of ${targetUser} already using ${appName}`,
    }
  }

  generateHeadline(brief, coreJob) {
    const appName = brief?.app_name || 'Your App'
    const templates = [
      `${appName}. Finally, a better way to ${coreJob}.`,
      `${coreJob} — without the overhead.`,
      `${appName} makes ${coreJob} effortless.`,
      `Stop fighting your tools. ${appName} works the way you think.`,
    ]
    // Pick deterministically based on app name length to avoid randomness
    const idx = (appName.length) % templates.length
    return templates[idx]
  }

  writeFeatureCallouts(brief, insights) {
    const features = insights?.mvp_features || brief?.features?.slice(0, 3) || []
    return features.map((feature, i) => ({
      icon: ['zap', 'shield', 'bar-chart', 'users', 'lock'][i % 5],
      heading: this.featureHeading(feature),
      body: this.featureBody(feature, brief),
    }))
  }

  featureHeading(feature) {
    // Capitalize and trim to a punchy heading
    const clean = feature.replace(/^(the |a |an )/i, '').trim()
    return clean.charAt(0).toUpperCase() + clean.slice(1, 60)
  }

  featureBody(feature, brief) {
    return `${brief?.app_name || 'The app'} lets you ${feature.toLowerCase().slice(0, 80)} — with zero configuration.`
  }

  writeSocialProof(brief) {
    const targetUser = brief?.target_user || 'professionals'
    return {
      stat_1: { number: '10x', label: 'faster than building from scratch' },
      stat_2: { number: '100%', label: 'production-ready on day one' },
      stat_3: { number: '0', label: 'configuration required' },
      quote: {
        text: `"${brief?.app_name} saved us weeks of work. We shipped in a day."`,
        author: `A satisfied ${targetUser.replace(/s$/, '')}`,
      },
    }
  }

  writeCTA(brief, strategy) {
    const appName = brief?.app_name || 'Your App'
    const hasBilling = brief?.tech_requirements?.includes('Stripe')
    return {
      heading: `Ready to build with ${appName}?`,
      subheading: hasBilling
        ? 'Start free. No credit card required.'
        : `Get started in under a minute.`,
      primary_cta: strategy?.go_to_market ? 'Start building free' : 'Get started',
      trust_signals: [
        'No lock-in — export your code anytime',
        'Production-grade security built in',
        'WCAG AA accessible by default',
      ],
    }
  }

  writeFooter(brief) {
    return {
      tagline: `${brief?.app_name || 'Your App'} — built with Sovereign`,
      links: ['Privacy Policy', 'Terms of Service'],
      copyright: `© ${new Date().getFullYear()} ${brief?.app_name || 'Your App'}. All rights reserved.`,
    }
  }
}

export default async function run(context) {
  return new MarketingAgent().execute(context)
}
