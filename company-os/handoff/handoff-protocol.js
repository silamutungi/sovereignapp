// company-os/handoff/handoff-protocol.js
// Activates Company OS when a build ships.
// Run by shipper-agent.js after every successful deployment.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as BrainAPI from '../../brain/brain-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..')
const CONTEXT_DIR = join(__dirname, '..', 'context')

export async function activate(pipelineOrPath) {
  let pipeline
  if (typeof pipelineOrPath === 'string') {
    pipeline = JSON.parse(readFileSync(pipelineOrPath, 'utf-8'))
  } else {
    pipeline = pipelineOrPath
  }

  const buildId = pipeline.build_id || `build-${Date.now()}`
  console.log(`[Handoff] Activating Company OS for build: ${buildId}`)

  // Build company context
  const context = {
    build_id: buildId,
    app_name: pipeline.app_name || 'Unknown App',
    app_type: inferAppType(pipeline),
    features: pipeline.features || [],
    tech_stack: pipeline.tech_stack || ['React', 'TypeScript', 'Supabase', 'Vercel'],
    deployed_at: new Date().toISOString(),
    deploy_url: pipeline.deploy_url || null,
    github_repo: pipeline.github_repo || null,
    confidence_score: pipeline.confidence_score || null,
    company_os_activated: true,
    coach_activated: true,
    intelligence_agents_active: getInitialAgents(pipeline),
    unlock_status: {
      cto: true, // always unlocked
      cfo: hasPayments(pipeline),
      cmo: hasMarketing(pipeline),
      legal: hasUserData(pipeline),
      people: false,
      cx: hasSupport(pipeline),
    },
    metrics: { users: 0, revenue: 0, deploys: 1 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Save context file
  if (!existsSync(CONTEXT_DIR)) mkdirSync(CONTEXT_DIR, { recursive: true })
  const contextFile = join(CONTEXT_DIR, `${buildId}.json`)
  writeFileSync(contextFile, JSON.stringify(context, null, 2))

  // Record to Brain
  BrainAPI.recordBuildMetrics(buildId, {
    confidence_score: pipeline.confidence_score,
    app_name: context.app_name,
    app_type: context.app_type,
    handoff_activated: true,
  })

  // Schedule first Coach brief
  await scheduleFirstBrief(buildId, context)

  console.log(`[Handoff] Company OS active — ${context.intelligence_agents_active.length} agents activated`)
  console.log(`[Handoff] Context saved to ${contextFile}`)

  return context
}

function inferAppType(pipeline) {
  const features = (pipeline.features || []).join(' ').toLowerCase()
  const idea = (pipeline.app_name || '').toLowerCase()

  if (features.includes('marketplace') || features.includes('sell')) return 'marketplace'
  if (features.includes('saas') || features.includes('subscription')) return 'saas'
  if (features.includes('payment') || features.includes('stripe')) return 'ecommerce'
  if (features.includes('social') || features.includes('community')) return 'social'
  return 'consumer'
}

function getInitialAgents(pipeline) {
  // Always active
  const agents = ['growth-agent', 'seo-intelligence-agent', 'retention-agent']
  if (hasMarketing(pipeline)) agents.push('marketing-agent', 'brand-agent')
  if (pipeline.confidence_score < 80) agents.push('analytics-agent')
  return agents
}

function hasPayments(pipeline) {
  const features = (pipeline.features || []).join(' ').toLowerCase()
  return features.includes('payment') || features.includes('stripe') || features.includes('subscription')
}

function hasMarketing(pipeline) {
  const features = (pipeline.features || []).join(' ').toLowerCase()
  return features.includes('marketing') || features.includes('landing') || features.includes('seo')
}

function hasUserData(pipeline) {
  const features = (pipeline.features || []).join(' ').toLowerCase()
  return features.includes('user') || features.includes('auth') || features.includes('account')
}

function hasSupport(pipeline) {
  const features = (pipeline.features || []).join(' ').toLowerCase()
  return features.includes('support') || features.includes('help') || features.includes('contact')
}

async function scheduleFirstBrief(buildId, context) {
  // Record the schedule intent — actual cron is registered separately
  BrainAPI.recordLesson({
    category: 'agent',
    source: 'build',
    problem: `Company OS activated for ${context.app_name} — first brief scheduled`,
    solution: 'Run company-os/coach/coach-weekly-brief.js weekly for this build',
    applied_automatically: true,
    tags: ['handoff', 'company-os', buildId],
  })
}
