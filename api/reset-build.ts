// api/reset-build.ts — Vercel Serverless Function
//
// POST /api/reset-build
// Body: { id: buildId }
//
// Resets a stalled build back to 'queued' so the user can re-enter the
// database choice flow without losing their build record.
// Clears: status → 'queued', error → null, step → null, supabase_token → null
//
// Called by Building.tsx when a Supabase provisioning error is shown and the
// user taps "Reconnect Supabase →".

import { checkRateLimit, getClientIp } from './_rateLimit.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Rate limit: 20 resets per hour per IP
    const ip = getClientIp(req)
    const rl = checkRateLimit(`reset-build:${ip}`, 20, 60 * 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
      res.status(429).json({ error: 'Too many requests. Try again later.' })
      return
    }

    let body: Record<string, string>
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }

    const { id: buildId } = body ?? {}
    if (!buildId) {
      res.status(400).json({ error: '`id` (buildId) is required' })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Supabase not configured' })
      return
    }

    console.log('[reset-build] resetting build to queued:', buildId)

    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey:         serviceKey,
          Authorization:  `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer:         'return=representation',
        },
        body: JSON.stringify({
          status:         'queued',
          error:          null,
          step:           null,
          supabase_token: null,
          updated_at:     new Date().toISOString(),
        }),
      },
    )

    const patchBody = await patchRes.text()
    if (!patchRes.ok) {
      console.error('[reset-build] Supabase patch failed:', patchRes.status, patchBody)
      res.status(502).json({ error: 'Failed to reset build' })
      return
    }

    let rows: unknown[]
    try { rows = JSON.parse(patchBody) as unknown[] } catch { rows = [] }
    if (!Array.isArray(rows) || rows.length === 0) {
      console.error('[reset-build] PATCH matched 0 rows — buildId not found:', buildId)
      res.status(404).json({ error: 'Build not found' })
      return
    }

    console.log('[reset-build] build reset to queued successfully:', buildId)
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[reset-build] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
