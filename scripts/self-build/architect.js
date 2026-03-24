#!/usr/bin/env node
// scripts/self-build/architect.js
// Scans the codebase and produces build-plan.json

import { existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..')

const MANIFEST = [
  // Brain
  { id: 'brain-api', file: 'brain/brain-api.js', group: 1, priority: 'critical', depends_on: [] },
  { id: 'brain-cycle1', file: 'brain/cycle1-per-project.js', group: 2, priority: 'high', depends_on: ['brain-api'] },
  { id: 'brain-cycle2', file: 'brain/cycle2-weekly.js', group: 2, priority: 'high', depends_on: ['brain-api'] },
  { id: 'brain-cycle3', file: 'brain/cycle3-monthly.js', group: 2, priority: 'high', depends_on: ['brain-api'] },
  { id: 'sovereign-rules', file: 'brain/SOVEREIGN_RULES.md', group: 1, priority: 'critical', depends_on: [] },
  { id: 'sovereign-patterns', file: 'brain/SOVEREIGN_PATTERNS.md', group: 1, priority: 'critical', depends_on: [] },
  { id: 'sovereign-antipatterns', file: 'brain/SOVEREIGN_ANTIPATTERNS.md', group: 1, priority: 'critical', depends_on: [] },
  { id: 'sovereign-component-library', file: 'brain/SOVEREIGN_COMPONENT_LIBRARY.md', group: 2, priority: 'medium', depends_on: [] },
  { id: 'brain-dashboard', file: 'src/pages/brain-dashboard.tsx', group: 14, priority: 'medium', depends_on: ['brain-api'] },
  // Shared
  { id: 'agent-base-class', file: 'shared/agent-base-class.js', group: 1, priority: 'critical', depends_on: ['brain-api'] },
  { id: 'pipeline-state', file: 'shared/pipeline-state.js', group: 1, priority: 'critical', depends_on: [] },
  { id: 'logger', file: 'shared/logger.js', group: 1, priority: 'high', depends_on: [] },
  // Confidence evaluators
  { id: 'security-evaluator', file: 'confidence/engine/evaluators/security-evaluator.js', group: 3, priority: 'critical', depends_on: [] },
  { id: 'code-quality-evaluator', file: 'confidence/engine/evaluators/code-quality-evaluator.js', group: 3, priority: 'high', depends_on: [] },
  { id: 'performance-evaluator', file: 'confidence/engine/evaluators/performance-evaluator.js', group: 3, priority: 'high', depends_on: [] },
  { id: 'accessibility-evaluator', file: 'confidence/engine/evaluators/accessibility-evaluator.js', group: 3, priority: 'high', depends_on: [] },
  { id: 'ux-evaluator', file: 'confidence/engine/evaluators/ux-evaluator.js', group: 3, priority: 'high', depends_on: [] },
  { id: 'architecture-evaluator', file: 'confidence/engine/evaluators/architecture-evaluator.js', group: 3, priority: 'high', depends_on: [] },
  { id: 'test-coverage-evaluator', file: 'confidence/engine/evaluators/test-coverage-evaluator.js', group: 3, priority: 'medium', depends_on: [] },
  { id: 'seo-evaluator', file: 'confidence/engine/evaluators/seo-evaluator.js', group: 3, priority: 'medium', depends_on: [] },
  { id: 'documentation-evaluator', file: 'confidence/engine/evaluators/documentation-evaluator.js', group: 3, priority: 'medium', depends_on: [] },
  { id: 'i18n-evaluator', file: 'confidence/engine/evaluators/i18n-evaluator.js', group: 3, priority: 'medium', depends_on: [] },
  { id: 'dimension-weights', file: 'confidence/engine/dimension-weights.json', group: 1, priority: 'critical', depends_on: [] },
  { id: 'aggregator', file: 'confidence/engine/aggregator.js', group: 4, priority: 'critical', depends_on: ['dimension-weights'] },
  { id: 'score-history', file: 'confidence/engine/score-history.js', group: 4, priority: 'medium', depends_on: [] },
  { id: 'report-generator', file: 'confidence/reports/report-generator.js', group: 4, priority: 'medium', depends_on: [] },
  { id: 'migration-evaluator', file: 'confidence/migration/migration-evaluator.js', group: 4, priority: 'medium', depends_on: [] },
  { id: 'effort-estimator', file: 'confidence/migration/effort-estimator.js', group: 4, priority: 'medium', depends_on: [] },
  { id: 'confidence-api', file: 'confidence/api/confidence-api.js', group: 4, priority: 'medium', depends_on: ['aggregator'] },
  // Agents
  { id: 'discovery-agent', file: 'agents/intake/discovery-agent.js', group: 5, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'insight-agent', file: 'agents/elevation/insight-agent.js', group: 5, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'creative-director-agent', file: 'agents/elevation/creative-director-agent.js', group: 5, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'ia-agent', file: 'agents/elevation/ia-agent.js', group: 5, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'reviewer-agent', file: 'agents/review/reviewer-agent.js', group: 5, priority: 'critical', depends_on: ['agent-base-class', 'aggregator'] },
  { id: 'shipper-agent', file: 'agents/ship/shipper-agent.js', group: 5, priority: 'critical', depends_on: ['agent-base-class'] },
  // Vision agents
  { id: 'ceo-agent', file: 'agents/vision/ceo-agent.js', group: 6, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'product-agent', file: 'agents/vision/product-agent.js', group: 6, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'design-agent', file: 'agents/vision/design-agent.js', group: 6, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'design-tokens-agent', file: 'agents/vision/design-tokens-agent.js', group: 6, priority: 'high', depends_on: ['agent-base-class'] },
  { id: 'marketing-agent', file: 'agents/vision/marketing-agent.js', group: 6, priority: 'medium', depends_on: ['agent-base-class'] },
  { id: 'seo-agent', file: 'agents/vision/seo-agent.js', group: 6, priority: 'medium', depends_on: ['agent-base-class'] },
  { id: 'onboarding-agent', file: 'agents/vision/onboarding-agent.js', group: 6, priority: 'medium', depends_on: ['agent-base-class'] },
  { id: 'i18n-agent', file: 'agents/vision/i18n-agent.js', group: 6, priority: 'medium', depends_on: ['agent-base-class'] },
  // Company OS
  { id: 'handoff-protocol', file: 'company-os/handoff/handoff-protocol.js', group: 9, priority: 'critical', depends_on: ['brain-api'] },
  { id: 'context-transfer', file: 'company-os/handoff/context-transfer.js', group: 9, priority: 'high', depends_on: [] },
  { id: 'unlock-system', file: 'company-os/functional/unlock-system.js', group: 9, priority: 'high', depends_on: [] },
  { id: 'marketplace-registry', file: 'company-os/marketplace/marketplace-registry.json', group: 9, priority: 'high', depends_on: [] },
  { id: 'activation-system', file: 'company-os/marketplace/activation-system.js', group: 9, priority: 'high', depends_on: [] },
  // Coach
  { id: 'coach-engine', file: 'company-os/coach/coach-engine.js', group: 13, priority: 'critical', depends_on: ['handoff-protocol'] },
  { id: 'coach-personality', file: 'company-os/coach/coach-personality.js', group: 13, priority: 'critical', depends_on: [] },
  { id: 'coach-interventions', file: 'company-os/coach/coach-interventions.js', group: 13, priority: 'high', depends_on: [] },
  { id: 'coach-memory', file: 'company-os/coach/coach-memory.js', group: 13, priority: 'high', depends_on: [] },
  { id: 'coach-outcomes', file: 'company-os/coach/coach-outcomes.js', group: 13, priority: 'medium', depends_on: [] },
  { id: 'coach-weekly-brief', file: 'company-os/coach/coach-weekly-brief.js', group: 13, priority: 'high', depends_on: ['coach-engine'] },
]

function classify(file) {
  const fullPath = join(ROOT, file)
  if (!existsSync(fullPath)) return 'MISSING'
  const size = require('fs').statSync(fullPath).size
  if (size < 100) return 'EXISTS_PARTIAL'
  return 'EXISTS_COMPLETE'
}

async function main() {
  console.log('[Architect] Scanning codebase...')

  // Classify each component
  const classified = MANIFEST.map(comp => ({
    ...comp,
    status: classify(comp.file),
    estimated_hours: 2,
  }))

  const exists_complete = classified.filter(c => c.status === 'EXISTS_COMPLETE').length
  const exists_partial = classified.filter(c => c.status === 'EXISTS_PARTIAL').length
  const missing = classified.filter(c => c.status === 'MISSING').length

  // Group into parallel groups
  const groupMap = {}
  for (const comp of classified) {
    const g = comp.group
    if (!groupMap[g]) groupMap[g] = []
    groupMap[g].push(comp)
  }

  const parallelGroups = Object.entries(groupMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([group, components]) => ({
      group: Number(group),
      can_run_parallel: true,
      components,
    }))

  const criticalPath = classified.filter(c => c.priority === 'critical').map(c => c.id)

  const buildPlan = {
    generated_at: new Date().toISOString(),
    total_components: classified.length,
    exists_complete,
    exists_partial,
    missing,
    needs_refactor: 0,
    estimated_build_time_hours: missing * 2,
    parallel_groups: parallelGroups,
    critical_path: criticalPath,
    confidence_target: 85,
  }

  const outputPath = join(__dirname, 'build-plan.json')
  writeFileSync(outputPath, JSON.stringify(buildPlan, null, 2))

  console.log(`[Architect] Build plan complete:`)
  console.log(`  - ${exists_complete} components exist (complete)`)
  console.log(`  - ${exists_partial} components exist (partial)`)
  console.log(`  - ${missing} components to build`)
  console.log(`  - ${parallelGroups.length} parallel build groups`)
  console.log(`  - ${criticalPath.length} components on critical path`)
  console.log(`  - Target confidence: 85/100`)
  console.log(`  - Saved to ${outputPath}`)
}

main().catch(err => {
  console.error('[Architect] Fatal:', err.message)
  process.exit(1)
})
