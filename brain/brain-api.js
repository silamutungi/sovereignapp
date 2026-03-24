// brain/brain-api.js — Sovereign's learning and memory system
//
// The Brain records lessons, patterns, and decisions from every build.
// Every agent reads from and writes to the Brain to get smarter over time.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '.brain-data')
const LESSONS_FILE = join(DATA_DIR, 'lessons.json')
const PATTERNS_FILE = join(DATA_DIR, 'patterns.json')
const DECISIONS_FILE = join(DATA_DIR, 'decisions.json')
const METRICS_FILE = join(DATA_DIR, 'build-metrics.json')
const KNOWLEDGE_DIR = join(DATA_DIR, 'knowledge')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(KNOWLEDGE_DIR)) mkdirSync(KNOWLEDGE_DIR, { recursive: true })
}

function readJSON(file, fallback = []) {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return fallback
  }
}

function writeJSON(file, data) {
  ensureDataDir()
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  writeFileSync(file, readFileSync(tmp))
}

// ─── LESSONS ──────────────────────────────────────────────────────────────────

export function recordLesson(lesson) {
  ensureDataDir()
  const lessons = readJSON(LESSONS_FILE)
  const existing = lessons.find(
    l => l.problem === lesson.problem && l.category === lesson.category
  )
  if (existing) {
    existing.build_count = (existing.build_count || 1) + 1
    existing.updated_at = new Date().toISOString()
    if (lesson.solution && !existing.solution) existing.solution = lesson.solution
    writeJSON(LESSONS_FILE, lessons)
    return existing
  }
  const entry = {
    id: randomUUID(),
    category: lesson.category || 'general',
    source: lesson.source || 'build',
    problem: lesson.problem,
    solution: lesson.solution || '',
    applied_automatically: lesson.applied_automatically || false,
    build_count: 1,
    tags: lesson.tags || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  lessons.push(entry)
  writeJSON(LESSONS_FILE, lessons)
  return entry
}

export function getLessons(filter = {}) {
  const lessons = readJSON(LESSONS_FILE)
  return lessons.filter(l => {
    if (filter.category && l.category !== filter.category) return false
    if (filter.source && l.source !== filter.source) return false
    if (filter.tag && !l.tags.includes(filter.tag)) return false
    if (filter.minBuildCount && l.build_count < filter.minBuildCount) return false
    return true
  })
}

// ─── PATTERNS ─────────────────────────────────────────────────────────────────

export function recordPattern(pattern) {
  ensureDataDir()
  const patterns = readJSON(PATTERNS_FILE)
  const existing = patterns.find(p => p.name === pattern.name)
  if (existing) {
    existing.usage_count = (existing.usage_count || 1) + 1
    existing.updated_at = new Date().toISOString()
    writeJSON(PATTERNS_FILE, patterns)
    return existing
  }
  const entry = {
    id: randomUUID(),
    name: pattern.name,
    description: pattern.description,
    code_example: pattern.code_example || '',
    when_to_use: pattern.when_to_use || '',
    tags: pattern.tags || [],
    usage_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  patterns.push(entry)
  writeJSON(PATTERNS_FILE, patterns)
  return entry
}

export function getPatterns(filter = {}) {
  const patterns = readJSON(PATTERNS_FILE)
  return patterns.filter(p => {
    if (filter.tag && !p.tags.includes(filter.tag)) return false
    return true
  }).sort((a, b) => b.usage_count - a.usage_count)
}

// ─── DECISIONS ────────────────────────────────────────────────────────────────

export function recordDecision(decision) {
  ensureDataDir()
  const decisions = readJSON(DECISIONS_FILE)
  const entry = {
    id: randomUUID(),
    title: decision.title,
    context: decision.context,
    decision: decision.decision,
    rationale: decision.rationale,
    decided_at: decision.decided_at || new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
  decisions.push(entry)
  writeJSON(DECISIONS_FILE, decisions)
  return entry
}

export function getDecisions() {
  return readJSON(DECISIONS_FILE)
}

// ─── BUILD METRICS ────────────────────────────────────────────────────────────

export function recordBuildMetrics(buildId, metrics) {
  ensureDataDir()
  const all = readJSON(METRICS_FILE, {})
  all[buildId] = {
    ...metrics,
    build_id: buildId,
    recorded_at: new Date().toISOString(),
  }
  writeJSON(METRICS_FILE, all)
}

export function getBuildMetrics(buildId) {
  const all = readJSON(METRICS_FILE, {})
  return buildId ? all[buildId] : all
}

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────

export function getInsights() {
  const lessons = readJSON(LESSONS_FILE)
  const patterns = readJSON(PATTERNS_FILE)
  const metrics = readJSON(METRICS_FILE, {})
  const builds = Object.values(metrics)

  const categoryBreakdown = {}
  for (const lesson of lessons) {
    categoryBreakdown[lesson.category] = (categoryBreakdown[lesson.category] || 0) + 1
  }

  const topLessons = [...lessons]
    .sort((a, b) => b.build_count - a.build_count)
    .slice(0, 10)

  const avgScore = builds.length
    ? builds.reduce((sum, b) => sum + (b.confidence_score || 0), 0) / builds.length
    : null

  return {
    total_lessons: lessons.length,
    total_patterns: patterns.length,
    total_builds: builds.length,
    category_breakdown: categoryBreakdown,
    top_lessons: topLessons,
    top_patterns: patterns.slice(0, 5),
    average_confidence_score: avgScore,
    trend: builds.length > 1 ? calculateTrend(builds) : null,
  }
}

function calculateTrend(builds) {
  const sorted = builds
    .filter(b => b.confidence_score && b.recorded_at)
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
  if (sorted.length < 2) return 'insufficient_data'
  const first = sorted[0].confidence_score
  const last = sorted[sorted.length - 1].confidence_score
  if (last > first + 5) return 'improving'
  if (last < first - 5) return 'declining'
  return 'stable'
}

// ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────

export function updateKnowledgeBase(domain, content) {
  ensureDataDir()
  const file = join(KNOWLEDGE_DIR, `${domain}.json`)
  writeJSON(file, { domain, content, updated_at: new Date().toISOString() })
}

export function getKnowledgeBase(domain) {
  const file = join(KNOWLEDGE_DIR, `${domain}.json`)
  return readJSON(file, null)
}

// ─── SYNTHESIS ────────────────────────────────────────────────────────────────

export function synthesize() {
  const lessons = readJSON(LESSONS_FILE)
  const patterns = readJSON(PATTERNS_FILE)

  // Find meta-patterns: lessons that appear in multiple categories
  const recurring = lessons.filter(l => l.build_count >= 3)
  const dominantCategories = Object.entries(
    lessons.reduce((acc, l) => {
      acc[l.category] = (acc[l.category] || 0) + l.build_count
      return acc
    }, {})
  ).sort(([, a], [, b]) => b - a)

  const synthesis = {
    synthesized_at: new Date().toISOString(),
    recurring_lessons: recurring.length,
    dominant_failure_categories: dominantCategories.slice(0, 3).map(([cat]) => cat),
    top_patterns: patterns.slice(0, 5).map(p => p.name),
    recommendations: generateSynthesisRecommendations(recurring, dominantCategories),
  }

  return synthesis
}

function generateSynthesisRecommendations(recurring, dominant) {
  const recs = []
  if (recurring.length > 5) {
    recs.push(`${recurring.length} lessons are recurring — consider automating fixes for: ${recurring[0]?.problem?.slice(0, 80)}`)
  }
  if (dominant[0]) {
    recs.push(`Most failures in '${dominant[0][0]}' category — strengthen this evaluator`)
  }
  return recs
}

// ─── SYSTEM HEALTH ────────────────────────────────────────────────────────────

export function getSystemHealth() {
  const lessons = readJSON(LESSONS_FILE)
  const patterns = readJSON(PATTERNS_FILE)
  const metrics = readJSON(METRICS_FILE, {})

  return {
    status: 'healthy',
    lessons_count: lessons.length,
    patterns_count: patterns.length,
    builds_tracked: Object.keys(metrics).length,
    data_dir: DATA_DIR,
    last_updated: lessons.length
      ? lessons.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0].updated_at
      : null,
  }
}
