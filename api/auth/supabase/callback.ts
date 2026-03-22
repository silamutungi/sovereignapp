// api/auth/supabase/callback.ts — Vercel Serverless Function
//
// GET /api/auth/supabase/callback?code=...&state=buildId
//
// Step 3 of 3 in the OAuth provisioning loop:
//   1. Exchange Supabase code for an access token.
//   2. Store the token against the build record in Supabase.
//   3. Redirect the user to /building?id=buildId where the build runs.
//
// Self-contained: no imports from src/ or server/.

import { checkRateLimit, getClientIp } from '../../_rateLimit.js'

function siteBase(): string {
  if (process.env.VERCEL_ENV === 'production') return 'https://sovereignapp.dev'
  if (process.env.VERCEL_ENV === 'preview') {
    return `https://${process.env.VERCEL_URL ?? 'sovereignapp.vercel.app'}`
  }
  return `http://localhost:${process.env.PORT ?? 5173}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    // Rate limit: 20 per 15 minutes per IP
    const ip = getClientIp(req)
    const rl = checkRateLimit(`supabase-cb:${ip}`, 20, 15 * 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
      res.status(429).send('Too many requests. Try again later.')
      return
    }

    const { code, state: buildId, error: oauthError } = (req.query ?? {}) as Record<string, string>

    if (oauthError) {
      const base = siteBase()
      res.writeHead(302, { Location: `${base}/building?id=${encodeURIComponent(buildId ?? '')}&oauth_error=supabase_denied` })
      res.end()
      return
    }

    if (!code || !buildId) {
      res.status(400).send('Missing required parameters: code, state')
      return
    }

    const clientId     = process.env.SUPABASE_OAUTH_CLIENT_ID
    const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET
    const supabaseUrl  = process.env.SUPABASE_URL
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
      res.status(500).send('Server misconfiguration — missing environment variable')
      return
    }

    // ── 1. Exchange Supabase code for access token ─────────────────────────
    const redirectUri = `${siteBase()}/api/auth/supabase/callback`
    const tokenRes = await fetch('https://api.supabase.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  redirectUri,
      }).toString(),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      refresh_token?: string
      token_type?: string
      error?: string
      error_description?: string
    }

    console.log('[supabase/callback] token exchange status:', tokenRes.status)
    console.log('[supabase/callback] token response (redacted):', JSON.stringify({
      ...tokenData,
      access_token:  tokenData.access_token  ? '[REDACTED]' : undefined,
      refresh_token: tokenData.refresh_token ? '[REDACTED]' : undefined,
    }))

    if (!tokenData.access_token) {
      const msg = tokenData.error_description ?? tokenData.error ?? 'unknown'
      console.error('[supabase/callback] token exchange failed:', msg)
      res.status(400).send(`Supabase token exchange failed: ${msg}`)
      return
    }

    // ── 2. Store Supabase token in the build record ────────────────────────
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey:          serviceKey,
          Authorization:   `Bearer ${serviceKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          supabase_token: tokenData.access_token,
          updated_at: new Date().toISOString(),
        }),
      },
    )

    if (!patchRes.ok) {
      console.error('[supabase/callback] Supabase patch failed:', patchRes.status, await patchRes.text())
      res.status(500).send('Failed to store Supabase token')
      return
    }

    // ── 3. Redirect back to the building page ──────────────────────────────
    const base = siteBase()
    res.writeHead(302, { Location: `${base}/building?id=${encodeURIComponent(buildId)}` })
    res.end()
  } catch (err) {
    console.error('[supabase/callback] unhandled exception:', err)
    res.status(500).send(`Internal error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
