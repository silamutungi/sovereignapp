#!/usr/bin/env node
// brain/cycle2-weekly.js — Weekly synthesis cycle
// Run every Monday at 00:00. Identifies recurring patterns and failure modes.

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as BrainAPI from './brain-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BRIEFS_DIR = join(__dirname, 'weekly-briefs')

async function main() {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  console.log(`[Brain Cycle 2] Weekly synthesis — ${dateStr}`)

  // Get all lessons from the past 7 days
  const allLessons = BrainAPI.getLessons({})
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recentLessons = allLessons.filter(l => l.created_at >= weekAgo)

  console.log(`[Brain Cycle 2] Analyzing ${allLessons.length} total lessons, ${recentLessons.length} from past 7 days`)

  // Find recurring patterns (build_count >= 3)
  const recurring = allLessons.filter(l => l.build_count >= 3)
    .sort((a, b) => b.build_count - a.build_count)

  // Top failure categories this week
  const categoryCount = {}
  for (const lesson of recentLessons) {
    categoryCount[lesson.category] = (categoryCount[lesson.category] || 0) + 1
  }
  const topFailures = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, count]) => ({ category: cat, count }))

  // Patterns to promote (recurring >= 5 with solutions)
  const promotionCandidates = recurring
    .filter(l => l.solution && l.build_count >= 5)
    .slice(0, 3)

  // Patterns to retire (not seen in 30+ days)
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const stalePatterns = BrainAPI.getPatterns({})
    .filter(p => p.updated_at < monthAgo && p.usage_count < 2)

  // Get insights
  const insights = BrainAPI.getInsights()

  // Build the weekly brief
  const brief = {
    date: dateStr,
    generated_at: now.toISOString(),
    period: { from: weekAgo, to: now.toISOString() },
    summary: {
      total_lessons: allLessons.length,
      new_this_week: recentLessons.length,
      recurring_lessons: recurring.length,
      top_failure_categories: topFailures,
    },
    recurring_lessons: recurring.slice(0, 10).map(l => ({
      problem: l.problem.slice(0, 120),
      category: l.category,
      build_count: l.build_count,
      has_solution: !!l.solution,
    })),
    promotion_candidates: promotionCandidates.map(l => ({
      lesson_id: l.id,
      problem: l.problem.slice(0, 120),
      solution: l.solution.slice(0, 200),
      build_count: l.build_count,
      recommendation: 'Promote to system prompt',
    })),
    stale_patterns: stalePatterns.map(p => ({ name: p.name, last_used: p.updated_at })),
    quality_trend: insights.trend || 'insufficient_data',
    avg_confidence: insights.average_confidence_score,
    recommendations: generateWeeklyRecommendations(topFailures, recurring, promotionCandidates),
  }

  // Save the brief
  if (!existsSync(BRIEFS_DIR)) mkdirSync(BRIEFS_DIR, { recursive: true })
  const briefPath = join(BRIEFS_DIR, `${dateStr}.json`)
  writeFileSync(briefPath, JSON.stringify(brief, null, 2))

  // Also save as markdown
  const mdPath = join(BRIEFS_DIR, `${dateStr}.md`)
  writeFileSync(mdPath, formatBriefMarkdown(brief))

  console.log(`[Brain Cycle 2] Brief saved to ${briefPath}`)
  console.log(`[Brain Cycle 2] Top failures: ${topFailures.map(f => `${f.category}(${f.count})`).join(', ')}`)
  console.log(`[Brain Cycle 2] ${promotionCandidates.length} lessons ready for system prompt promotion`)

  return brief
}

function generateWeeklyRecommendations(topFailures, recurring, promotions) {
  const recs = []

  if (topFailures[0]) {
    recs.push(`Most failures in '${topFailures[0].category}' — consider adding an auto-fix for this category`)
  }
  if (recurring.length > 10) {
    recs.push(`${recurring.length} recurring lessons — build automated detection for the top 3`)
  }
  if (promotions.length > 0) {
    recs.push(`${promotions.length} lessons ready to promote to system prompt — review and add next session`)
  }

  return recs
}

function formatBriefMarkdown(brief) {
  const lines = [
    `# Sovereign Weekly Intelligence Brief — ${brief.date}`,
    '',
    '## Summary',
    `- **Total lessons in brain:** ${brief.summary.total_lessons}`,
    `- **New this week:** ${brief.summary.new_this_week}`,
    `- **Recurring (3+ builds):** ${brief.summary.recurring_lessons}`,
    `- **Quality trend:** ${brief.quality_trend}`,
    `- **Avg confidence score:** ${brief.avg_confidence ? Math.round(brief.avg_confidence) : 'N/A'}`,
    '',
    '## Top Failure Categories This Week',
    ...brief.summary.top_failure_categories.map(f => `- ${f.category}: ${f.count} occurrences`),
    '',
    '## Recurring Lessons (3+ builds)',
    ...brief.recurring_lessons.map(l => `- **[${l.category}]** ${l.problem} (${l.build_count} builds)`),
    '',
    '## Promotion Candidates',
    brief.promotion_candidates.length === 0 ? '- None this week' : '',
    ...brief.promotion_candidates.map(l => `- ${l.problem.slice(0, 100)} — *${l.recommendation}*`),
    '',
    '## Recommendations',
    ...brief.recommendations.map(r => `- ${r}`),
    '',
    `---`,
    `*Generated by Sovereign Brain Cycle 2 — ${brief.generated_at}*`,
  ]

  return lines.join('\n')
}

main().catch(err => {
  console.error('[Brain Cycle 2] Fatal:', err.message)
  process.exit(1)
})
