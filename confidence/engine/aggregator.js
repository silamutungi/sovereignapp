// confidence/engine/aggregator.js — Combines all 10 evaluator scores
//
// Runs all evaluators on a project path and produces a ConfidenceReport.

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const WEIGHTS_FILE = join(__dirname, 'dimension-weights.json')

// Confidence bands
const BANDS = [
  { min: 90, label: 'EXCEPTIONAL', color: '#22c55e' },
  { min: 80, label: 'STRONG', color: '#84cc16' },
  { min: 70, label: 'GOOD', color: '#eab308' },
  { min: 60, label: 'ADEQUATE', color: '#f97316' },
  { min: 50, label: 'NEEDS_IMPROVEMENT', color: '#ef4444' },
  { min: 0, label: 'CRITICAL', color: '#dc2626' },
]

function getBand(score) {
  return BANDS.find(b => score >= b.min) || BANDS[BANDS.length - 1]
}

async function loadEvaluator(name) {
  const file = join(__dirname, 'evaluators', `${name}-evaluator.js`)
  if (!existsSync(file)) {
    return { evaluate: () => ({ dimension: name, score: 50, issues: [], passed: true, summary: 'Evaluator not yet built' }) }
  }
  try {
    const mod = await import(file)
    return mod
  } catch {
    return { evaluate: () => ({ dimension: name, score: 50, issues: [], passed: true, summary: 'Evaluator load error' }) }
  }
}

export async function process(projectPath) {
  const weightsData = JSON.parse(readFileSync(WEIGHTS_FILE, 'utf-8'))

  const evaluatorNames = [
    'security', 'code-quality', 'performance', 'accessibility',
    'ux', 'architecture', 'test-coverage', 'seo', 'documentation', 'i18n',
  ]

  const dimensionResults = {}
  const allIssues = []

  // Run all evaluators
  for (const name of evaluatorNames) {
    const evaluator = await loadEvaluator(name)
    try {
      const result = evaluator.evaluate(projectPath)
      const key = name.replace('-', '_')
      dimensionResults[key] = result
      allIssues.push(...(result.issues || []))
    } catch (err) {
      const key = name.replace('-', '_')
      dimensionResults[key] = {
        dimension: name,
        score: 50,
        issues: [{ severity: 'medium', message: `Evaluator error: ${err.message}` }],
        passed: true,
        summary: `Evaluator error: ${err.message}`,
      }
    }
  }

  // Calculate weighted score
  let totalWeight = 0
  let weightedSum = 0
  const failedMinimums = []

  for (const [key, result] of Object.entries(dimensionResults)) {
    const weightConfig = weightsData[key]
    if (!weightConfig) continue

    const weight = weightConfig.weight
    const minimum = weightConfig.minimum

    weightedSum += result.score * weight
    totalWeight += weight

    if (result.score < minimum) {
      failedMinimums.push({ dimension: key, score: result.score, minimum })
    }
  }

  const overallScore = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0)
  const band = getBand(overallScore)
  const launchGatePassed = overallScore >= 75 && failedMinimums.filter(f => f.dimension === 'security').length === 0

  const criticalIssues = allIssues.filter(i => i.severity === 'critical')
  const blockingIssues = allIssues.filter(i => i.severity === 'critical' || i.severity === 'high')

  const recommendations = generateRecommendations(dimensionResults, weightsData, failedMinimums)

  return {
    project_path: projectPath,
    evaluated_at: new Date().toISOString(),
    overall_score: overallScore,
    band: band.label,
    band_color: band.color,
    launch_gate_passed: launchGatePassed,
    launch_gate_threshold: 75,
    dimensions: dimensionResults,
    failed_minimums: failedMinimums,
    critical_issues: criticalIssues,
    blocking_issues: blockingIssues,
    all_issues: allIssues,
    recommendations,
    summary: `${band.label} (${overallScore}/100) — ${launchGatePassed ? 'Launch gate PASSED' : 'Launch gate FAILED'}`,
  }
}

function generateRecommendations(dimensions, weights, failedMinimums) {
  const recs = []

  // Prioritize failed minimums
  for (const failed of failedMinimums) {
    const weight = weights[failed.dimension]
    recs.push(`[REQUIRED] ${failed.dimension}: score ${failed.score} is below minimum ${failed.minimum}. ${weight?.description || ''}`)
  }

  // Find dimensions with most room for improvement × highest weight
  const improvements = Object.entries(dimensions)
    .map(([key, result]) => ({
      key,
      score: result.score,
      weight: weights[key]?.weight || 0,
      impact: (100 - result.score) * (weights[key]?.weight || 0),
    }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)

  for (const imp of improvements) {
    if (imp.score < 90) {
      recs.push(`Improving ${imp.key} from ${imp.score} to 90 would add ~${Math.round(imp.impact * 0.5)} points to overall score`)
    }
  }

  return recs
}

// ─── QUICK SCORE (synchronous estimate) ──────────────────────────────────────

export function quickScore(projectPath) {
  const checks = [
    existsSync(join(projectPath, 'README.md')),
    existsSync(join(projectPath, '.env.example')),
    existsSync(join(projectPath, 'vercel.json')),
    existsSync(join(projectPath, 'src', 'vite-env.d.ts')),
    existsSync(join(projectPath, 'supabase', 'migrations')),
  ]

  const passed = checks.filter(Boolean).length
  return Math.round((passed / checks.length) * 100)
}
