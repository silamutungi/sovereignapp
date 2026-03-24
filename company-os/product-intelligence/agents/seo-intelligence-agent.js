// company-os/product-intelligence/agents/seo-intelligence-agent.js
// SEO audit and keyword opportunity agent.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { AgentBase } from '../../../shared/agent-base-class.js'

export class SeoIntelligenceAgent extends AgentBase {
  constructor() {
    super({
      name: 'seo-intelligence-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the SEO intelligence agent.
   *
   * @param {object} context
   * @param {string} [context.project_path] — path to project directory for file-based audit
   * @param {string} [context.app_name] — name of the app for keyword suggestions
   * @param {string} [context.app_description] — description for keyword analysis
   * @param {string} [context.app_type] — 'saas' | 'marketplace' | 'consumer' | 'ecommerce'
   * @param {string[]} [context.target_keywords] — keywords already being targeted
   * @returns {{ score: number, missing: string[], keywords: string[], recommendations: string[] }}
   */
  async run(context) {
    const {
      project_path = null,
      app_name = '',
      app_description = '',
      app_type = 'saas',
      target_keywords = [],
    } = context

    this.log('info', `Running SEO audit for ${app_name || 'unnamed app'}`)

    const missing = []
    let score = 100
    const penalties = []

    if (project_path) {
      // File-based audit
      const fileAudit = this.auditFiles(project_path)
      missing.push(...fileAudit.missing)
      penalties.push(...fileAudit.penalties)
    } else {
      // Context-based audit (no file access)
      missing.push('Cannot audit files — provide project_path for file-based SEO audit')
    }

    // Keyword analysis based on app type and description
    const keywords = this.generateKeywordOpportunities(app_type, app_name, app_description, target_keywords)

    // Calculate score
    const totalPenalty = penalties.reduce((sum, p) => sum + p.value, 0)
    score = Math.max(0, score - totalPenalty)

    const recommendations = this.buildRecommendations(missing, app_type, keywords)

    return {
      score,
      missing,
      keywords,
      recommendations,
      penalties,
    }
  }

  auditFiles(projectPath) {
    const missing = []
    const penalties = []

    // Check index.html for meta tags
    const indexPath = join(projectPath, 'index.html')
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8')

      if (!content.includes('<title>') || content.includes('<title>Vite + React</title>')) {
        missing.push('Meaningful <title> tag in index.html (not "Vite + React")')
        penalties.push({ item: 'title', value: 15 })
      }
      if (!content.includes('name="description"')) {
        missing.push('<meta name="description" content="..."> in index.html')
        penalties.push({ item: 'meta_description', value: 15 })
      }
      if (!content.includes('og:title')) {
        missing.push('Open Graph meta tags (og:title, og:description, og:image)')
        penalties.push({ item: 'og_tags', value: 10 })
      }
      if (!content.includes('og:image')) {
        missing.push('og:image meta tag — required for rich previews when shared on social media')
        penalties.push({ item: 'og_image', value: 8 })
      }
      if (!content.includes('twitter:card')) {
        missing.push('Twitter card meta tags (twitter:card, twitter:title, twitter:description)')
        penalties.push({ item: 'twitter_card', value: 5 })
      }
      if (!content.includes('canonical') && !content.includes('rel="canonical"')) {
        missing.push('<link rel="canonical" href="..."> to prevent duplicate content issues')
        penalties.push({ item: 'canonical', value: 5 })
      }
    } else {
      missing.push('index.html not found at project root')
      penalties.push({ item: 'no_index', value: 40 })
    }

    // Check for sitemap
    const sitemapPaths = [
      join(projectPath, 'public', 'sitemap.xml'),
      join(projectPath, 'sitemap.xml'),
    ]
    if (!sitemapPaths.some(p => existsSync(p))) {
      missing.push('sitemap.xml in /public — helps search engines discover all pages')
      penalties.push({ item: 'sitemap', value: 10 })
    }

    // Check for robots.txt
    const robotsPaths = [
      join(projectPath, 'public', 'robots.txt'),
      join(projectPath, 'robots.txt'),
    ]
    if (!robotsPaths.some(p => existsSync(p))) {
      missing.push('robots.txt in /public — controls search engine crawling')
      penalties.push({ item: 'robots', value: 5 })
    }

    // Check for semantic HTML in App.tsx / Home.tsx
    const pagePaths = [
      join(projectPath, 'src', 'App.tsx'),
      join(projectPath, 'src', 'pages', 'Home.tsx'),
      join(projectPath, 'src', 'pages', 'Landing.tsx'),
    ]
    let hasSemanticHTML = false
    for (const p of pagePaths) {
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf-8')
        if (content.includes('<main') || content.includes('<article') || content.includes('<section')) {
          hasSemanticHTML = true
          break
        }
      }
    }
    if (!hasSemanticHTML) {
      missing.push('Semantic HTML elements (<main>, <article>, <section>, <nav>) in page components')
      penalties.push({ item: 'semantic_html', value: 8 })
    }

    return { missing, penalties }
  }

  generateKeywordOpportunities(app_type, app_name, app_description, existing_keywords) {
    const typeKeywords = {
      saas: [
        `${app_name} alternative`,
        `${app_name} pricing`,
        `best [category] software`,
        `[category] tool for [target user]`,
        `how to [core job to be done]`,
        `[category] vs [competitor]`,
      ],
      marketplace: [
        `buy [product] online`,
        `[product] near me`,
        `[product] marketplace`,
        `hire [service provider]`,
        `[service provider] rates`,
        `best [service] in [city]`,
      ],
      consumer: [
        `${app_name} app`,
        `${app_name} review`,
        `[use case] app for [platform]`,
        `how to [use case]`,
        `best app for [use case]`,
      ],
      ecommerce: [
        `buy [product]`,
        `[product] reviews`,
        `best [product] 2026`,
        `[product] for [use case]`,
        `[product] deals`,
      ],
      'developer-tools': [
        `${app_name} npm`,
        `${app_name} tutorial`,
        `${app_name} vs [competitor]`,
        `how to use ${app_name}`,
        `${app_name} examples`,
        `[language] [category] library`,
      ],
    }

    const keywords = typeKeywords[app_type] || typeKeywords.saas

    // Filter out keywords already being targeted
    return keywords.filter(k => !existing_keywords.some(ek =>
      ek.toLowerCase().includes(k.toLowerCase().replace(/\[.*?\]/g, '').trim())
    ))
  }

  buildRecommendations(missing, app_type, keywords) {
    const recs = []

    if (missing.length > 0) {
      recs.push(`Fix ${missing.length} missing SEO element(s) — start with title tag and meta description for maximum impact.`)
    }
    if (keywords.length > 0) {
      recs.push(`Target "${keywords[0]}" as your primary keyword cluster — create dedicated landing page content.`)
    }
    if (app_type === 'saas') {
      recs.push('Create comparison pages ("[App] vs [Competitor]") — these rank quickly and capture high-intent buyers.')
    }
    if (app_type === 'marketplace') {
      recs.push('Every listing page is a long-tail SEO page — ensure listing titles and descriptions are unique and descriptive.')
    }

    recs.push('Add JSON-LD structured data (WebApplication, Organization) to index.html for rich search result snippets.')
    recs.push('Verify Core Web Vitals in Google Search Console — slow LCP directly impacts search ranking.')

    return recs
  }

  async verify(output) {
    if (typeof output.score !== 'number') throw new Error('SeoIntelligenceAgent: score must be a number')
    if (!Array.isArray(output.missing)) throw new Error('SeoIntelligenceAgent: missing must be an array')
    if (!Array.isArray(output.keywords)) throw new Error('SeoIntelligenceAgent: keywords must be an array')
    return output
  }
}

export default SeoIntelligenceAgent
