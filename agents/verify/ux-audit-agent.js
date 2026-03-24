// agents/verify/ux-audit-agent.js
// Checks loading states, error states, empty states, error boundaries, no lorem ipsum.
// Returns: { score: number, missing_states: string[], lorem_ipsum_found: boolean }

import { AgentBase } from '../../shared/agent-base-class.js'

// Pages that require the full UX state trifecta: loading + error + empty
const STATEFUL_PAGES = [
  'src/pages/Dashboard.tsx',
  'src/pages/Home.tsx',
]

const LOREM_PATTERNS = [
  /lorem\s+ipsum/i,
  /dolor\s+sit\s+amet/i,
  /consectetur\s+adipiscing/i,
  /placeholder\s+text/i,
  /\[TODO\]/i,
  /\[PLACEHOLDER\]/i,
]

// State presence checks
const STATE_CHECKS = {
  loading: [/isLoading/, /loading\s*===?\s*true/, /\bLoading\b/, /Spinner/, /Skeleton/],
  error: [/\berror\b/, /errorMessage/, /isError/, /error\s*===?\s*true/],
  empty: [/isEmpty/, /\.length\s*===\s*0/, /no\s+results/i, /empty\s+state/i, /Nothing.*yet/i, /EmptyState/],
}

class UxAuditAgent extends AgentBase {
  constructor() {
    super({ name: 'ux-audit-agent', phase: 'verify', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles } = context

    if (!generatedFiles || typeof generatedFiles !== 'object') {
      throw new Error('ux-audit-agent requires generatedFiles in context')
    }

    this.log('info', 'Running UX audit', {
      files: Object.keys(generatedFiles).length,
    })

    const missing_states = []
    let lorem_ipsum_found = false
    let score = 100

    // Check each TSX file for state completeness
    for (const [filename, content] of Object.entries(generatedFiles)) {
      if (typeof content !== 'string') continue

      // Lorem ipsum check — every file
      if (filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.html')) {
        for (const pattern of LOREM_PATTERNS) {
          if (pattern.test(content)) {
            lorem_ipsum_found = true
            this.logIssue({
              severity: 'critical',
              message: 'Lorem ipsum / placeholder text found in generated file',
              file: filename,
            })
            score -= 15
            break
          }
        }
      }

      if (!filename.endsWith('.tsx')) continue

      // Async operations need loading + error states
      const hasAsyncOp =
        /await\s+\w/.test(content) ||
        /\.from\s*\(/.test(content) ||
        /fetch\s*\(/.test(content)

      if (hasAsyncOp) {
        for (const [stateName, patterns] of Object.entries(STATE_CHECKS)) {
          const hasState = patterns.some(p => p.test(content))
          if (!hasState && stateName !== 'empty') {
            const key = `${filename}:${stateName}`
            missing_states.push(key)
            this.logIssue({
              severity: stateName === 'loading' ? 'high' : 'medium',
              message: `Missing ${stateName} state in component with async operations`,
              file: filename,
            })
            score -= stateName === 'loading' ? 10 : 5
          }
        }

        // Empty state check for list/collection components
        if (content.includes('.map(') || content.includes('forEach(')) {
          const hasEmpty = STATE_CHECKS.empty.some(p => p.test(content))
          if (!hasEmpty) {
            const key = `${filename}:empty`
            missing_states.push(key)
            this.logIssue({
              severity: 'medium',
              message: 'Component renders a list without an empty state',
              file: filename,
            })
            score -= 5
          }
        }
      }
    }

    // Check for ErrorBoundary in main.tsx
    const mainTsx = generatedFiles['src/main.tsx'] || ''
    if (!mainTsx.includes('ErrorBoundary')) {
      missing_states.push('src/main.tsx:error_boundary')
      this.logIssue({
        severity: 'high',
        message: 'src/main.tsx missing React ErrorBoundary wrapper',
        file: 'src/main.tsx',
      })
      score -= 10
    }

    // Check for animation/entrance — Jony Ive bar
    const appTsx = generatedFiles['src/App.tsx'] || ''
    const hasFadeIn =
      /transition|animate|fadeIn|fade-in|translateY|motion/.test(appTsx) ||
      Object.entries(generatedFiles).some(
        ([f, c]) => f.endsWith('.css') && typeof c === 'string' && /transition|animation|keyframe/.test(c)
      )

    if (!hasFadeIn) {
      this.logIssue({
        severity: 'low',
        message: 'No entrance animations detected — Jony Ive bar requires key elements to fade+translateY in',
        file: 'src/App.tsx',
      })
      score -= 3
    }

    score = Math.max(0, score)

    this.log('info', 'UX audit complete', {
      score,
      missing_states: missing_states.length,
      lorem_ipsum_found,
    })

    return { score, missing_states, lorem_ipsum_found }
  }

  async scoreOutput(output) {
    return {
      dimension: 'ux',
      overall_score: output.score,
      missing_states: output.missing_states.length,
      lorem_ipsum_found: output.lorem_ipsum_found,
    }
  }
}

export default async function run(context) {
  return new UxAuditAgent().execute(context)
}
