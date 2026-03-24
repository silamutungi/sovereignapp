#!/usr/bin/env node
// scripts/self-build/orchestrator.js
// Sovereign Self-Build Orchestrator — reads build plan, manages parallel groups

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadState, getProgress } from '../../shared/pipeline-state.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..')
const BUILD_PLAN = join(__dirname, 'build-plan.json')
const STATE_FILE = join(__dirname, 'pipeline-state.json')

function readPlan() {
  if (!existsSync(BUILD_PLAN)) {
    console.error('build-plan.json not found. Run architect.js first.')
    process.exit(1)
  }
  return JSON.parse(readFileSync(BUILD_PLAN, 'utf-8'))
}

function renderProgressBar(completed, total, width = 20) {
  const pct = total === 0 ? 0 : completed / total
  const filled = Math.round(pct * width)
  const empty = width - filled
  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`
}

function renderDashboard(state, plan) {
  const progress = { completed: state.components_built || 0, total: state.components_total || 120 }
  const pct = Math.round((progress.completed / Math.max(progress.total, 1)) * 100)
  const bar = renderProgressBar(progress.completed, progress.total)
  const ts = new Date().toLocaleTimeString()

  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    `║  SOVEREIGN SELF-BUILD — ${ts.padEnd(37)}║`,
    '║  "Building ourselves to the standard we set for others"      ║',
    '╠══════════════════════════════════════════════════════════════╣',
    `║  Phase: ${(state.phase || 'unknown').padEnd(53)}║`,
    `║  Progress: ${progress.completed}/${progress.total} components  [${bar}] ${String(pct).padStart(3)}%  ║`,
    `║  Confidence: ${String(state.current_confidence || '?').padEnd(4)}/100  Target: 85/100${' '.repeat(25)}║`,
    '╠══════════════════════════════════════════════════════════════╣',
    '║  ACTIVE AGENTS' + ' '.repeat(48) + '║',
  ]

  const active = state.agents_active || []
  if (active.length === 0) {
    lines.push('║  (none)' + ' '.repeat(55) + '║')
  } else {
    for (const agent of active.slice(0, 3)) {
      const elapsed = agent.started_at ? Math.round((Date.now() - new Date(agent.started_at)) / 1000) + 's' : '?s'
      lines.push(`║  ⟳ ${agent.name.slice(0, 40).padEnd(40)}  ${elapsed.padStart(5)}      ║`)
    }
  }

  lines.push('╠══════════════════════════════════════════════════════════════╣')
  lines.push(`║  Parallel group ${state.groups_completed || 0} of ${state.groups_total || 15} complete${' '.repeat(36)}║`)

  const completed = (state.agents_completed || []).slice(-3)
  for (const agent of completed) {
    lines.push(`║  ✓ ${agent.name.slice(0, 57).padEnd(57)}║`)
  }

  const issues = state.issues_found || []
  const resolved = state.issues_resolved || []
  const open = issues.length - resolved.length

  lines.push('╠══════════════════════════════════════════════════════════════╣')
  lines.push(`║  ISSUES FOUND: ${String(issues.length).padEnd(4)}  RESOLVED: ${String(resolved.length).padEnd(4)}  OPEN: ${String(open).padEnd(10)}║`)
  lines.push('╚══════════════════════════════════════════════════════════════╝')

  return lines.join('\n')
}

async function main() {
  const args = process.argv.slice(2)
  const isWatch = args.includes('--watch')
  const isStatus = args.includes('--status')

  if (isStatus || isWatch) {
    const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf-8')) : loadState(STATE_FILE)
    const plan = existsSync(BUILD_PLAN) ? readPlan() : null

    console.clear()
    console.log(renderDashboard(state, plan))

    if (state.completed) {
      console.log('\n✅ Self-build complete!')
      console.log(`   Final confidence score: ${state.current_confidence || '?'}/100`)
      console.log(`   Components built: ${state.components_built}/${state.components_total}`)
      console.log(`   Issues: ${state.issues_found?.length || 0} found, ${state.issues_resolved?.length || 0} resolved`)
    }

    if (isWatch && !state.completed) {
      setInterval(() => {
        const fresh = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf-8')) : state
        console.clear()
        console.log(renderDashboard(fresh, plan))
      }, 30000)
    }
    return
  }

  // Full orchestration mode
  console.log('[Orchestrator] Starting Sovereign self-build...')
  const plan = readPlan()
  console.log(`[Orchestrator] Build plan: ${plan.total_components} components, ${plan.parallel_groups?.length || 0} groups`)
  console.log(`[Orchestrator] Target confidence: ${plan.confidence_target || 85}/100`)
  console.log('\n[Orchestrator] Run with --status to check progress\n')
  console.log(renderDashboard(loadState(STATE_FILE), plan))
}

main().catch(err => {
  console.error('[Orchestrator] Fatal:', err.message)
  process.exit(1)
})
