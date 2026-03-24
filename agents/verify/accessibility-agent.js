// agents/verify/accessibility-agent.js
// Checks WCAG AA compliance: alt text, aria labels, contrast tokens, heading hierarchy.
// Returns: { score: number, issues: Issue[], wcag_aa: boolean }

import { AgentBase } from '../../shared/agent-base-class.js'

// WCAG AA brightness formula: (R*299 + G*587 + B*114) / 1000
function brightness(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

// Known failing color pairs from CLAUDE.md hard-won lessons
const FAILING_COMBINATIONS = [
  { bg: '#6b6862', context: '#0e0d0b', reason: '#6b6862 only works on #f2efe8 — fails on dark bg' },
  { bg: '#6b6760', context: '#0e0d0b', reason: '#6b6760 only works on #f2efe8 — fails on dark bg' },
]

class AccessibilityAgent extends AgentBase {
  constructor() {
    super({ name: 'accessibility-agent', phase: 'verify', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles } = context

    if (!generatedFiles || typeof generatedFiles !== 'object') {
      throw new Error('accessibility-agent requires generatedFiles in context')
    }

    this.log('info', 'Running WCAG AA accessibility checks', {
      files: Object.keys(generatedFiles).length,
    })

    const issues = []
    let score = 100

    for (const [filename, content] of Object.entries(generatedFiles)) {
      if (typeof content !== 'string') continue
      if (!filename.endsWith('.tsx') && !filename.endsWith('.html')) continue

      const fileIssues = [
        ...this._checkAltText(content, filename),
        ...this._checkAriaLabels(content, filename),
        ...this._checkHeadingHierarchy(content, filename),
        ...this._checkButtonLabels(content, filename),
        ...this._checkColorContrast(content, filename),
        ...this._checkFocusVisible(content, filename),
        ...this._checkLangAttribute(content, filename),
      ]

      for (const issue of fileIssues) {
        issues.push(issue)
        this.logIssue(issue)
      }
    }

    // Score deductions
    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const highCount = issues.filter(i => i.severity === 'high').length
    const mediumCount = issues.filter(i => i.severity === 'medium').length
    score = Math.max(0, 100 - criticalCount * 20 - highCount * 10 - mediumCount * 5)

    const wcag_aa = criticalCount === 0 && score >= 70

    this.log('info', 'Accessibility check complete', { score, wcag_aa, issues: issues.length })

    return { score, issues, wcag_aa }
  }

  _checkAltText(content, filename) {
    const issues = []
    // Images must have alt attribute
    const imgWithoutAlt = /<img(?![^>]*\balt\s*=)[^>]*>/gi
    let match
    while ((match = imgWithoutAlt.exec(content)) !== null) {
      issues.push({
        severity: 'critical',
        message: '<img> element missing alt attribute — screen readers cannot describe it',
        file: filename,
      })
    }
    return issues
  }

  _checkAriaLabels(content, filename) {
    const issues = []
    // Icon-only buttons need aria-label
    const iconOnlyButton = /<button[^>]*>(?:\s*<(?:svg|img|Icon)[^>]*\/?>)+\s*<\/button>/gi
    if (iconOnlyButton.test(content)) {
      if (!content.includes('aria-label') && !content.includes('aria-labelledby')) {
        issues.push({
          severity: 'high',
          message: 'Icon-only button detected without aria-label — inaccessible to screen readers',
          file: filename,
        })
      }
    }
    return issues
  }

  _checkHeadingHierarchy(content, filename) {
    const issues = []
    // Detect heading jumps (h1 → h3 skipping h2)
    const headings = []
    const headingPattern = /<h([1-6])[^>]*>/g
    let match
    while ((match = headingPattern.exec(content)) !== null) {
      headings.push(parseInt(match[1]))
    }

    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) {
        issues.push({
          severity: 'medium',
          message: `Heading hierarchy skips level: h${headings[i - 1]} → h${headings[i]}`,
          file: filename,
        })
        break // Report once per file
      }
    }
    return issues
  }

  _checkButtonLabels(content, filename) {
    const issues = []
    // Empty button text
    const emptyButton = /<button[^>]*>\s*<\/button>/gi
    if (emptyButton.test(content)) {
      issues.push({
        severity: 'critical',
        message: 'Empty <button> with no text or aria-label',
        file: filename,
      })
    }
    return issues
  }

  _checkColorContrast(content, filename) {
    const issues = []

    // Check for known failing combinations from CLAUDE.md lessons
    for (const combo of FAILING_COMBINATIONS) {
      if (content.includes(combo.bg)) {
        // Check if there's any dark background nearby in the same file
        if (content.includes(combo.context) || content.includes('ink') || content.includes('#0e0d0b')) {
          issues.push({
            severity: 'high',
            message: `Potential contrast failure: ${combo.reason}`,
            file: filename,
          })
        }
      }
    }

    // Check for white text on light backgrounds
    if (/color:\s*['"]?#fff(?:fff)?['"]?/.test(content) && /background(?:-color)?:\s*['"]?#f/.test(content)) {
      issues.push({
        severity: 'high',
        message: 'Possible white text on light background — verify contrast ratio',
        file: filename,
      })
    }

    return issues
  }

  _checkFocusVisible(content, filename) {
    const issues = []
    // Detect outline: none or outline: 0 without focus-visible replacement
    if (/outline:\s*none|outline:\s*0/.test(content)) {
      if (!content.includes(':focus-visible') && !content.includes('focus-visible:')) {
        issues.push({
          severity: 'high',
          message: 'outline: none used without :focus-visible replacement — keyboard users lose focus indicator',
          file: filename,
        })
      }
    }
    return issues
  }

  _checkLangAttribute(content, filename) {
    const issues = []
    if (filename.endsWith('.html') || filename === 'index.html') {
      if (!/<html[^>]+lang=/i.test(content)) {
        issues.push({
          severity: 'high',
          message: 'HTML document missing lang attribute — required for screen readers',
          file: filename,
        })
      }
    }
    return issues
  }

  async scoreOutput(output) {
    return {
      dimension: 'accessibility',
      overall_score: output.score,
      wcag_aa: output.wcag_aa,
      issues: output.issues.length,
    }
  }
}

export default async function run(context) {
  return new AccessibilityAgent().execute(context)
}
