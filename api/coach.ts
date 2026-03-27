// api/coach.ts — Vercel Serverless Function
//
// GET /api/coach?buildId=X
// Returns active coaching interventions and brain-derived recommendations
// for a specific build. Powers the always-present coaching section in the dashboard.
//
// The coach is always present — not just at build time. It observes the
// build's lifecycle and surfaces the right guidance at the right moment.
//
// Interventions are time-based:
//   LAUNCH      < 2h after deploy   — share immediately
//   FIRST_DAY   20–28h after deploy — act on first feedback
//   FIRST_WEEK  6–8 days after deploy — ship first improvement
//   NO_ACTIVITY 14+ days with no updates — resume momentum
//
// Rate limit: 30 per hour per IP
// Cache: 5 minutes

import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const maxDuration = 10

interface Intervention {
  type: 'LAUNCH' | 'FIRST_DAY' | 'FIRST_WEEK' | 'NO_ACTIVITY'
  priority: 'high' | 'medium' | 'low'
  message: string
  cta: string
}

interface Recommendation {
  category: string
  title: string
  solution: string
  build_count: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit(`coach:${ip}`, 30, 60 * 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
      res.status(429).json({ error: 'Too many requests' })
      return
    }

    const buildId = (req.query?.buildId as string) ?? ''
    if (!buildId) {
      res.status(400).json({ error: '`buildId` is required' })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Supabase not configured' })
      return
    }

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

    // Fetch build and top lessons in parallel
    const [buildRes, lessonsRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}&deleted_at=is.null&select=id,app_name,created_at,updated_at,status,next_steps,idea,confidence_score,launch_gate_passed`,
        { headers },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/lessons?solution=neq.&build_count=gte.3&order=build_count.desc&select=category,problem,solution,build_count&limit=5`,
        { headers },
      ),
    ])

    if (!buildRes.ok) {
      res.status(502).json({ error: 'Failed to query build' })
      return
    }

    const builds = await buildRes.json() as Array<{
      id: string
      app_name: string
      created_at: string
      updated_at: string | null
      status: string
      next_steps: Array<{ title: string; description: string; action: string; priority: string }> | null
      idea: string
      confidence_score: number | null
      launch_gate_passed: boolean | null
    }>

    if (!builds.length) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    const build = builds[0]

    // Only coach on completed builds
    if (build.status !== 'complete') {
      res.status(200).json({ interventions: [], recommendations: [], nextSteps: [], confidenceScore: null })
      return
    }

    // ── Time-based interventions ──────────────────────────────────────────
    const deployedAt  = new Date(build.created_at).getTime()
    const lastUpdated = build.updated_at ? new Date(build.updated_at).getTime() : deployedAt
    const now         = Date.now()
    const hoursSinceDeploy  = (now - deployedAt)  / (1000 * 60 * 60)
    const daysSinceUpdate   = (now - lastUpdated)  / (1000 * 60 * 60 * 24)

    const interventions: Intervention[] = []

    // ── LOW_SCORE intervention (highest priority — overrides time-based) ──
    if (build.confidence_score !== null && build.confidence_score < 70) {
      interventions.push({
        type: 'LAUNCH',
        priority: 'high',
        message: `${build.app_name} scored ${build.confidence_score}/100 on the Sovereign Standards. There are quality issues to fix before sharing widely — open the chat and ask "what should I improve first?"`,
        cta: 'View issues',
      })
    } else if (hoursSinceDeploy < 2) {
      interventions.push({
        type: 'LAUNCH',
        priority: 'high',
        message: `${build.app_name} just went live. Share it with 5 people before you change a single line — real feedback now is worth more than any improvement you can imagine.`,
        cta: 'Copy link to share',
      })
    } else if (hoursSinceDeploy >= 20 && hoursSinceDeploy < 28) {
      interventions.push({
        type: 'FIRST_DAY',
        priority: 'high',
        message: `You've had ${build.app_name} live for almost a day. What's the feedback telling you? The most important thing to do now is act on it — not polish what you have.`,
        cta: 'Make a change',
      })
    } else if (hoursSinceDeploy >= 6 * 24 && hoursSinceDeploy < 8 * 24) {
      interventions.push({
        type: 'FIRST_WEEK',
        priority: 'medium',
        message: `One week with ${build.app_name}. Time to ship your first real improvement — not a big rewrite, just the one thing users keep asking for.`,
        cta: 'Edit your app',
      })
    } else if (daysSinceUpdate >= 14) {
      interventions.push({
        type: 'NO_ACTIVITY',
        priority: 'low',
        message: `${build.app_name} hasn't been updated in ${Math.floor(daysSinceUpdate)} days. Small improvements compound. What's the one thing you'd fix if it took 10 minutes?`,
        cta: 'Make a quick edit',
      })
    }

    // ── Brain-derived recommendations ─────────────────────────────────────
    const recommendations: Recommendation[] = []
    if (lessonsRes.ok) {
      const lessons = await lessonsRes.json() as Array<{
        category: string
        problem: string
        solution: string
        build_count: number
      }>
      for (const l of lessons) {
        recommendations.push({
          category: l.category,
          title: l.problem,
          solution: l.solution,
          build_count: l.build_count,
        })
      }
    }

    const nextSteps = Array.isArray(build.next_steps) ? build.next_steps : []

    res.setHeader('Cache-Control', 'private, max-age=300')
    res.status(200).json({
      interventions,
      recommendations,
      nextSteps,
      confidenceScore: build.confidence_score,
      launchGatePassed: build.launch_gate_passed,
    })
  } catch (err) {
    console.error('[coach] unhandled error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
