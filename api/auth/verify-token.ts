// api/auth/verify-token.ts — Vercel Serverless Function
//
// GET /api/auth/verify-token?token=<token>
// Returns: { email: string } on success
//
// Validates token: exists, not used, not expired, not soft-deleted.
// Marks token as used on success (one-time use).
//
// Rate limit: 10 requests per hour per IP

import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '../_rateLimit'

// SECURITY AUDIT
// - Rate limited: 10/hr per IP
// - Token: 64-char random hex (256-bit entropy)
// - One-time use enforced server-side
// - 24-hour expiry enforced server-side
// - Soft-delete aware (.is('deleted_at', null))

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

  const rateLimitResult = checkRateLimit(
    `verify-token:${ip}`,
    10,
    60 * 60 * 1000,
  )
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfter ?? 3600))
    res.status(429).json({ error: `Too many attempts. Retry after ${rateLimitResult.retryAfter ?? 3600}s.` })
    return
  }

  const { token } = req.query

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'No token provided' })
    return
  }

  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      res.status(401).json({ error: 'Invalid link' })
      return
    }

    if (data.used) {
      res.status(401).json({
        error: 'This link has already been used. Request a new one.',
      })
      return
    }

    if (new Date(data.expires_at) < new Date()) {
      res.status(401).json({
        error: 'This link has expired. Request a new one.',
      })
      return
    }

    // Mark as used (one-time only)
    await supabase
      .from('magic_links')
      .update({ used: true })
      .eq('token', token)

    res.status(200).json({ email: data.email })
  } catch (err) {
    console.error('[verify-token] Error:', err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
