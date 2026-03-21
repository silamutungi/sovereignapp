// api/dashboard/builds.ts — Vercel Serverless Function
//
// GET /api/dashboard/builds?email=<email>
// Returns: { builds: Build[] }
//
// Returns all builds for an authenticated user (identified by email from
// a verified magic link session). Excludes soft-deleted builds.
//
// Rate limit: 60 requests per minute per IP

import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '../_rateLimit.js'

// SECURITY AUDIT
// - Rate limited: 60/min per IP
// - Email validated server-side before querying
// - Only non-deleted builds returned (.is('deleted_at', null))
// - Service role key used (server-side only)

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    'unknown'

  const rateLimitResult = checkRateLimit(`dashboard:${ip}`, 60, 60 * 1000)
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfter ?? 60))
    res.status(429).json({ error: `Too many requests. Retry after ${rateLimitResult.retryAfter ?? 60}s.` })
    return
  }

  const { email } = req.query

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email' })
    return
  }

  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('builds')
      .select(`
        id,
        app_name,
        idea,
        status,
        deploy_url,
        repo_url,
        step,
        error,
        next_steps,
        created_at
      `)
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[dashboard/builds] Error:', error)
      res.status(500).json({ error: 'Failed to fetch builds' })
      return
    }

    res.status(200).json({ builds: data ?? [] })
  } catch (err) {
    console.error('[dashboard/builds] Error:', err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
}
