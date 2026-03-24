// company-os/coach/coach-memory.js
// The Coach remembers user preferences and past interactions.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const MEMORY_DIR = join(__dirname, '..', 'memory')

function getMemoryFile(buildId) {
  return join(MEMORY_DIR, `${buildId}.json`)
}

const DEFAULT_MEMORY = {
  dismissed_recommendations: [],
  preferred_agent_outputs: [],
  focus_area: 'growth',
  brief_frequency: 'weekly',
  last_interaction: null,
  interaction_count: 0,
  preferences: {},
}

export function loadMemory(buildId) {
  const file = getMemoryFile(buildId)
  if (!existsSync(file)) return { ...DEFAULT_MEMORY, build_id: buildId }
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return { ...DEFAULT_MEMORY, build_id: buildId }
  }
}

export function saveMemory(buildId, memory) {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true })
  const updated = {
    ...memory,
    build_id: buildId,
    updated_at: new Date().toISOString(),
  }
  writeFileSync(getMemoryFile(buildId), JSON.stringify(updated, null, 2))
  return updated
}

export function dismiss(buildId, recommendationId) {
  const memory = loadMemory(buildId)
  if (!memory.dismissed_recommendations.includes(recommendationId)) {
    memory.dismissed_recommendations.push(recommendationId)
  }
  memory.last_interaction = new Date().toISOString()
  memory.interaction_count = (memory.interaction_count || 0) + 1
  return saveMemory(buildId, memory)
}

export function setFocusArea(buildId, area) {
  const valid = ['growth', 'product', 'technical', 'business']
  if (!valid.includes(area)) throw new Error(`Invalid focus area: ${area}. Must be one of: ${valid.join(', ')}`)
  const memory = loadMemory(buildId)
  memory.focus_area = area
  memory.last_interaction = new Date().toISOString()
  return saveMemory(buildId, memory)
}

export function rememberPreference(buildId, key, value) {
  const memory = loadMemory(buildId)
  if (!memory.preferences) memory.preferences = {}
  memory.preferences[key] = value
  memory.last_interaction = new Date().toISOString()
  return saveMemory(buildId, memory)
}

export function recordInteraction(buildId, type, data = {}) {
  const memory = loadMemory(buildId)
  memory.last_interaction = new Date().toISOString()
  memory.interaction_count = (memory.interaction_count || 0) + 1
  if (!memory.interaction_history) memory.interaction_history = []
  memory.interaction_history.push({ type, data, at: memory.last_interaction })
  // Keep last 50 interactions
  if (memory.interaction_history.length > 50) {
    memory.interaction_history = memory.interaction_history.slice(-50)
  }
  return saveMemory(buildId, memory)
}
