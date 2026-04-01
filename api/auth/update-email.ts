// api/auth/update-email.ts — Vercel Serverless Function
//
// POST /api/auth/update-email
// Body: { token: string, newEmail: string }
// Returns: { success: true } on success
//
// Flow: validates magic link token → updates email on magic_links rows →
// invalidates all tokens for old email → sends new magic link to newEmail.
//
// Rate limit: 3 requests per hour per IP

import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '../_rateLimit.js'
import { sendMagicLink } from '../_sendMagicLink.js'

// SECURITY AUDIT
// - Rate limited: 3/hr per IP
// - Token validated: exists, not used, not expired, not soft-deleted
// - One-time use: token marked used after validation
// - Old tokens invalidated: all magic_links for old email soft-deleted
// - New magic link sent to newEmail for re-authentication
// - No email enumeration: always returns success if token is valid

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)

  const rl = checkRateLimit(`update-email:${ip}`, 3, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({
      error: `Too many requests. Try again in ${rl.retryAfter ?? 3600}s.`,
    })
    return
  }

  const { token, newEmail } = (req.body ?? {}) as Record<string, unknown>

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token is required' })
    return
  }

  if (!newEmail || typeof newEmail !== 'string') {
    res.status(400).json({ error: 'New email is required' })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const trimmedEmail = newEmail.trim().toLowerCase()
  if (!emailRegex.test(trimmedEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address' })
    return
  }

  try {
    const supabase = getSupabase()

    // ── Step 1: Validate the token ──────────────────────────────────────────
    const { data, error } = await supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      res.status(401).json({ error: 'Invalid or expired link' })
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

    const oldEmail = data.email as string

    if (oldEmail === trimmedEmail) {
      res.status(400).json({ error: 'New email must be different from current email' })
      return
    }

    // ── Step 2: Mark this token as used ─────────────────────────────────────
    await supabase
      .from('magic_links')
      .update({ used: true })
      .eq('token', token)

    // ── Step 3: Invalidate all existing tokens for the old email ────────────
    await supabase
      .from('magic_links')
      .update({ deleted_at: new Date().toISOString() })
      .eq('email', oldEmail)
      .is('deleted_at', null)

    // ── Step 4: Update email on builds table (if applicable) ────────────────
    await supabase
      .from('builds')
      .update({ email: trimmedEmail })
      .eq('email', oldEmail)
      .is('deleted_at', null)

    // ── Step 5: Send a new magic link to the new email ──────────────────────
    await sendMagicLink(trimmedEmail)

    console.log('[update-email] Email updated from', oldEmail, 'to', trimmedEmail)

    res.status(200).json({ success: true })
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any
    console.error('[update-email] Error:', e?.message, e?.code)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
