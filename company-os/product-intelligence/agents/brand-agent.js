// company-os/product-intelligence/agents/brand-agent.js
// Brand consistency analysis agent — checks color, typography, and voice consistency.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { AgentBase } from '../../../shared/agent-base-class.js'

const SOVEREIGN_BRAND = {
  colors: {
    paper: '#f2efe8',
    ink: '#0e0d0b',
    green: '#c8f060',
    text_dim: '#6b6862',
    text_on_dark_dim: 'rgba(255,255,255,0.55)',
  },
  fonts: {
    heading: 'Playfair Display',
    body: 'DM Mono',
  },
}

export class BrandAgent extends AgentBase {
  constructor() {
    super({
      name: 'brand-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the brand agent.
   *
   * @param {object} context
   * @param {string} [context.project_path] — path to the project for file-based analysis
   * @param {string} [context.primary_color] — brand primary color hex
   * @param {string} [context.heading_font] — brand heading font name
   * @param {string} [context.body_font] — brand body font name
   * @param {string[]} [context.voice_adjectives] — intended brand voice (e.g. ['confident', 'clear', 'founder-led'])
   * @returns {{ consistency_score: number, issues: string[], guidelines: string[] }}
   */
  async run(context) {
    const {
      project_path = null,
      primary_color = '',
      heading_font = '',
      body_font = '',
      voice_adjectives = [],
    } = context

    this.log('info', 'Running brand consistency analysis')

    const issues = []
    let score = 100
    const guidelines = []

    if (project_path) {
      const fileAudit = this.auditProjectFiles(project_path)
      issues.push(...fileAudit.issues)
      score = Math.max(0, score - fileAudit.total_penalty)
    }

    // Color consistency checks
    const colorIssues = this.checkColorConsistency(primary_color)
    issues.push(...colorIssues.issues)
    score = Math.max(0, score - colorIssues.penalty)

    // Typography checks
    const fontIssues = this.checkTypography(heading_font, body_font)
    issues.push(...fontIssues.issues)
    score = Math.max(0, score - fontIssues.penalty)

    // Voice guidelines
    guidelines.push(...this.buildVoiceGuidelines(voice_adjectives))

    // Color guidelines
    guidelines.push(...this.buildColorGuidelines(primary_color))

    // Typography guidelines
    guidelines.push(...this.buildTypographyGuidelines(heading_font, body_font))

    return {
      consistency_score: score,
      issues,
      guidelines,
    }
  }

  auditProjectFiles(projectPath) {
    const issues = []
    let total_penalty = 0

    // Check tokens.css for consistent color definitions
    const tokensPath = join(projectPath, 'src', 'styles', 'tokens.css')
    if (!existsSync(tokensPath)) {
      issues.push('Missing src/styles/tokens.css — brand color and font tokens should be centralized in one file')
      total_penalty += 10
    } else {
      const content = readFileSync(tokensPath, 'utf-8')
      if (!content.includes('--color-') && !content.includes('--font-')) {
        issues.push('tokens.css does not define CSS custom properties — add --color-* and --font-* variables')
        total_penalty += 8
      }
    }

    // Check for hardcoded colors in component files (instead of tokens)
    const srcDir = join(projectPath, 'src')
    if (existsSync(srcDir)) {
      const cssFiles = this.getFilesByExt(srcDir, '.css')
      let hardcodedColorCount = 0
      for (const f of cssFiles) {
        const content = readFileSync(f, 'utf-8')
        // Look for hex colors not in tokens.css
        const hexMatches = content.match(/#[0-9a-fA-F]{3,6}/g) || []
        if (f !== tokensPath && hexMatches.length > 5) {
          hardcodedColorCount += hexMatches.length
        }
      }
      if (hardcodedColorCount > 20) {
        issues.push(`${hardcodedColorCount} hardcoded hex colors found outside tokens.css — use CSS custom properties for consistency`)
        total_penalty += 8
      }
    }

    // Check that primary color is not used raw on text (should be darkened for contrast)
    const appCssPath = join(projectPath, 'src', 'App.css')
    if (existsSync(appCssPath)) {
      const content = readFileSync(appCssPath, 'utf-8')
      if (content.includes('color: var(--color-primary)') && !content.includes('filter: brightness')) {
        issues.push('Primary color used directly for text — may fail contrast. Darken by 35% for text on light backgrounds.')
        total_penalty += 5
      }
    }

    return { issues, total_penalty }
  }

  checkColorConsistency(primaryColor) {
    const issues = []
    let penalty = 0

    if (!primaryColor) {
      issues.push('No primary color defined — brand color is required for consistent UI generation')
      penalty += 5
      return { issues, penalty }
    }

    // Validate hex format
    if (!/^#[0-9a-fA-F]{3,6}$/.test(primaryColor)) {
      issues.push(`Primary color "${primaryColor}" is not a valid hex color — use format #RRGGBB`)
      penalty += 5
      return { issues, penalty }
    }

    // Check if color will fail contrast as text on white
    const brightness = this.getBrightness(primaryColor)
    if (brightness > 180 && brightness < 230) {
      issues.push(`Primary color ${primaryColor} (brightness ${brightness}) may fail contrast as text on light backgrounds — use darker shade for typography`)
      penalty += 5
    }

    return { issues, penalty }
  }

  checkTypography(headingFont, bodyFont) {
    const issues = []
    let penalty = 0

    if (!headingFont) {
      issues.push('No heading font defined — typography is a core brand signal')
      penalty += 5
    }
    if (!bodyFont) {
      issues.push('No body font defined — consistent body typography is required')
      penalty += 5
    }
    if (headingFont && bodyFont && headingFont === bodyFont) {
      issues.push('Heading and body fonts are identical — use contrasting typefaces for visual hierarchy (e.g. serif heading + mono/sans body)')
      penalty += 3
    }

    return { issues, penalty }
  }

  buildVoiceGuidelines(voiceAdjectives) {
    const base = [
      'Voice rule: every sentence should sound like it was written by the founder, not a marketing department.',
      'Never use: "leverage", "synergize", "unlock potential", "revolutionize", "game-changing", or "cutting-edge".',
      'Use active voice — "You build apps" not "Apps are built by you".',
      'Address the user directly — "you" not "users" or "customers".',
    ]

    if (voiceAdjectives.includes('confident') || voiceAdjectives.length === 0) {
      base.push('Confident: make statements, not suggestions. "Build without permission." not "You might want to consider building..."')
    }
    if (voiceAdjectives.includes('technical')) {
      base.push('Technical: name the stack, tools, and exact commands — vague abstractions erode developer trust.')
    }
    if (voiceAdjectives.includes('friendly') || voiceAdjectives.includes('warm')) {
      base.push('Friendly: error messages should feel like advice from a colleague, not a system error.')
    }

    return base
  }

  buildColorGuidelines(primaryColor) {
    const brightness = primaryColor ? this.getBrightness(primaryColor) : 128
    const textColor = brightness > 128 ? '#1a1a1a' : '#ffffff'

    return [
      `Primary color ${primaryColor || '[undefined]'} — use for CTAs and accent elements only, not backgrounds.`,
      `Button text on primary color background: use ${textColor} (brightness formula: ${brightness}/255).`,
      'Never use primary color for body text on light backgrounds without darkening by 35%.',
      'Muted text on light backgrounds: minimum 4.5:1 contrast ratio (WCAG AA).',
      'Muted text on dark backgrounds: use #c8c4bc or similar — never reuse light-background muted colors on dark.',
    ]
  }

  buildTypographyGuidelines(headingFont, bodyFont) {
    return [
      `Heading font: ${headingFont || SOVEREIGN_BRAND.fonts.heading} — use for headlines, hero text, and section titles.`,
      `Body font: ${bodyFont || SOVEREIGN_BRAND.fonts.body} — use for all UI copy, labels, and body text.`,
      'Font sizing hierarchy: hero 48–72px, section heading 28–36px, subheading 18–22px, body 14–16px.',
      'Line height: headings 1.1–1.2, body 1.5–1.6 for readability.',
      'Font weight: reserve bold/700+ for headings and key callouts — overuse destroys hierarchy.',
    ]
  }

  getBrightness(hexColor) {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    return Math.round((r * 299 + g * 587 + b * 114) / 1000)
  }

  getFilesByExt(dir, ext) {
    const { readdirSync, statSync } = await import('fs').catch(() => require('fs'))
    const files = []
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const stat = statSync(full)
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          files.push(...this.getFilesByExt(full, ext))
        } else if (entry.endsWith(ext)) {
          files.push(full)
        }
      }
    } catch { /* ignore */ }
    return files
  }

  async verify(output) {
    if (typeof output.consistency_score !== 'number') throw new Error('BrandAgent: consistency_score must be a number')
    if (!Array.isArray(output.issues)) throw new Error('BrandAgent: issues must be an array')
    if (!Array.isArray(output.guidelines)) throw new Error('BrandAgent: guidelines must be an array')
    return output
  }
}

export default BrandAgent
