// api/health.ts — Vercel Serverless Function
//
// GET /api/health
// Returns: { status: 'ok', timestamp, version }
//
// Used by uptime monitors and CI smoke tests.
// Rate limit: 60 per minute per IP

import { checkRateLimit } from './_rateLimit.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any): void {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`health:${ip}`, 60, 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
    res.status(429).json({ error: `Too many requests. Retry after ${rl.retryAfter ?? 60}s.` })
    return
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
}
