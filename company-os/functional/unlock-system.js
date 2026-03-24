// company-os/functional/unlock-system.js
// Progressive agent unlocking based on company metrics and context.

export const UNLOCK_CONDITIONS = {
  cto: {
    description: 'Technical architecture review and scaling recommendations',
    condition: () => true, // always unlocked
    reason: 'Every technical founder needs CTO-level guidance from day 1',
  },
  cfo: {
    description: 'Financial analysis: LTV:CAC, burn rate, pricing optimization',
    condition: (context) => hasPayments(context) || (context.metrics?.revenue || 0) > 0,
    reason: 'Unlocks when app has payment integration or revenue',
  },
  cmo: {
    description: 'Marketing strategy, channel mix, messaging frameworks',
    condition: (context) => hasMarketing(context) || (context.metrics?.users || 0) >= 100,
    reason: 'Unlocks when app has marketing pages or 100+ users',
  },
  legal: {
    description: 'Legal risks, terms of service review, compliance checklist',
    condition: (context) => hasUserData(context) || hasPayments(context),
    reason: 'Unlocks when app collects user data or has paid tier',
  },
  people: {
    description: 'Hiring recommendations, team structure, culture',
    condition: (context) => (context.team_size || 1) > 1,
    reason: 'Unlocks when team grows beyond solo founder',
  },
  cx: {
    description: 'Customer experience audit, support patterns, NPS improvement',
    condition: (context) => hasSupport(context) || (context.metrics?.users || 0) >= 50,
    reason: 'Unlocks when app has support contact or 50+ users',
  },
}

export function getUnlockedAgents(context) {
  return Object.entries(UNLOCK_CONDITIONS)
    .filter(([, config]) => {
      try { return config.condition(context) }
      catch { return false }
    })
    .map(([name]) => name)
}

export function checkUnlock(agentName, context) {
  const config = UNLOCK_CONDITIONS[agentName]
  if (!config) return false
  try { return config.condition(context) }
  catch { return false }
}

export function getUnlockCondition(agentName) {
  const config = UNLOCK_CONDITIONS[agentName]
  return config ? { reason: config.reason, description: config.description } : null
}

export function notifyUnlock(agentName, context) {
  const config = UNLOCK_CONDITIONS[agentName]
  if (!config) return null
  return {
    agent: agentName,
    unlocked_at: new Date().toISOString(),
    reason: config.reason,
    first_recommendation: `Your ${agentName.toUpperCase()} is now available. Run analysis for ${context.app_name}.`,
  }
}

export function getUnlockProgress(context) {
  const all = Object.keys(UNLOCK_CONDITIONS)
  const unlocked = getUnlockedAgents(context)
  return {
    unlocked: unlocked.length,
    total: all.length,
    percentage: Math.round((unlocked.length / all.length) * 100),
    unlocked_agents: unlocked,
    locked_agents: all.filter(a => !unlocked.includes(a)),
    next_unlock: getNextUnlock(context, all, unlocked),
  }
}

function getNextUnlock(context, all, unlocked) {
  const locked = all.filter(a => !unlocked.includes(a))
  if (locked.length === 0) return null
  const next = locked[0]
  return { agent: next, condition: UNLOCK_CONDITIONS[next]?.reason }
}

function hasPayments(context) {
  return (context.features || []).some(f => /payment|stripe|subscription|billing/i.test(f))
}

function hasMarketing(context) {
  return (context.features || []).some(f => /marketing|landing|seo|blog/i.test(f))
}

function hasUserData(context) {
  return (context.features || []).some(f => /user|auth|account|profile/i.test(f))
}

function hasSupport(context) {
  return (context.features || []).some(f => /support|help|contact|ticket/i.test(f))
}
