// company-os/handoff/context-transfer.js
// Manages company context between sessions.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CONTEXT_DIR = join(__dirname, '..', 'context')

export function loadContext(buildId) {
  const file = join(CONTEXT_DIR, `${buildId}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

export function saveContext(buildId, context) {
  const file = join(CONTEXT_DIR, `${buildId}.json`)
  const updated = { ...context, updated_at: new Date().toISOString() }
  writeFileSync(file, JSON.stringify(updated, null, 2))
  return updated
}

export function mergeContext(existing, updates) {
  return {
    ...existing,
    ...updates,
    metrics: { ...(existing.metrics || {}), ...(updates.metrics || {}) },
    intelligence_agents_active: [
      ...new Set([...(existing.intelligence_agents_active || []), ...(updates.intelligence_agents_active || [])]),
    ],
    updated_at: new Date().toISOString(),
  }
}

export function getActiveBuilds() {
  if (!existsSync(CONTEXT_DIR)) return []
  return readdirSync(CONTEXT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const ctx = JSON.parse(readFileSync(join(CONTEXT_DIR, f), 'utf-8'))
        return ctx.company_os_activated ? ctx : null
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export function updateMetrics(buildId, metrics) {
  const ctx = loadContext(buildId)
  if (!ctx) return null
  return saveContext(buildId, mergeContext(ctx, { metrics: { ...ctx.metrics, ...metrics } }))
}

export function transferOwnership(buildId, newOwnerEmail) {
  const ctx = loadContext(buildId)
  if (!ctx) return null
  return saveContext(buildId, {
    ...ctx,
    owner_email: newOwnerEmail,
    transferred_at: new Date().toISOString(),
    transfer_status: 'complete',
  })
}
