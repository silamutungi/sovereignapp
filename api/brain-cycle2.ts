// api/brain-cycle2.ts — Vercel Serverless Function
//
// GET /api/brain-cycle2
// Weekly synthesis cron — runs every Monday at 00:00 UTC.
// Reads the Supabase lessons table, identifies recurring patterns,
// flags promotion candidates (build_count >= 5), and logs a brief.
//
// Protected by CRON_SECRET header (set in Vercel env vars).
// Rate limit: cron-only — 1 call per hour per IP as a safety net.

import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Auth: Vercel cron sends this header; manual triggers must include it too
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || req.headers['x-cron-secret'] !== cronSecret) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit(`brain-cycle2:${ip}`, 1, 60 * 60 * 1000)
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

    // ── Fetch all solved lessons ordered by build_count ───────────────────
    const allRes = await fetch(
      `${supabaseUrl}/rest/v1/lessons?solution=neq.&order=build_count.desc&select=id,category,problem,solution,build_count,applied_automatically,created_at`,
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

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // ── Weekly analysis ───────────────────────────────────────────────────
    const newThisWeek    = allLessons.filter(l => l.created_at >= weekAgo)
    const recurring      = allLessons.filter(l => l.build_count >= 3)
    const promoted       = allLessons.filter(l => l.applied_automatically)

    // Promotion candidates: recurring >= 5, has solution, not yet promoted
    const promotionCandidates = allLessons
      .filter(l => l.build_count >= 5 && l.solution && !l.applied_automatically)

    // Category breakdown
    const categoryCount: Record<string, number> = {}
    for (const l of allLessons) {
      categoryCount[l.category] = (categoryCount[l.category] || 0) + 1
    }
    const topCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }))

    // ── Mark promotion candidates as applied_automatically ────────────────
    // This signals to the generation pipeline that these are ready to inject
    if (promotionCandidates.length > 0) {
      const ids = promotionCandidates.map(l => `"${l.id}"`).join(',')
      await fetch(
        `${supabaseUrl}/rest/v1/lessons?id=in.(${ids})`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ applied_automatically: true }),
        },
      ).catch(e => console.warn('[brain-cycle2] patch failed (non-fatal):', e))
    }

    const brief = {
      date: now.toISOString().split('T')[0],
      generated_at: now.toISOString(),
      summary: {
        total_lessons: allLessons.length,
        new_this_week: newThisWeek.length,
        recurring_patterns: recurring.length,
        already_promoted: promoted.length,
        newly_promoted: promotionCandidates.length,
      },
      top_categories: topCategories,
      promotion_candidates: promotionCandidates.map(l => ({
        id: l.id,
        category: l.category,
        problem: l.problem,
        solution: l.solution,
        build_count: l.build_count,
      })),
      top_recurring: recurring.slice(0, 10).map(l => ({
        category: l.category,
        problem: l.problem,
        solution: l.solution,
        build_count: l.build_count,
        applied: l.applied_automatically,
      })),
    }

    console.log('[brain-cycle2] Weekly brief:', JSON.stringify(brief, null, 2))
    console.log(`[brain-cycle2] Promoted ${promotionCandidates.length} lessons to applied_automatically=true`)

    res.status(200).json(brief)
  } catch (err) {
    console.error('[brain-cycle2] unhandled error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
