#!/usr/bin/env node
// brain/cycle1-per-project.js — Per-project learning cycle
//
// Run after every build completes. Extracts lessons from the pipeline
// and records them to the Brain API.
//
// Usage:
//   node brain/cycle1-per-project.js --pipeline path/to/pipeline.json
//   node brain/cycle1-per-project.js --test   (runs on mock data)

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as BrainAPI from './brain-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── MOCK DATA FOR --test MODE ────────────────────────────────────────────────

const MOCK_PIPELINE = {
  build_id: 'test-build-001',
  app_name: 'TestApp',
  confidence_score: 82,
  errors: [
    { type: 'tsc', message: "Cannot find namespace 'React'" },
  ],
  warnings: [
    { type: 'contrast', message: 'Button color may fail WCAG AA' },
  ],
  duration_seconds: 145,
  phases: {
    generation: { success: true, attempts: 2 },
    github: { success: true },
    vercel: { success: true, deployment_time: 67 },
  },
  agent_outputs: {
    security_agent: { score: 88, issues: [] },
    accessibility_agent: { score: 79, issues: [{ message: 'Missing aria-label on nav' }] },
  },
}

// ─── LESSON EXTRACTION ────────────────────────────────────────────────────────

function extractLessons(pipeline) {
  const lessons = []

  // Extract from errors
  for (const err of (pipeline.errors || [])) {
    const lesson = classifyError(err, pipeline)
    if (lesson) lessons.push(lesson)
  }

  // Extract from phase failures
  for (const [phase, result] of Object.entries(pipeline.phases || {})) {
    if (!result.success) {
      lessons.push({
        category: phase,
        source: 'build',
        problem: `${phase} phase failed for build ${pipeline.build_id}`,
        solution: '',
        applied_automatically: false,
        tags: [phase, 'failure'],
      })
    }
    if (phase === 'generation' && result.attempts > 1) {
      lessons.push({
        category: 'generation',
        source: 'build',
        problem: `Generation required ${result.attempts} attempts`,
        solution: 'Check system prompt for ambiguous instructions that cause retries',
        applied_automatically: false,
        tags: ['generation', 'retry'],
      })
    }
  }

  // Extract from agent outputs
  for (const [agent, output] of Object.entries(pipeline.agent_outputs || {})) {
    if (output.score < 70) {
      lessons.push({
        category: 'agent',
        source: 'build',
        problem: `${agent} scored ${output.score}/100 — below 70 threshold`,
        solution: `Review ${agent} output and strengthen evaluation criteria`,
        applied_automatically: false,
        tags: [agent, 'low_score'],
      })
    }
    for (const issue of (output.issues || [])) {
      lessons.push({
        category: 'ux',
        source: 'build',
        problem: issue.message,
        solution: '',
        applied_automatically: false,
        tags: [agent],
      })
    }
  }

  return lessons
}

function classifyError(err, pipeline) {
  const msg = err.message || ''

  if (msg.includes("Cannot find namespace 'React'")) {
    return {
      category: 'generation',
      source: 'build',
      problem: "Generated TypeScript uses React.* namespace types (React.FormEvent etc)",
      solution: "Use named type imports: import { type FormEvent } from 'react'",
      applied_automatically: false,
      tags: ['typescript', 'react-types', 'tsc'],
    }
  }

  if (msg.includes('ERR_MODULE_NOT_FOUND') || msg.includes("Cannot find module")) {
    return {
      category: 'deployment',
      source: 'build',
      problem: "Missing .js extension on relative import in api/ — Node ESM fails at cold-start",
      solution: "Add .js to all relative imports: import { x } from './_util.js'",
      applied_automatically: false,
      tags: ['esm', 'imports', 'vercel'],
    }
  }

  if (msg.toLowerCase().includes('timeout') || msg.includes('504')) {
    return {
      category: 'deployment',
      source: 'build',
      problem: `Vercel function timed out during ${pipeline.phases?.generation?.attempts > 1 ? 'generation' : 'build'}`,
      solution: "Add maxDuration = 300 and convert to SSE streaming for long-running routes",
      applied_automatically: false,
      tags: ['timeout', 'vercel', 'sse'],
    }
  }

  if (msg.includes('WCAG') || msg.includes('contrast')) {
    return {
      category: 'ux',
      source: 'build',
      problem: `Accessibility contrast issue: ${msg}`,
      solution: "Apply brightness formula: (R*299 + G*587 + B*114)/1000 > 128 → dark text, else white text",
      applied_automatically: false,
      tags: ['accessibility', 'contrast', 'wcag'],
    }
  }

  return {
    category: 'general',
    source: 'build',
    problem: `Build error: ${msg}`,
    solution: '',
    applied_automatically: false,
    tags: [err.type || 'unknown'],
  }
}

