// agents/vision/seo-agent.js
// Generates SEO metadata: title, meta description, OpenGraph, Twitter Card,
// JSON-LD schema.org markup. Returns SEOSpec.
import { AgentBase } from '../../shared/agent-base-class.js'

export class SEOAgent extends AgentBase {
  constructor() {
    super({ name: 'seo-agent', phase: 'vision', version: '1.0.0' })
  }

  async run(context) {
    const { brief, marketing, strategy } = context
    this.log('info', 'Generating SEO metadata')

    const title = this.buildTitle(brief, marketing)
    const description = this.buildDescription(brief, marketing, strategy)
    const openGraph = this.buildOpenGraph(brief, title, description)
    const twitterCard = this.buildTwitterCard(brief, title, description)
    const jsonLd = this.buildJsonLd(brief, description, strategy)
    const sitemap = this.buildSitemapHints(brief)

    return {
      title,
      description,
      open_graph: openGraph,
      twitter_card: twitterCard,
      json_ld: jsonLd,
      sitemap_hints: sitemap,
      canonical_url_pattern: '/{page-slug}',
      robots: 'index, follow',
    }
  }

  buildTitle(brief, marketing) {
    const appName = brief?.app_name || 'App'
    const heroHeadline = marketing?.hero?.subheadline

    // Title tag format: Primary KW | Brand Name
    // Max 60 chars
    if (heroHeadline) {
      const trimmed = heroHeadline.slice(0, 45)
      return `${trimmed} | ${appName}`
    }
    return `${appName} — ${brief?.problem_statement?.slice(0, 35) || 'Built for ' + brief?.target_user}`
  }

  buildDescription(brief, marketing, strategy) {
    // Meta description: 150-160 chars, includes primary CTA
    const coreJob = brief?.problem_statement?.slice(0, 80) || 'work more efficiently'
    const targetUser = brief?.target_user || 'professionals'
    const cta = strategy?.value_proposition?.primary || 'Get started free'
    const desc = `${brief?.app_name} helps ${targetUser} to ${coreJob}. ${cta}.`
    return desc.slice(0, 160)
  }

  buildOpenGraph(brief, title, description) {
    return {
      'og:type': 'website',
      'og:title': title,
      'og:description': description,
      'og:site_name': brief?.app_name || 'App',
      'og:image': '/og-image.png', // 1200x630 — to be generated
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:locale': 'en_US',
    }
  }

  buildTwitterCard(brief, title, description) {
    return {
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': '/og-image.png',
    }
  }

  buildJsonLd(brief, description, strategy) {
    const appType = this.inferAppType(brief)
    const schema = {
      '@context': 'https://schema.org',
      '@type': appType,
      'name': brief?.app_name || 'App',
      'description': description,
      'url': 'https://example.com', // replaced at deploy time
      'applicationCategory': this.inferCategory(brief),
    }

    if (strategy?.pricing_hint?.model === 'freemium') {
      schema['offers'] = {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD',
        'description': strategy.pricing_hint.free_limit,
      }
    }

    return JSON.stringify(schema, null, 2)
  }

  buildSitemapHints(brief) {
    const pages = [{ path: '/', priority: '1.0', changefreq: 'weekly' }]
    if (brief?.complexity !== 'SIMPLE') {
      pages.push({ path: '/login', priority: '0.5', changefreq: 'monthly' })
      pages.push({ path: '/signup', priority: '0.8', changefreq: 'monthly' })
    }
    pages.push({ path: '/privacy', priority: '0.3', changefreq: 'yearly' })
    pages.push({ path: '/terms', priority: '0.3', changefreq: 'yearly' })
    return pages
  }

  inferAppType(brief) {
    const idea = (brief?.problem_statement || '').toLowerCase()
    if (idea.includes('saas') || idea.includes('subscription')) return 'SoftwareApplication'
    if (idea.includes('store') || idea.includes('shop')) return 'WebApplication'
    return 'WebApplication'
  }

  inferCategory(brief) {
    const idea = (brief?.problem_statement || '').toLowerCase()
    if (idea.includes('task') || idea.includes('project')) return 'ProductivityApplication'
    if (idea.includes('finance') || idea.includes('invoice')) return 'FinanceApplication'
    if (idea.includes('health') || idea.includes('fitness')) return 'HealthApplication'
    if (idea.includes('game')) return 'GameApplication'
    return 'BusinessApplication'
  }
}

export default async function run(context) {
  return new SEOAgent().execute(context)
}
