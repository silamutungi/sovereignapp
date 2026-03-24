// agents/review/reviewer-agent.js
// 3-round adversarial review.
// Round 1: security + errors.
// Round 2: quality + tests.
// Round 3: polish.
// Integrates with aggregator from confidence/engine/aggregator.js.
// Returns: { rounds: Round[], final_score: number, approved: boolean }

import { AgentBase } from '../../shared/agent-base-class.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '../..')

const APPROVAL_THRESHOLD = 75

class ReviewerAgent extends AgentBase {
  constructor() {
    super({ name: 'reviewer-agent', phase: 'review', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles, verifyResults, spec, projectPath } = context

    this.log('info', 'Starting 3-round adversarial review', {
      app_name: spec?.name,
    })

    const rounds = []

    // ── Round 1: Security + Error Handling ─────────────────────────────
    this.log('info', 'Round 1: security + error handling')
    const round1 = await this._runRound1(generatedFiles, verifyResults)
    rounds.push(round1)
    this.log('info', `Round 1 complete — score: ${round1.score}`, {
      issues: round1.issues.length,
    })

    // ── Round 2: Quality + Tests ────────────────────────────────────────
    this.log('info', 'Round 2: quality + tests')
    const round2 = await this._runRound2(generatedFiles, verifyResults, round1)
    rounds.push(round2)
    this.log('info', `Round 2 complete — score: ${round2.score}`, {
      issues: round2.issues.length,
    })

    // ── Round 3: Polish ─────────────────────────────────────────────────
    this.log('info', 'Round 3: polish')
    const round3 = await this._runRound3(generatedFiles, verifyResults, round1, round2)
    rounds.push(round3)
    this.log('info', `Round 3 complete — score: ${round3.score}`, {
      issues: round3.issues.length,
    })

    // ── Aggregate via confidence engine ─────────────────────────────────
    let final_score = this._computeFinalScore(rounds)

    // Attempt to use the full confidence aggregator if a project path is available
    if (projectPath) {
      try {
        const aggregatorMod = await import(`${ROOT}/confidence/engine/aggregator.js`)
        if (aggregatorMod.aggregate) {
          const report = await aggregatorMod.aggregate(projectPath)
          if (report?.overall_score != null) {
            // Blend: 60% aggregator (objective), 40% round scores (adversarial)
            final_score = Math.round(report.overall_score * 0.6 + final_score * 0.4)
            this.log('info', 'Confidence aggregator blended into final score', {
              aggregator_score: report.overall_score,
              round_score: final_score,
              blended: final_score,
            })
          }
        }
      } catch (err) {
        this.log('debug', 'Confidence aggregator not available — using round scores only', {
          error: err.message,
        })
      }
    }

    const approved = final_score >= APPROVAL_THRESHOLD

    this.log('info', `Adversarial review complete`, {
      final_score,
      approved,
      threshold: APPROVAL_THRESHOLD,
    })

    return { rounds, final_score, approved }
  }

  async _runRound1(generatedFiles, verifyResults) {
    const issues = []
    let deductions = 0

    // Pull issues from security and rate-limiting verify results
    const securityResult = verifyResults?.security
    if (securityResult) {
      for (const issue of securityResult.issues || []) {
        issues.push({ ...issue, round: 1, source: 'security-agent' })
        deductions += issue.severity === 'critical' ? 20 : issue.severity === 'high' ? 10 : 5
      }
    }

    const rlResult = verifyResults?.rate_limiting
    if (rlResult?.missing?.length > 0) {
      for (const route of rlResult.missing) {
        issues.push({
          severity: 'critical',
          message: `Rate limiting missing on ${route}`,
          file: route,
          round: 1,
          source: 'rate-limiting-agent',
        })
        deductions += 20
      }
    }

    // Adversarial check: scan for error swallowing
    for (const [filename, content] of Object.entries(generatedFiles || {})) {
      if (typeof content !== 'string') continue
      // Empty catch blocks
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
        issues.push({
          severity: 'high',
          message: 'Empty catch block — errors silently swallowed',
          file: filename,
          round: 1,
          source: 'reviewer',
        })
        deductions += 10
      }
      // console.log with potential secrets
      if (/console\.log\s*\([^)]*(?:token|key|secret|password)/i.test(content)) {
        issues.push({
          severity: 'critical',
          message: 'Possible secret value in console.log',
          file: filename,
          round: 1,
          source: 'reviewer',
        })
        deductions += 20
      }
    }

    const score = Math.max(0, 100 - deductions)
    return { round: 1, name: 'security_errors', score, issues }
  }