// ─── BUILD SCORING ────────────────────────────────────────────────────────────

function scoreBuild(pipeline) {
  const scores = {
    generation_quality: pipeline.phases?.generation?.success ? (pipeline.phases.generation.attempts === 1 ? 100 : 70) : 0,
    deployment_success: pipeline.phases?.vercel?.success && pipeline.phases?.github?.success ? 100 : 0,
    user_clarity: pipeline.confidence_score || 0,
    security: pipeline.agent_outputs?.security_agent?.score || 50,
    performance: pipeline.phases?.vercel?.deployment_time < 120 ? 90 : 60,
  }

  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length)

  return { ...scores, overall }
}

// ─── PATTERN EXTRACTION ───────────────────────────────────────────────────────

function extractPatterns(pipeline) {
  const patterns = []

  if (pipeline.phases?.generation?.success && pipeline.phases.generation.attempts === 1) {
    patterns.push({
      name: 'Single-attempt generation success',
      description: 'App generated without retries — prompt and context were clear',
      when_to_use: 'Extract what made this brief clear for future system prompt improvements',
      tags: ['generation', 'success'],
    })
  }

  if (pipeline.phases?.vercel?.deployment_time < 60) {
    patterns.push({
      name: 'Fast Vercel deployment',
      description: `Deployment completed in ${pipeline.phases.vercel.deployment_time}s`,
      when_to_use: 'Analyze what made this build fast — minimal dependencies, clean scaffold',
      tags: ['deployment', 'performance'],
    })
  }

  return patterns
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const isTest = args.includes('--test')
  const pipelineFlag = args.indexOf('--pipeline')
  const pipelinePath = pipelineFlag !== -1 ? args[pipelineFlag + 1] : null

  let pipeline

  if (isTest) {
    console.log('[Brain Cycle 1] Running in test mode with mock data')
    pipeline = MOCK_PIPELINE
  } else if (pipelinePath) {
    if (!existsSync(pipelinePath)) {
      console.error(`[Brain Cycle 1] Pipeline file not found: ${pipelinePath}`)
      process.exit(1)
    }
    pipeline = JSON.parse(readFileSync(pipelinePath, 'utf-8'))
  } else {
    // Try reading from stdin
    try {
      const stdin = readFileSync('/dev/stdin', 'utf-8')
      pipeline = JSON.parse(stdin)
    } catch {
      console.error('[Brain Cycle 1] No pipeline data. Use --pipeline <path> or --test')
      process.exit(1)
    }
  }

  console.log(`[Brain Cycle 1] Processing build: ${pipeline.build_id || 'unknown'}`)

  // Extract and record lessons
  const lessons = extractLessons(pipeline)
  console.log(`[Brain Cycle 1] Extracted ${lessons.length} lessons`)

  for (const lesson of lessons) {
    const recorded = BrainAPI.recordLesson(lesson)
    console.log(`  → [${lesson.category}] ${lesson.problem.slice(0, 80)} (count: ${recorded.build_count})`)
  }

  // Score the build
  const scores = scoreBuild(pipeline)
  BrainAPI.recordBuildMetrics(pipeline.build_id, {
    ...scores,
    confidence_score: pipeline.confidence_score,
    app_name: pipeline.app_name,
  })
  console.log(`[Brain Cycle 1] Build scores: ${JSON.stringify(scores)}`)

  // Extract and record patterns
  const patterns = extractPatterns(pipeline)
  for (const pattern of patterns) {
    BrainAPI.recordPattern(pattern)
    console.log(`  → Pattern: ${pattern.name}`)
  }

  // Print system health
  const health = BrainAPI.getSystemHealth()
  console.log(`[Brain Cycle 1] Complete — Brain has ${health.lessons_count} lessons, ${health.patterns_count} patterns`)
  console.log(`[Brain Cycle 1] Overall build score: ${scores.overall}/100`)
}

main().catch(err => {
  console.error('[Brain Cycle 1] Fatal:', err.message)
  process.exit(1)
})
