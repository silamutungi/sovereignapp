#!/usr/bin/env node
// brain/cycle3-monthly.js — Monthly strategic synthesis
// Run on the 1st of each month. Produces strategic quality report.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as BrainAPI from './brain-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const MONTHLY_DIR = join(__dirname, 'monthly-reports')
const BRIEFS_DIR = join(__dirname, 'weekly-briefs')

async function main() {
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  console.log(`[Brain Cycle 3] Monthly strategic synthesis — ${monthStr}`)

  // Load all weekly briefs from the past 30 days
  const weeklyBriefs = loadRecentBriefs(30)
  console.log(`[Brain Cycle 3] Loaded ${weeklyBriefs.length} weekly briefs`)

  // Get all data from Brain
  const allLessons = BrainAPI.getLessons({})
  const allPatterns = BrainAPI.getPatterns({})
  const insights = BrainAPI.getInsights()

  // Calculate health trends
  const trend = calculateHealthTrend(weeklyBriefs)

  // Find top lessons that prevented failures
  const topLessons = allLessons
    .filter(l => l.solution && l.build_count >= 5)
    .sort((a, b) => b.build_count - a.build_count)
    .slice(0, 10)

  // Category improvement analysis
  const categoryTrends = analyzeCategoryTrends(weeklyBriefs)

  // Prompt improvement recommendations
  const promptRecs = generatePromptRecommendations(allLessons, categoryTrends)

  const report = {
    month: monthStr,
    generated_at: now.toISOString(),
    weekly_briefs_analyzed: weeklyBriefs.length,
    health_summary: {
      total_lessons: allLessons.length,
      total_patterns: allPatterns.length,
      quality_trend: trend.direction,
      trend_delta: trend.delta,
      avg_confidence: insights.average_confidence_score,
    },
    top_lessons_preventing_failures: topLessons.map(l => ({
      problem: l.problem.slice(0, 150),
      solution: l.solution.slice(0, 200),
      builds_prevented: l.build_count,
      category: l.category,
    })),
    category_trends: categoryTrends,
    prompt_improvement_recommendations: promptRecs,
    meta_patterns: extractMetaPatterns(allLessons),
    strategic_summary: buildStrategicSummary(trend, topLessons, promptRecs),
  }

  // Save report
  if (!existsSync(MONTHLY_DIR)) mkdirSync(MONTHLY_DIR, { recursive: true })
  const reportPath = join(MONTHLY_DIR, `${monthStr}.md`)
  writeFileSync(reportPath, formatMonthlyReport(report))

  const jsonPath = join(MONTHLY_DIR, `${monthStr}.json`)
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  console.log(`[Brain Cycle 3] Monthly report saved to ${reportPath}`)
  console.log(`[Brain Cycle 3] Quality trend: ${trend.direction} (${trend.delta > 0 ? '+' : ''}${trend.delta} points)`)
  console.log(`[Brain Cycle 3] Top category needing attention: ${categoryTrends[0]?.category || 'none'}`)

  return report
}

function loadRecentBriefs(days) {
  if (!existsSync(BRIEFS_DIR)) return []
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return readdirSync(BRIEFS_DIR)
    .filter(f => f.endsWith('.json') && f >= cutoff)
    .map(f => {
      try { return JSON.parse(readFileSync(join(BRIEFS_DIR, f), 'utf-8')) }
      catch { return null }
    })
    .filter(Boolean)
}

function calculateHealthTrend(briefs) {
  if (briefs.length < 2) return { direction: 'insufficient_data', delta: 0 }
  const scores = briefs
    .filter(b => b.avg_confidence)
    .map(b => b.avg_confidence)
  if (scores.length < 2) return { direction: 'insufficient_data', delta: 0 }
  const delta = Math.round(scores[scores.length - 1] - scores[0])
  return {
    direction: delta > 3 ? 'improving' : delta < -3 ? 'declining' : 'stable',
    delta,
    first: scores[0],
    last: scores[scores.length - 1],
  }
}

function analyzeCategoryTrends(briefs) {
  const categoryTotals = {}
  for (const brief of briefs) {
    for (const { category, count } of (brief.summary?.top_failure_categories || [])) {
      categoryTotals[category] = (categoryTotals[category] || 0) + count
    }
  }
  return Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category,
      total_failures: count,
      trend: 'stable', // TODO: compare first half vs second half of month
    }))
}

function generatePromptRecommendations(lessons, categoryTrends) {
  const recs = []
  const topCategory = categoryTrends[0]?.category
  if (topCategory) {
    const topLessons = lessons.filter(l => l.category === topCategory && l.solution)
      .sort((a, b) => b.build_count - a.build_count)
      .slice(0, 2)
    for (const lesson of topLessons) {
      recs.push(`Add to system prompt [${topCategory}]: "${lesson.solution.slice(0, 120)}"`)
    }
  }
  return recs
}

function extractMetaPatterns(lessons) {
  const withSolutions = lessons.filter(l => l.solution && l.build_count >= 3)
  return [
    {
      pattern: 'Recurring lessons that have solutions but are still occurring',
      count: withSolutions.length,
      implication: 'These solutions are not being applied automatically — consider adding to generation prompt',
    },
    {
      pattern: 'Lessons without solutions',
      count: lessons.filter(l => !l.solution).length,
      implication: 'These need manual investigation before they can be automated',
    },
  ]
}

function buildStrategicSummary(trend, topLessons, promptRecs) {
  const lines = []
  if (trend.direction === 'improving') {
    lines.push(`Quality is improving (+${trend.delta} points). The lesson system is working.`)
  } else if (trend.direction === 'declining') {
    lines.push(`Quality is declining (${trend.delta} points). Investigate the top failure categories.`)
  } else {
    lines.push('Quality is stable. Review prompt recommendations to push past plateau.')
  }
  lines.push(`Top ${topLessons.length} lessons have collectively prevented failures across ${topLessons.reduce((sum, l) => sum + l.build_count, 0)} builds.`)
  if (promptRecs.length > 0) {
    lines.push(`${promptRecs.length} prompt improvement recommendations ready for review.`)
  }
  return lines.join(' ')
}

function formatMonthlyReport(report) {
  return `# Sovereign Monthly Intelligence Report — ${report.month}

## Executive Summary

${report.strategic_summary}

**Period:** ${report.month}
**Weekly briefs analyzed:** ${report.weekly_briefs_analyzed}
**Total lessons in brain:** ${report.health_summary.total_lessons}
**Total patterns:** ${report.health_summary.total_patterns}
**Quality trend:** ${report.health_summary.quality_trend} (${report.health_summary.trend_delta > 0 ? '+' : ''}${report.health_summary.trend_delta} pts)

## Top 10 Lessons Preventing Failures

${report.top_lessons_preventing_failures.map((l, i) =>
  `**${i + 1}. [${l.category}] Prevented ${l.builds_prevented} build failures**
Problem: ${l.problem}
Solution: ${l.solution}
`).join('\n')}

## Category Trend Analysis

${report.category_trends.map(c =>
  `- **${c.category}**: ${c.total_failures} failures this month`
).join('\n')}

## Prompt Improvement Recommendations

${report.prompt_improvement_recommendations.map(r => `- ${r}`).join('\n') || '- None this month'}

## Meta-Patterns

${report.meta_patterns.map(m =>
  `**${m.pattern}:** ${m.count} — ${m.implication}`
).join('\n\n')}

---

*Generated by Sovereign Brain Cycle 3 — ${report.generated_at}*
`
}

main().catch(err => {
  console.error('[Brain Cycle 3] Fatal:', err.message)
  process.exit(1)
})
