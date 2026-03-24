// agents/ship/shipper-agent.js
// Checks launch gate (score >= 75). Triggers handoff. Records final metrics to Brain.
// Returns: { approved: boolean, score: number, reason: string, handoff_triggered: boolean }

import { AgentBase } from '../../shared/agent-base-class.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as BrainAPI from '../../brain/brain-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const LAUNCH_GATE_SCORE = 75

// Hard gates: if any of these are true, ship is blocked regardless of score
function hardGateFailures(verifyResults, reviewResult) {
  const failures = []

  // Security must pass
  if (verifyResults?.security?.passed === false) {
    failures.push('Security evaluation failed — critical security issues present')
  }

  // No lorem ipsum
  if (verifyResults?.ux?.lorem_ipsum_found === true) {
    failures.push('Lorem ipsum found in generated files — zero tolerance')
  }

  // Rate limiting must cover all routes
  const rl = verifyResults?.rate_limiting
  if (rl && rl.routes_checked > 0 && rl.missing?.length > 0) {
    failures.push(`Rate limiting missing on ${rl.missing.length} route(s): ${rl.missing.join(', ')}`)
  }

  // Reviewer must have approved (if reviewer ran)
  if (reviewResult && !reviewResult.approved) {
    failures.push(`Adversarial reviewer did not approve (score: ${reviewResult.final_score}/100, threshold: ${LAUNCH_GATE_SCORE})`)
  }

  return failures
}

class ShipperAgent extends AgentBase {
  constructor() {
    super({ name: 'shipper-agent', phase: 'ship', version: '1.0.0' })
  }

  async run(context) {
    const {
      spec,
      buildId,
      verifyResults,
      reviewResult,
      generatedFiles,
      onHandoff,
    } = context

    this.log('info', 'Running launch gate check', {
      app_name: spec?.name,
      build_id: buildId,
    })

    // Compute composite score from all verify results
    const score = this._computeScore(verifyResults, reviewResult)

    // Check hard gates first
    const hardFailures = hardGateFailures(verifyResults, reviewResult)

    const scoreGatePassed = score >= LAUNCH_GATE_SCORE
    const hardGatePassed = hardFailures.length === 0
    const approved = scoreGatePassed && hardGatePassed

    let reason
    if (!hardGatePassed) {
      reason = `Hard gate failure: ${hardFailures[0]}`
    } else if (!scoreGatePassed) {
      reason = `Score ${score}/100 below launch threshold of ${LAUNCH_GATE_SCORE}`
    } else {
      reason = `All checks passed — score ${score}/100 meets launch threshold of ${LAUNCH_GATE_SCORE}`
    }

    this.log(approved ? 'info' : 'warn', `Launch gate: ${approved ? 'APPROVED' : 'BLOCKED'}`, {
      score,
      reason,
      hard_failures: hardFailures.length,
    })

    // Record final metrics to Brain
    await this._recordMetrics({
      buildId,
      spec,
      score,
      approved,
      reason,
      verifyResults,
      reviewResult,
      fileCount: Object.keys(generatedFiles || {}).length,
    })

    // Trigger handoff if approved
    let handoff_triggered = false
    if (approved) {
      handoff_triggered = await this._triggerHandoff(context, score)
    } else {
      this.log('warn', 'Handoff blocked — launch gate not passed', {
        hard_failures: hardFailures,
        score,
      })
    }

    return { approved, score, reason, handoff_triggered }
  }

  _computeScore(verifyResults, reviewResult) {
    const scores = []

    if (verifyResults?.security?.score != null) scores.push({ weight: 0.25, value: verifyResults.security.score })
    if (verifyResults?.accessibility?.score != null) scores.push({ weight: 0.15, value: verifyResults.accessibility.score })
    if (verifyResults?.ux?.score != null) scores.push({ weight: 0.15, value: verifyResults.ux.score })
    if (verifyResults?.performance?.score != null) scores.push({ weight: 0.10, value: verifyResults.performance.score })
    if (verifyResults?.privacy?.score != null) scores.push({ weight: 0.10, value: verifyResults.privacy.score })
    if (reviewResult?.final_score != null) scores.push({ weight: 0.25, value: reviewResult.final_score })

    if (scores.length === 0) return 50 // No data = uncertain

    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
    const weighted = scores.reduce((sum, s) => sum + s.value * s.weight, 0)
    return Math.round(weighted / totalWeight)
  }

  async _recordMetrics({ buildId, spec, score, approved, reason, verifyResults, reviewResult, fileCount }) {
    try {
      const metrics = {
        build_id: buildId,
        app_name: spec?.name,
        tier: spec?.tier,
        score,
        approved,
        reason,
        file_count: fileCount,
        security_score: verifyResults?.security?.score,
        accessibility_score: verifyResults?.accessibility?.score,
        ux_score: verifyResults?.ux?.score,
        performance_score: verifyResults?.performance?.score,
        privacy_score: verifyResults?.privacy?.score,
        reviewer_score: reviewResult?.final_score,
        timestamp: new Date().toISOString(),
      }

      await BrainAPI.recordPattern({
        category: 'build_metrics',
        source: 'shipper-agent',
        data: metrics,
        tags: ['ship', 'metrics', approved ? 'approved' : 'blocked'],
      })

      this.log('info', 'Final metrics recorded to Brain', { score, approved })
    } catch (err) {
      // Metrics recording must never block the ship decision
      this.log('warn', 'Failed to record metrics to Brain — non-fatal', { error: err.message })
    }
  }

  async _triggerHandoff(context, score) {
    const { onHandoff, buildId, spec } = context

    try {
      if (typeof onHandoff === 'function') {
        await onHandoff({
          buildId,
          spec,
          score,
          approved: true,
          timestamp: new Date().toISOString(),
        })
        this.log('info', 'Handoff callback triggered successfully', { buildId })
        return true
      }

      // Default handoff: record a lesson that this build shipped
      await BrainAPI.recordLesson({
        category: 'deployment',
        source: 'shipper-agent',
        problem: `Build ${buildId || 'unknown'} shipped for ${spec?.name || 'unknown app'}`,
        solution: `Score: ${score}/100. Passed all gates.`,
        applied_automatically: true,
        tags: ['ship', 'success', spec?.tier?.toLowerCase() || 'standard'],
      })

      this.log('info', 'Default handoff complete — lesson recorded to Brain')
      return true
    } catch (err) {
      this.log('error', 'Handoff failed', { error: err.message })
      return false
    }
  }

  async scoreOutput(output) {
    return {
      dimension: 'ship',
      overall_score: output.score,
      approved: output.approved,
      handoff_triggered: output.handoff_triggered,
    }
  }
}

export default async function run(context) {
  return new ShipperAgent().execute(context)
}
