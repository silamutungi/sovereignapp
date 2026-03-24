// company-os/coach/coach-engine.js
// The Coach aggregates recommendations from all agents and delivers them with conviction.

import * as CoachPersonality from './coach-personality.js'
import * as CoachMemory from './coach-memory.js'
import * as CoachInterventions from './coach-interventions.js'
import { randomUUID } from 'crypto'

export async function generateRecommendation(context) {
  const { build_id, app_name, metrics = {}, confidence_score } = context

  const memory = CoachMemory.loadMemory(build_id)
  const focusArea = memory?.focus_area || 'growth'

  const raw = buildRawRecommendation(context, focusArea)
  const formatted = CoachPersonality.formatRecommendation(raw)

  return {
    id: randomUUID(),
    source_agent: 'coach-engine',
    priority: determinePriority(context),
    category: focusArea,
    title: formatted.title,
    body: formatted.body,
    action: formatted.action,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    shown: false,
    dismissed: false,
    context_snapshot: { metrics, confidence_score },
  }
}

export async function getPrioritizedRecommendations(context) {
  const recommendations = []
  const memory = CoachMemory.loadMemory(context.build_id)
  const dismissed = memory?.dismissed_recommendations || []

  // Check for interventions
  const interventions = CoachInterventions.checkInterventions(context)
  for (const intervention of interventions) {
    const rec = await interventionToRecommendation(intervention, context)
    if (!dismissed.includes(rec.id)) {
      recommendations.push(rec)
    }
  }

  // Add score-based recommendations
  if (context.confidence_score && context.confidence_score < 80) {
    recommendations.push({
      id: randomUUID(),
      source_agent: 'confidence-engine',
      priority: 'high',
      category: 'quality',
      title: `Your confidence score is ${context.confidence_score}/100`,
      body: `The benchmark for shipped products is 75+. Your score of ${context.confidence_score} means there are specific improvements that would significantly impact your users. The top issue: ${context.top_issue || 'check your confidence report'}.`,
      action: { label: 'View full report', url: '/confidence' },
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      shown: false,
      dismissed: false,
    })
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return recommendations.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3))
}

export async function getWeeklyBrief(context) {
  const { generateWeeklyBrief } = await import('./coach-weekly-brief.js')
  return generateWeeklyBrief(context.build_id)
}

export function processAgentOutput(agentName, output, buildId) {
  if (!output?.recommendations) return []

  return output.recommendations.map(rec => ({
    id: randomUUID(),
    source_agent: agentName,
    priority: rec.priority || 'medium',
    category: rec.category || agentName.replace('-agent', ''),
    title: rec.title || 'New insight from ' + agentName,
    body: CoachPersonality.formatRecommendation({ body: rec.body || rec.description || '' }).body,
    action: rec.action || { label: 'Learn more' },
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    shown: false,
    dismissed: false,
    build_id: buildId,
  }))
}

export async function getUrgentInterventions(context) {
  const all = CoachInterventions.checkInterventions(context)
  return all.filter(i => i.priority === 'critical' || i.priority === 'high')
}

function buildRawRecommendation(context, focusArea) {
  const { metrics = {}, app_name } = context

  const templates = {
    growth: {
      title: `${app_name} needs its first 100 users`,
      body: `Your user count is ${metrics.users || 0}. The first 100 users validate your product-market fit. The fastest path: reach out to 20 people in your personal network today.`,
      action: { label: 'Get first 100 users →', url: null },
    },
    product: {
      title: 'Ship your next feature in the next 7 days',
      body: `Users who see progress stay. A small improvement shipped weekly compounds faster than a large release monthly.`,
      action: { label: 'Open roadmap →', url: null },
    },
    technical: {
      title: 'Your app has room to improve technically',
      body: `Technical debt compounds at the same rate as user growth. One hour this week on code quality saves 5 hours next month.`,
      action: { label: 'View confidence report →', url: '/confidence' },
    },
  }

  return templates[focusArea] || templates.growth
}

function determinePriority(context) {
  if (context.confidence_score < 60) return 'critical'
  if (context.confidence_score < 75) return 'high'
  if ((context.metrics?.users || 0) === 0) return 'high'
  return 'medium'
}

async function interventionToRecommendation(intervention, context) {
  return {
    id: randomUUID(),
    source_agent: 'intervention-engine',
    priority: intervention.priority,
    category: intervention.category,
    title: intervention.title,
    body: intervention.message,
    action: intervention.action || { label: 'Take action' },
    expires_at: new Date(Date.now() + (intervention.one_time ? 365 : 7) * 24 * 60 * 60 * 1000).toISOString(),
    shown: false,
    dismissed: false,
  }
}
