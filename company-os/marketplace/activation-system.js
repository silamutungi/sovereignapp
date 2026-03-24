// company-os/marketplace/activation-system.js
// Handles marketplace agent activation and management.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REGISTRY_FILE = join(__dirname, 'marketplace-registry.json')
const ACTIVATIONS_DIR = join(__dirname, '..', 'activations')

function loadRegistry() {
  return JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'))
}

function getActivationFile(buildId) {
  return join(ACTIVATIONS_DIR, `${buildId}.json`)
}

function loadActivations(buildId) {
  const file = getActivationFile(buildId)
  if (!existsSync(file)) return {}
  try { return JSON.parse(readFileSync(file, 'utf-8')) }
  catch { return {} }
}

function saveActivations(buildId, activations) {
  const { mkdirSync } = require('fs')
  if (!existsSync(ACTIVATIONS_DIR)) mkdirSync(ACTIVATIONS_DIR, { recursive: true })
  writeFileSync(getActivationFile(buildId), JSON.stringify(activations, null, 2))
}

export function activateAgent(agentId, buildId, config = {}) {
  const registry = loadRegistry()
  const agent = registry.agents.find(a => a.id === agentId)
  if (!agent) throw new Error(`Agent not found: ${agentId}`)

  const activations = loadActivations(buildId)
  activations[agentId] = {
    agent_id: agentId,
    build_id: buildId,
    activated_at: new Date().toISOString(),
    config,
    status: 'active',
    last_run: null,
    run_count: 0,
  }
  saveActivations(buildId, activations)

  console.log(`[Marketplace] Activated ${agent.name} for build ${buildId}`)
  return activations[agentId]
}

export function deactivateAgent(agentId, buildId) {
  const activations = loadActivations(buildId)
  if (activations[agentId]) {
    activations[agentId].status = 'inactive'
    activations[agentId].deactivated_at = new Date().toISOString()
    saveActivations(buildId, activations)
  }
}

export function getActiveAgents(buildId) {
  const activations = loadActivations(buildId)
  const registry = loadRegistry()
  return Object.values(activations)
    .filter(a => a.status === 'active')
    .map(a => ({
      ...a,
      agent_info: registry.agents.find(r => r.id === a.agent_id),
    }))
}

export async function runAgent(agentId, buildId, context) {
  const activations = loadActivations(buildId)
  const activation = activations[agentId]
  if (!activation || activation.status !== 'active') {
    throw new Error(`Agent ${agentId} is not active for build ${buildId}`)
  }

  // Dynamically load and run the agent
  const agentFile = join(__dirname, 'agents', `${agentId}.js`)
  if (!existsSync(agentFile)) {
    return { agent_id: agentId, output: `Agent ${agentId} not yet built`, placeholder: true }
  }

  try {
    const mod = await import(agentFile)
    const result = await mod.default({ ...context, build_id: buildId, activation })

    // Update activation stats
    activation.last_run = new Date().toISOString()
    activation.run_count = (activation.run_count || 0) + 1
    saveActivations(buildId, { ...activations, [agentId]: activation })

    return result
  } catch (err) {
    console.error(`[Marketplace] ${agentId} failed:`, err.message)
    throw err
  }
}

export function getAgentStatus(agentId, buildId) {
  const activations = loadActivations(buildId)
  const registry = loadRegistry()
  const activation = activations[agentId]
  const agentInfo = registry.agents.find(a => a.id === agentId)

  return {
    agent_id: agentId,
    build_id: buildId,
    status: activation?.status || 'not_activated',
    activation: activation || null,
    agent_info: agentInfo || null,
  }
}
