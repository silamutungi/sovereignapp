// company-os/coach/coach-outcomes.js
// Tracks whether Coach recommendations lead to actual improvements.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUTCOMES_FILE = join(__dirname, '..', 'outcomes.json')

function loadOutcomes() {
  if (!existsSync(OUTCOMES_FILE)) return []
  try { return JSON.parse(readFileSync(OUTCOMES_FILE, 'utf-8')) }
  catch { return [] }
}

function saveOutcomes(outcomes) {
  const dir = dirname(OUTCOMES_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(OUTCOMES_FILE, JSON.stringify(outcomes, null, 2))
}

export function recordOutcome(recommendationId, outcome) {
  const outcomes = loadOutcomes()
  const existing = outcomes.find(o => o.recommendation_id === recommendationId)
  if (existing) {
    existing.followed = outcome.followed
    existing.helped = outcome.helped
    existing.notes = outcome.notes
    existing.updated_at = new Date().toISOString()
  } else {
    outcomes.push({
      recommendation_id: recommendationId,
      followed: outcome.followed,
      helped: outcome.helped,
      notes: outcome.notes || '',
      recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  saveOutcomes(outcomes)
}

export function getEffectiveness() {
  const outcomes = loadOutcomes()
  if (outcomes.length === 0) return { rate: null, total: 0 }
  const followed = outcomes.filter(o => o.followed)
  const helped = outcomes.filter(o => o.helped)
  return {
    total: outcomes.length,
    followed_rate: Math.round((followed.length / outcomes.length) * 100),
    helpfulness_rate: followed.length > 0 ? Math.round((helped.length / followed.length) * 100) : null,
  }
}

export function getTopRecommendations() {
  const outcomes = loadOutcomes()
  return outcomes
    .filter(o => o.followed && o.helped)
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    .slice(0, 10)
}

export function getUnderusedInsights() {
  const outcomes = loadOutcomes()
  return outcomes
    .filter(o => !o.followed)
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    .slice(0, 5)
}

export function improveModel(outcomeData) {
  // Future: use outcome data to adjust recommendation weighting
  // For now: log the signal for manual review
  console.log('[Coach Outcomes] Model improvement signal received:', outcomeData)
  recordOutcome(outcomeData.recommendation_id, outcomeData)
}
