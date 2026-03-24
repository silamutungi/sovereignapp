// shared/pipeline-state.js — Atomic pipeline state management
//
// Manages the build pipeline state file with atomic writes.
// All agents read and update state through this module.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const STATE_FILE = join(ROOT, 'scripts', 'self-build', 'pipeline-state.json')

function atomicWrite(file, data) {
  const tmp = file + '.tmp'
  const dir = dirname(file)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  writeFileSync(file, readFileSync(tmp))
}

export function loadState(pipelinePath = STATE_FILE) {
  if (!existsSync(pipelinePath)) {
    return {
      build_id: randomUUID(),
      started_at: new Date().toISOString(),
      sovereign_version: '2.0.0',
      target_confidence: 85,
      current_confidence: null,
      phase: 'init',
      groups_completed: 0,
      groups_total: 15,
      components_built: 0,
      components_total: 120,
      agents_active: [],
      agents_completed: [],
      agents_failed: [],
      issues_found: [],
      issues_resolved: [],
      db_locks: [],
      completed: false,
    }
  }
  try {
    return JSON.parse(readFileSync(pipelinePath, 'utf-8'))
  } catch {
    return loadState() // return default on parse error
  }
}

export function saveState(state, pipelinePath = STATE_FILE) {
  atomicWrite(pipelinePath, state)
  return state
}

export function updateAgent(agentName, status, data = {}, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  const now = new Date().toISOString()

  if (status === 'running') {
    if (!state.agents_active.find(a => a.name === agentName)) {
      state.agents_active.push({ name: agentName, started_at: now, ...data })
    }
    if (state.phase !== data.phase) state.phase = data.phase || state.phase
  }

  if (status === 'complete') {
    state.agents_active = state.agents_active.filter(a => a.name !== agentName)
    state.agents_completed.push({ name: agentName, completed_at: now, ...data })
    state.components_built = state.agents_completed.length
  }

  if (status === 'failed') {
    state.agents_active = state.agents_active.filter(a => a.name !== agentName)
    state.agents_failed.push({ name: agentName, failed_at: now, ...data })
  }

  state.updated_at = now
  return saveState(state, pipelinePath)
}

export function recordIssue(issue, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  state.issues_found.push({
    id: randomUUID(),
    ...issue,
    found_at: new Date().toISOString(),
    resolved: false,
  })
  return saveState(state, pipelinePath)
}

export function resolveIssue(issueId, resolution, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  const issue = state.issues_found.find(i => i.id === issueId)
  if (issue) {
    issue.resolved = true
    issue.resolution = resolution
    issue.resolved_at = new Date().toISOString()
    state.issues_resolved.push(issue)
  }
  return saveState(state, pipelinePath)
}

export function addLesson(lesson, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  if (!state.lessons) state.lessons = []
  state.lessons.push({ ...lesson, added_at: new Date().toISOString() })
  return saveState(state, pipelinePath)
}

export function getProgress(pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  const completed = state.components_built || 0
  const total = state.components_total || 1
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
    groups_completed: state.groups_completed || 0,
    groups_total: state.groups_total || 15,
  }
}

export function getActiveAgents(pipelinePath = STATE_FILE) {
  return loadState(pipelinePath).agents_active || []
}

export function markGroupComplete(groupNumber, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  state.groups_completed = Math.max(state.groups_completed || 0, groupNumber)
  return saveState(state, pipelinePath)
}

export function updateConfidence(score, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  state.current_confidence = score
  return saveState(state, pipelinePath)
}

export function addDbLock(lock, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  state.db_locks.push({ id: randomUUID(), ...lock, acquired_at: new Date().toISOString() })
  return saveState(state, pipelinePath)
}

export function releaseDbLock(lockId, pipelinePath = STATE_FILE) {
  const state = loadState(pipelinePath)
  state.db_locks = state.db_locks.filter(l => l.id !== lockId)
  return saveState(state, pipelinePath)
}
