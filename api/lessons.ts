// api/lessons.ts — Vercel Serverless Function
//
// GET /api/lessons
// Returns all lessons where solution != '' ordered by build_count desc.
// Public endpoint — no auth required. Powers the future knowledge base page.

import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const maxDuration = 10

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Rate limit: 60 reads per minute per IP
    const ip = getClientIp(req)
    const rl = checkRateLimit(`lessons:${ip}`, 60, 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
      res.status(429).json({ error: 'Too many requests. Try again later.' })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Supabase not configured' })
      return
    }

    const category = (req.query?.category as string) ?? ''
    let url = `${supabaseUrl}/rest/v1/lessons?solution=neq.&order=build_count.desc,created_at.desc&select=id,category,source,problem,solution,applied_automatically,build_count,created_at`
    if (category) {
      url += `&category=eq.${encodeURIComponent(category)}`
    }

    const dbRes = await fetch(url, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    if (!dbRes.ok) {
      const body = await dbRes.text()
      console.error('[lessons] Supabase query failed:', dbRes.status, body)
      res.status(502).json({ error: 'Failed to query lessons' })
      return
    }

    const lessons = await dbRes.json()
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    res.status(200).json({ lessons })
  } catch (err) {
    console.error('[lessons] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
