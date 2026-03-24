// company-os/coach/coach-interventions.js
// Defines when and how the Coach intervenes.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SHOWN_DIR = join(__dirname, '..', 'intervention-log')

export const INTERVENTIONS = {
  LAUNCH: {
    trigger: 'launch',
    priority: 'high',
    category: 'onboarding',
    title: 'Your app is live. Here is your first 24 hours.',
    message: 'Share it with 5 people you trust today — not for validation, for learning. Ask them one question: "What is confusing about this?" Their answers are worth more than any analytics tool.',
    action: { label: 'Get first 5 users' },
    one_time: true,
    cooldown_hours: null,
  },
  FIRST_DAY: {
    trigger: 'first_day',
    priority: 'medium',
    category: 'growth',
    title: '24 hours since launch. How did it go?',
    message: 'The first day feedback is the most valuable you will ever get. Every piece of confusion a user finds today will be found by 100 users next month. Fix the 3 biggest friction points today.',
    action: { label: 'Review user feedback' },
    one_time: true,
    cooldown_hours: null,
  },
  FIRST_WEEK: {
    trigger: 'first_week',
    priority: 'medium',
    category: 'product',
    title: 'One week in. Ship your first improvement.',
    message: 'Users who see the product improve in their first week retain at 2x the rate of users who see nothing change. What is the one thing 3+ users mentioned? Ship a fix for that today.',
    action: { label: 'Plan first improvement' },
    one_time: true,
    cooldown_hours: null,
  },
  LOW_SCORE: {
    trigger: 'low_score',
    priority: 'high',
    category: 'quality',
    title: 'Your confidence score dropped below 70',
    message: 'A score below 70 means users are hitting friction your testing did not catch. Run the confidence report and fix the top critical issue today — it is usually a 30-minute fix with high impact.',
    action: { label: 'View confidence report', url: '/confidence' },
    one_time: false,
    cooldown_hours: 72,
  },
  NO_ACTIVITY: {
    trigger: 'no_activity',
    priority: 'low',
    category: 'product',
    title: 'No commits in 7 days',
    message: 'Momentum compounds. Users who see regular improvements stay longer. Even a small fix shipped weekly signals that your product is alive. What is the smallest improvement you could ship today?',
    action: { label: 'Open your repo' },
    one_time: false,
    cooldown_hours: 168,
  },
  METRIC_ALERT: {
    trigger: 'metric_alert',
    priority: 'critical',
    category: 'metrics',
    title: 'A key metric is below benchmark',
    message: 'Benchmarks exist because they have been validated across thousands of products. Being below benchmark is not a failure — it is a signal. The signal always points to a specific user behavior.',
    action: { label: 'View analytics' },
    one_time: false,
    cooldown_hours: 24,
  },
  AGENT_UNLOCK: {
    trigger: 'agent_unlock',
    priority: 'medium',
    category: 'company_os',
    title: 'A new advisor has unlocked for your product',
    message: 'As your product grows, new intelligence unlocks. This advisor has specific domain knowledge relevant to where you are right now.',
    action: { label: 'Meet your advisor' },
    one_time: true,
    cooldown_hours: null,
  },
}

export function checkInterventions(context) {
  const due = []
  const now = Date.now()
  const deployedAt = new Date(context.deployed_at || Date.now()).getTime()
  const hoursSinceDeployment = (now - deployedAt) / (1000 * 60 * 60)

  // LAUNCH — immediately
  if (hoursSinceDeployment < 1 && !wasShown(context.build_id, 'LAUNCH')) {
    due.push(INTERVENTIONS.LAUNCH)
  }

  // FIRST_DAY — 20-28 hours after launch
  if (hoursSinceDeployment >= 20 && hoursSinceDeployment < 28 && !wasShown(context.build_id, 'FIRST_DAY')) {
    due.push(INTERVENTIONS.FIRST_DAY)
  }

  // FIRST_WEEK — 6-8 days after launch
  if (hoursSinceDeployment >= 144 && hoursSinceDeployment < 192 && !wasShown(context.build_id, 'FIRST_WEEK')) {
    due.push(INTERVENTIONS.FIRST_WEEK)
  }

  // LOW_SCORE
  if ((context.confidence_score || 100) < 70) {
    if (canShow(context.build_id, 'LOW_SCORE', 72)) {
      due.push({ ...INTERVENTIONS.LOW_SCORE, message: INTERVENTIONS.LOW_SCORE.message + ` Current score: ${context.confidence_score}/100.` })
    }
  }

  // NO_ACTIVITY — check last_commit
  if (context.last_commit_at) {
    const hoursSinceCommit = (now - new Date(context.last_commit_at).getTime()) / (1000 * 60 * 60)
    if (hoursSinceCommit > 168 && canShow(context.build_id, 'NO_ACTIVITY', 168)) {
      due.push(INTERVENTIONS.NO_ACTIVITY)
    }
  }

  return due
}

export function recordIntervention(interventionKey, buildId) {
  if (!existsSync(SHOWN_DIR)) mkdirSync(SHOWN_DIR, { recursive: true })
  const file = join(SHOWN_DIR, `${buildId}.json`)
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : {}
  existing[interventionKey] = { shown_at: new Date().toISOString() }
  writeFileSync(file, JSON.stringify(existing, null, 2))
}

function wasShown(buildId, interventionKey) {
  const file = join(SHOWN_DIR, `${buildId}.json`)
  if (!existsSync(file)) return false
  const data = JSON.parse(readFileSync(file, 'utf-8'))
  return !!data[interventionKey]
}

function canShow(buildId, interventionKey, cooldownHours) {
  const file = join(SHOWN_DIR, `${buildId}.json`)
  if (!existsSync(file)) return true
  const data = JSON.parse(readFileSync(file, 'utf-8'))
  const entry = data[interventionKey]
  if (!entry) return true
  const hoursSinceShown = (Date.now() - new Date(entry.shown_at).getTime()) / (1000 * 60 * 60)
  return hoursSinceShown >= cooldownHours
}

export function getInterventionTemplate(trigger) {
  return Object.values(INTERVENTIONS).find(i => i.trigger === trigger) || null
}
