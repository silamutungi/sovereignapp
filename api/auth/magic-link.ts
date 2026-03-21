// api/auth/magic-link.ts — Vercel Serverless Function
//
// POST /api/auth/magic-link
// Body: { email: string }
// Returns: { success: true } — always, to prevent email enumeration
//
// Rate limit: 3 requests per hour per IP

import { sendMagicLink } from '../_sendMagicLink.js'
import { checkRateLimit } from '../_rateLimit.js'

// SECURITY AUDIT
// - Rate limited: 3/hr per IP (prevents abuse)
// - Email enumeration safe: always returns 200
// - Input validated: email regex + type check
// - No secrets exposed in responses

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    'unknown'

  const rateLimitResult = checkRateLimit(`magic-link:${ip}`, 3, 60 * 60 * 1000)
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfter ?? 3600))
    res.status(429).json({
      error: `Too many requests. Try again in ${rateLimitResult.retryAfter ?? 3600}s.`,
    })
    return
  }

  const { email } = (req.body ?? {}) as Record<string, unknown>

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address' })
    return
  }

  try {
    await sendMagicLink(email.trim().toLowerCase())
    // Always return success — never confirm or deny whether an email exists
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('[magic-link] Error:', err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
