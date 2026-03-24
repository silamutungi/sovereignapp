// agents/build/content-agent.js
// Takes MarketingCopy. Replaces all placeholder text with real content.
// Rule: zero lorem ipsum.
// Returns: { content_map: { [key]: string } }

import { AgentBase } from '../../shared/agent-base-class.js'

// All lorem ipsum variants we will reject and replace
const LOREM_PATTERNS = [
  /lorem\s+ipsum/gi,
  /dolor\s+sit\s+amet/gi,
  /consectetur\s+adipiscing/gi,
  /sed\s+do\s+eiusmod/gi,
  /ut\s+labore\s+et\s+dolore/gi,
  /placeholder\s+text/gi,
  /sample\s+text/gi,
  /insert\s+text\s+here/gi,
  /\[PLACEHOLDER\]/gi,
  /\[TODO\]/gi,
  /\[INSERT.*?\]/gi,
  /Coming\s+soon\.\.\./gi,
  /Under\s+construction/gi,
]

// Generic fallbacks for common content keys if spec doesn't provide them
const CONTENT_FALLBACKS = {
  hero_headline: 'Build something people love.',
  hero_subheadline: 'Your idea, shipped in minutes.',
  cta_primary: 'Get started',
  cta_secondary: 'Learn more',
  nav_login: 'Log in',
  nav_signup: 'Sign up',
  footer_tagline: 'Built with Sovereign.',
  empty_state_title: 'Nothing here yet.',
  empty_state_body: 'Get started by creating your first item.',
  error_generic: 'Something went wrong. Please try again.',
  loading: 'Loading…',
  success_generic: 'Done!',
}

class ContentAgent extends AgentBase {
  constructor() {
    super({ name: 'content-agent', phase: 'build', version: '1.0.0' })
  }

  async run(context) {
    const { marketingCopy, spec, generatedFiles } = context

    this.log('info', 'Running content replacement pass', {
      app_name: spec?.name,
      has_marketing_copy: !!marketingCopy,
    })

    // Build the content map from spec + marketingCopy + fallbacks
    const content_map = this._buildContentMap(spec, marketingCopy)

    // Scan all generated files for lorem ipsum violations
    const files = generatedFiles || {}
    const patchedFiles = {}
    let totalReplacements = 0

    for (const [filename, content] of Object.entries(files)) {
      if (typeof content !== 'string') {
        patchedFiles[filename] = content
        continue
      }

      const { patched, replacements } = this._removeLorem(content, filename, spec)
      patchedFiles[filename] = patched
      totalReplacements += replacements
    }

    this.log('info', 'Content pass complete', {
      content_keys: Object.keys(content_map).length,
      lorem_replacements: totalReplacements,
    })

    return { content_map, patched_files: patchedFiles }
  }

  _buildContentMap(spec, marketingCopy) {
    const map = { ...CONTENT_FALLBACKS }

    if (spec) {
      if (spec.name) {
        map.app_name = spec.name
        map.hero_headline = `${spec.name} — built for you.`
        map.nav_brand = spec.name
        map.page_title = spec.name
      }
      if (spec.description) {
        map.hero_subheadline = spec.description
        map.meta_description = spec.description
      }
      if (spec.target_user) {
        map.hero_tagline = `The best tool for ${spec.target_user}.`
      }
      if (spec.primaryColor) {
        map.primary_color = spec.primaryColor
      }
      if (spec.tone) {
        map.content_tone = spec.tone
      }
    }

    if (marketingCopy) {
      Object.assign(map, marketingCopy)
    }

    return map
  }

  _removeLorem(content, filename, spec) {
    let patched = content
    let replacements = 0

    for (const pattern of LOREM_PATTERNS) {
      if (pattern.test(patched)) {
        this.logIssue({
          severity: 'high',
          message: `Lorem ipsum / placeholder text found — replacing with real copy`,
          file: filename,
        })
        const appName = spec?.name || 'this app'
        const replacement = this._placeholderReplacement(pattern, appName, spec)
        patched = patched.replace(pattern, replacement)
        replacements++
      }
      pattern.lastIndex = 0
    }

    return { patched, replacements }
  }

  _placeholderReplacement(pattern, appName, spec) {
    const source = pattern.source.toLowerCase()

    if (source.includes('lorem') || source.includes('dolor') || source.includes('consectetur')) {
      return spec?.description || `${appName} helps you get things done faster and smarter.`
    }
    if (source.includes('placeholder') || source.includes('sample') || source.includes('insert')) {
      return spec?.description || `Built for ${spec?.target_user || 'people who want results'}.`
    }
    if (source.includes('coming soon') || source.includes('under construction')) {
      return `${appName} is launching soon.`
    }
    if (source.includes('todo')) {
      return spec?.name || appName
    }

    return appName
  }

  async verify(output) {
    // Final scan of patched files to confirm zero lorem ipsum
    const files = output.patched_files || {}
    let loremFound = false

    for (const [filename, content] of Object.entries(files)) {
      if (typeof content !== 'string') continue
      for (const pattern of LOREM_PATTERNS) {
        if (pattern.test(content)) {
          loremFound = true
          this.logIssue({
            severity: 'critical',
            message: 'Lorem ipsum still present after content pass — manual review required',
            file: filename,
          })
        }
        pattern.lastIndex = 0
      }
    }

    if (loremFound) {
      this.log('error', 'Lorem ipsum violations remain after content pass')
    }

    return output
  }
}

export default async function run(context) {
  return new ContentAgent().execute(context)
}
