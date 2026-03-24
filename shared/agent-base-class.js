// shared/agent-base-class.js — Base class for all 30 Sovereign pipeline agents
//
// Every agent extends AgentBase. This provides:
// - Lifecycle management (init → run → verify → teardown)
// - Brain API integration (lessons, patterns)
// - Confidence Engine integration (scoring)
// - Pipeline state management
// - Structured logging
// - SOVEREIGN_RULES.md enforcement

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as BrainAPI from '../brain/brain-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

export class AgentBase {
  constructor(config = {}) {
    this.name = config.name || 'unknown-agent'
    this.phase = config.phase || 'unknown'
    this.version = config.version || '1.0.0'
    this.startedAt = null
    this.completedAt = null
    this.issues = []
    this.lessons = []
    this.patterns = []
    this.rules = null
    this._sovereignPatterns = null
    this._sovereignAntipatterns = null
  }

  // ─── LIFECYCLE (override in subclass) ─────────────────────────────────────

  async init() {}

  /** @abstract Must be overridden — returns agent-specific output */
  async run(_context) {
    throw new Error(`${this.name}: run() not implemented`)
  }

  async verify(output) {
    return output
  }

  async teardown() {}

  // ─── BRAIN INTEGRATION ────────────────────────────────────────────────────

  async recordLesson(lesson) {
    this.lessons.push(lesson)
    return BrainAPI.recordLesson({
      ...lesson,
      source: lesson.source || 'agent',
      tags: [...(lesson.tags || []), this.name, this.phase],
    })
  }

  async recordPattern(pattern) {
    this.patterns.push(pattern)
    return BrainAPI.recordPattern({
      ...pattern,
      tags: [...(pattern.tags || []), this.name, this.phase],
    })
  }

  async loadRelevantLessons() {
    try {
      return BrainAPI.getLessons({ tag: this.phase })
    } catch {
      return []
    }
  }

  // ─── CONFIDENCE INTEGRATION ───────────────────────────────────────────────

  async scoreOutput(output) {
    // Subclasses override this for domain-specific scoring
    // Default: return null (no score)
    return null
  }

  // ─── PIPELINE STATE ───────────────────────────────────────────────────────

  async updatePipelineState(update) {
    try {
      const { updateAgent } = await import('./pipeline-state.js')
      await updateAgent(this.name, update.status, update)
    } catch {
      // Pipeline state is best-effort; don't fail the agent if it can't update
    }
  }

  // ─── SOVEREIGN RULES ──────────────────────────────────────────────────────

  loadSovereignRules() {
    const rulesPath = join(ROOT, 'brain', 'SOVEREIGN_RULES.md')
    if (existsSync(rulesPath)) {
      this.rules = readFileSync(rulesPath, 'utf-8')
    }
    return this.rules
  }

  loadSovereignPatterns() {
    const patternsPath = join(ROOT, 'brain', 'SOVEREIGN_PATTERNS.md')
    if (existsSync(patternsPath)) {
      this._sovereignPatterns = readFileSync(patternsPath, 'utf-8')
    }
    return this._sovereignPatterns
  }

  loadSovereignAntipatterns() {
    const antiPath = join(ROOT, 'brain', 'SOVEREIGN_ANTIPATTERNS.md')
    if (existsSync(antiPath)) {
      this._sovereignAntipatterns = readFileSync(antiPath, 'utf-8')
    }
    return this._sovereignAntipatterns
  }

  // ─── LOGGING ──────────────────────────────────────────────────────────────

  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      agent: this.name,
      phase: this.phase,
      level,
      message,
      ...(Object.keys(data).length > 0 ? { data } : {}),
    }
    const colors = {
      trace: '\x1b[90m',
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    }
    const reset = '\x1b[0m'
    const color = colors[level] || ''
    const time = new Date().toTimeString().slice(0, 8)
    const prefix = `${color}[${time}] [${this.name.toUpperCase()}] ${level.toUpperCase()}${reset}`
    console.log(`${prefix} ${message}`, Object.keys(data).length > 0 ? data : '')
    return entry
  }

  logIssue(issue) {
    this.issues.push(issue)
    this.log(
      issue.severity === 'critical' || issue.severity === 'high' ? 'error' : 'warn',
      `Issue found: ${issue.message}`,
      { severity: issue.severity, file: issue.file }
    )
  }

  // ─── UTILITIES ────────────────────────────────────────────────────────────

  async readFile(filePath) {
    if (!existsSync(filePath)) return null
    return readFileSync(filePath, 'utf-8')
  }

  async writeFile(filePath, content) {
    const { writeFileSync, mkdirSync } = await import('fs')
    const { dirname: dn } = await import('path')
    mkdirSync(dn(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }

  // ─── MAIN RUNNER ──────────────────────────────────────────────────────────

  async execute(context = {}) {
    this.startedAt = Date.now()
    this.log('info', `${this.name} starting`)

    // Always load SOVEREIGN_RULES.md before running
    this.loadSovereignRules()
    this.loadSovereignPatterns()
    this.loadSovereignAntipatterns()

    await this.init()
    await this.loadRelevantLessons()
    await this.updatePipelineState({ status: 'running', agent: this.name })

    try {
      const output = await this.run(context)
      const verified = await this.verify(output)
      const score = await this.scoreOutput(output)

      this.completedAt = Date.now()
      const elapsed = Math.round((this.completedAt - this.startedAt) / 1000)

      await this.updatePipelineState({ status: 'complete', agent: this.name, score })

      for (const lesson of this.lessons) {
        await this.recordLesson(lesson)
      }
      for (const pattern of this.patterns) {
        await this.recordPattern(pattern)
      }

      this.log('info', `${this.name} complete in ${elapsed}s`, {
        score: score?.overall_score ?? 'n/a',
        issues: this.issues.length,
      })

      return { output: verified, score, issues: this.issues, elapsed }
    } catch (err) {
      this.log('error', `${this.name} failed: ${err.message}`)
      await this.updatePipelineState({ status: 'failed', agent: this.name, error: err.message })

      await BrainAPI.recordLesson({
        category: 'agent',
        source: 'build',
        problem: `${this.name} failed: ${err.message}`,
        solution: '',
        applied_automatically: false,
        tags: [this.name, this.phase, 'failure'],
      })

      throw err
    } finally {
      await this.teardown()
    }
  }
}
