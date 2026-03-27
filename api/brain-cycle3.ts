// api/brain-cycle3.ts — Vercel Serverless Function
//
// GET /api/brain-cycle3
// Monthly analysis cron — runs on the 1st of every month at 00:00 UTC.
// Reads the full lessons history, identifies meta-patterns, trend shifts,
// and outputs a monthly intelligence report.
//
// Protected by CRON_SECRET header (set in Vercel env vars).

import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || req.headers['x-cron-secret'] !== cronSecret) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit(`brain-cycle3:${ip}`, 1, 60 * 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
      res.status(429).json({ error: 'Too many requests' })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Supabase not configured' })
      return
    }

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

    const allRes = await fetch(
      `${supabaseUrl}/rest/v1/lessons?order=build_count.desc&select=id,category,problem,solution,build_count,applied_automatically,created_at`,
      { headers },
    )
    if (!allRes.ok) {
      res.status(502).json({ error: 'Failed to query lessons' })
      return
    }
    const allLessons = await allRes.json() as Array<{
      id: string
      category: string
      problem: string
      solution: string
      build_count: number
      applied_automatically: boolean
      created_at: string
    }>

    const now       = new Date()
    const monthAgo  = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000).toISOString()
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

    const thisMonth = allLessons.filter(l => l.created_at >= monthAgo)
    const lastMonth = allLessons.filter(l => l.created_at >= twoMonthsAgo && l.created_at < monthAgo)

    // Category trends — comparing this month vs last month
    const countByCategory = (lessons: typeof allLessons) => {
      const counts: Record<string, number> = {}
      for (const l of lessons) counts[l.category] = (counts[l.category] || 0) + 1
      return counts
    }
    const thisCounts = countByCategory(thisMonth)
    const lastCounts = countByCategory(lastMonth)

    const allCategories = Array.from(new Set([
      ...Object.keys(thisCounts),
      ...Object.keys(lastCounts),
    ]))
    const categoryTrends = allCategories.map(cat => ({
      category: cat,
      this_month: thisCounts[cat] || 0,
      last_month: lastCounts[cat] || 0,
      trend: (thisCounts[cat] || 0) > (lastCounts[cat] || 0) ? 'increasing' :
             (thisCounts[cat] || 0) < (lastCounts[cat] || 0) ? 'decreasing' : 'stable',
    })).sort((a, b) => b.this_month - a.this_month)

    // Meta-patterns: lessons with solutions still recurring (not yet in prompt)
    const stillRecurring = allLessons
      .filter(l => l.solution && l.build_count >= 5 && !l.applied_automatically)

    // Top 10 lessons preventing failures (highest build_count with solution)
    const topLessons = allLessons
      .filter(l => l.solution)
      .slice(0, 10)
      .map(l => ({
        category: l.category,
        problem: l.problem,
        solution: l.solution,
        build_count: l.build_count,
        applied: l.applied_automatically,
      }))

    const report = {
      period: now.toISOString().slice(0, 7), // YYYY-MM
      generated_at: now.toISOString(),
      summary: {
        total_lessons: allLessons.length,
        solved_lessons: allLessons.filter(l => l.solution).length,
        promoted_lessons: allLessons.filter(l => l.applied_automatically).length,
        new_this_month: thisMonth.length,
        new_last_month: lastMonth.length,
        volume_trend: thisMonth.length > lastMonth.length ? 'increasing' :
                      thisMonth.length < lastMonth.length ? 'decreasing' : 'stable',
      },
      category_trends: categoryTrends,
      meta_patterns: {
        // These lessons recur despite being known — not yet injected into generation
        still_recurring_unsolved: stillRecurring.map(l => ({
          category: l.category,
          problem: l.problem,
          solution: l.solution,
          build_count: l.build_count,
          recommendation: `Add to system prompt [${l.category}]: "${l.solution}"`,
        })),
      },
      top_lessons_preventing_failures: topLessons,
    }

    console.log('[brain-cycle3] Monthly report:', JSON.stringify(report, null, 2))

    res.status(200).json(report)
  } catch (err) {
    console.error('[brain-cycle3] unhandled error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