  async _runRound2(generatedFiles, verifyResults, round1) {
    const issues = []
    let deductions = 0

    // Pull from UX and accessibility results
    const uxResult = verifyResults?.ux
    if (uxResult) {
      if (uxResult.lorem_ipsum_found) {
        issues.push({
          severity: 'critical',
          message: 'Lorem ipsum found — zero tolerance policy',
          file: 'unknown',
          round: 2,
          source: 'ux-audit-agent',
        })
        deductions += 25
      }
      for (const state of uxResult.missing_states || []) {
        issues.push({
          severity: 'medium',
          message: `Missing UI state: ${state}`,
          file: state.split(':')[0],
          round: 2,
          source: 'ux-audit-agent',
        })
        deductions += 5
      }
    }

    const a11yResult = verifyResults?.accessibility
    if (a11yResult && !a11yResult.wcag_aa) {
      issues.push({
        severity: 'high',
        message: `WCAG AA not met — score: ${a11yResult.score}/100`,
        file: 'multiple',
        round: 2,
        source: 'accessibility-agent',
      })
      deductions += 15
    }

    const testResult = verifyResults?.unit_tests
    if (testResult && testResult.coverage_estimate < 40) {
      issues.push({
        severity: 'medium',
        message: `Test coverage estimate too low: ${testResult.coverage_estimate}%`,
        file: 'tests',
        round: 2,
        source: 'unit-test-agent',
      })
      deductions += 10
    }

    // Carry forward critical issues from round 1
    const round1Critical = round1.issues.filter(i => i.severity === 'critical')
    deductions += round1Critical.length * 5 // Penalise again for unresolved criticals

    const score = Math.max(0, 100 - deductions)
    return { round: 2, name: 'quality_tests', score, issues }
  }

  async _runRound3(generatedFiles, verifyResults, round1, round2) {
    const issues = []
    let deductions = 0

    // Polish checks — Jony Ive bar
    const hasAnimations = Object.entries(generatedFiles || {}).some(
      ([f, c]) =>
        typeof c === 'string' &&
        (f.endsWith('.tsx') || f.endsWith('.css')) &&
        /transition|animation|fadeIn|translate/.test(c)
    )
    if (!hasAnimations) {
      issues.push({
        severity: 'low',
        message: 'No entrance animations — Jony Ive bar: key elements should fade+translateY in',
        file: 'multiple',
        round: 3,
        source: 'reviewer',
      })
      deductions += 3
    }

    // Check mobile viewport in index.html
    const indexHtml = generatedFiles?.['index.html'] || ''
    if (!indexHtml.includes('viewport')) {
      issues.push({
        severity: 'high',
        message: 'index.html missing viewport meta tag — app will not render correctly on mobile',
        file: 'index.html',
        round: 3,
        source: 'reviewer',
      })
      deductions += 10
    }

    // Check performance result
    const perfResult = verifyResults?.performance
    if (perfResult?.heavy_dependencies?.length > 2) {
      issues.push({
        severity: 'medium',
        message: `${perfResult.heavy_dependencies.length} heavy dependencies — consider alternatives`,
        file: 'package.json',
        round: 3,
        source: 'performance-agent',
      })
      deductions += 5
    }

    // Check README exists
    if (!generatedFiles?.['README.md']) {
      issues.push({
        severity: 'medium',
        message: 'README.md missing — every shipped app needs one',
        file: 'README.md',
        round: 3,
        source: 'reviewer',
      })
      deductions += 5
    }

    const score = Math.max(0, 100 - deductions)
    return { round: 3, name: 'polish', score, issues }
  }

  _computeFinalScore(rounds) {
    // Weighted average: Round 1 (security) = 40%, Round 2 (quality) = 40%, Round 3 (polish) = 20%
    const weights = [0.4, 0.4, 0.2]
    const weighted = rounds.reduce((sum, round, i) => sum + round.score * (weights[i] || 0.2), 0)
    return Math.round(weighted)
  }

  async scoreOutput(output) {
    return {
      dimension: 'review',
      overall_score: output.final_score,
      approved: output.approved,
      rounds: output.rounds.length,
    }
  }
}

export default async function run(context) {
  return new ReviewerAgent().execute(context)
}
