// api/poll-spec.ts — Vercel Serverless Function
//
// GET /api/poll-spec?id=<pending_build_id>
// Returns: { ready: false } or { ready: true, spec: {...} } or { ready: false, error: '...' }
//
// Polling endpoint for the decoupled generation architecture.
// Browser polls this every 5-8s while generation runs server-side.
// Rate limit: 120/hr per IP (polling every 5s for 10min = ~120 calls)

import { checkRateLimit } from './_rateLimit.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`poll-spec:${ip}`, 120, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
    res.status(429).json({ error: 'Rate limited' })
    return
  }

  const id = req.query?.id as string | undefined
  if (!id) {
    res.status(400).json({ error: 'Missing id parameter' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Database not configured' })
    return
  }

  try {
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/pending_specs?id=eq.${encodeURIComponent(id)}&select=spec,status,error`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      },
    )

    if (!dbRes.ok) {
      res.status(200).json({ ready: false })
      return
    }

    const rows = await dbRes.json() as Array<{
      spec: unknown
      status: string
      error: string | null
    }>

    if (!rows.length) {
      res.status(200).json({ ready: false })
      return
    }

    const row = rows[0]

    if (row.status === 'error') {
      res.status(200).json({ ready: false, error: row.error ?? 'Generation failed.' })
      return
    }

    if (row.status === 'done' && row.spec) {
      res.status(200).json({ ready: true, spec: row.spec })
      return
    }

    // Still generating
    res.status(200).json({ ready: false })
  } catch (err) {
    console.error('[poll-spec] Error:', err)
    res.status(200).json({ ready: false })
  }
}
