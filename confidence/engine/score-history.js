// confidence/engine/score-history.js — Score trend tracking

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const HISTORY_DIR = join(__dirname, '..', 'history')

function getHistoryFile(projectPath) {
  const safe = projectPath.replace(/[^a-z0-9]/gi, '_').slice(-40)
  return join(HISTORY_DIR, `${safe}.json`)
}

export function saveScore(projectPath, report) {
  if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true })
  const file = getHistoryFile(projectPath)
  const history = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : []
  history.push({
    timestamp: report.evaluated_at || new Date().toISOString(),
    overall_score: report.overall_score,
    band: report.band,
    launch_gate_passed: report.launch_gate_passed,
    dimension_scores: Object.fromEntries(
      Object.entries(report.dimensions || {}).map(([k, v]) => [k, v.score])
    ),
  })
  writeFileSync(file, JSON.stringify(history, null, 2))
  return history
}

export function getHistory(projectPath) {
  const file = getHistoryFile(projectPath)
  if (!existsSync(file)) return []
  return JSON.parse(readFileSync(file, 'utf-8'))
}

export function getTrend(projectPath, days = 30) {
  const history = getHistory(projectPath)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const recent = history.filter(h => h.timestamp >= cutoff)
  if (recent.length < 2) return { direction: 'insufficient_data', delta: 0, entries: recent.length }
  const first = recent[0].overall_score
  const last = recent[recent.length - 1].overall_score
  const delta = last - first
  return {
    direction: delta > 3 ? 'improving' : delta < -3 ? 'declining' : 'stable',
    delta,
    first,
    last,
    entries: recent.length,
    sparkline: recent.map(h => h.overall_score),
  }
}

export function getComparison(projectPath1, projectPath2) {
  const h1 = getHistory(projectPath1)
  const h2 = getHistory(projectPath2)
  const latest1 = h1[h1.length - 1]
  const latest2 = h2[h2.length - 1]
  if (!latest1 || !latest2) return null
  return {
    project1: { path: projectPath1, score: latest1.overall_score, band: latest1.band },
    project2: { path: projectPath2, score: latest2.overall_score, band: latest2.band },
    winner: latest1.overall_score >= latest2.overall_score ? projectPath1 : projectPath2,
    delta: Math.abs(latest1.overall_score - latest2.overall_score),
  }
}
