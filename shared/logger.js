// shared/logger.js — Structured logger for all Sovereign agents

const LEVELS = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 }
const COLORS = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
}
const RESET = '\x1b[0m'
const isTTY = process.stdout.isTTY

export function createLogger(agentName, minLevel = 'info') {
  const minLevelNum = LEVELS[minLevel] ?? 2

  function log(level, message, data = {}) {
    if ((LEVELS[level] ?? 2) < minLevelNum) return

    const now = new Date()
    const time = now.toTimeString().slice(0, 8)
    const iso = now.toISOString()

    if (isTTY) {
      const color = COLORS[level] || ''
      const tag = `[${agentName.toUpperCase()}]`
      const lvl = level.toUpperCase().padEnd(5)
      const dataStr = Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : ''
      console.log(`${color}[${time}] ${tag} ${lvl}${RESET} ${message}${dataStr}`)
    } else {
      console.log(JSON.stringify({ timestamp: iso, agent: agentName, level, message, data }))
    }
  }

  function logIssue(issue) {
    const severity = issue.severity || 'medium'
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn'
    log(level, `Issue [${severity}]: ${issue.message}`, {
      file: issue.file,
      line: issue.line,
      severity,
    })
  }

  function logPattern(pattern) {
    log('info', `Pattern found: ${pattern.name}`, { when_to_use: pattern.when_to_use })
  }

  return { log, logIssue, logPattern, trace: (m, d) => log('trace', m, d), debug: (m, d) => log('debug', m, d), info: (m, d) => log('info', m, d), warn: (m, d) => log('warn', m, d), error: (m, d) => log('error', m, d), fatal: (m, d) => log('fatal', m, d) }
}
