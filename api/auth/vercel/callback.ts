// api/auth/vercel/callback.ts — Vercel Serverless Function
//
// GET /api/auth/vercel/callback?code=...&state=buildId
//
// Step 2 of 2 in the OAuth provisioning loop:
//   1. Exchange Vercel code for an access token.
//   2. Store the token and set status → 'queued'.
//   3. Redirect the user to /building?id=buildId where the build runs.
//
// Self-contained: no imports from src/ or server/.

import { checkRateLimit, getClientIp } from '../../_rateLimit'

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
    const rl = checkRateLimit(`vercel-cb:${ip}`, 20, 15 * 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
      res.status(429).send('Too many requests. Try again later.')
      return
    }

    const { code, state: buildId, error: oauthError } = (req.query ?? {}) as Record<string, string>

    if (oauthError) {
      const base = siteBase()
      res.writeHead(302, { Location: `${base}/?oauth_error=vercel_denied` })
      res.end()
      return
    }

    if (!code || !buildId) {
      res.status(400).send('Missing required parameters: code, state')
      return
    }

    const clientId     = process.env.VERCEL_CLIENT_ID
    const clientSecret = process.env.VERCEL_CLIENT_SECRET
    const supabaseUrl  = process.env.SUPABASE_URL
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
      res.status(500).send('Server misconfiguration — missing environment variable')
      return
    }

    // ── 1. Exchange Vercel code for access token ───────────────────────────
    // Vercel uses application/x-www-form-urlencoded for the token endpoint
    const redirectUri = `${siteBase()}/api/auth/vercel/callback`
    const tokenRes = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  redirectUri,
      }).toString(),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      token_type?: string
      team_id?: string
      user_id?: string
      scope?: string
      error?: string
      error_description?: string
    }

    // Log everything except the actual token value — reveals scopes/team context
    console.log('[vercel/callback] token exchange status:', tokenRes.status)
    console.log('[vercel/callback] token response (redacted):', JSON.stringify({
      ...tokenData,
      access_token: tokenData.access_token ? '[REDACTED]' : undefined,
    }))

    if (!tokenData.access_token) {
      const msg = tokenData.error_description ?? tokenData.error ?? 'unknown'
      console.error('[vercel/callback] token exchange failed:', msg)
      res.status(400).send(`Vercel token exchange failed: ${msg}`)
      return
    }

    // ── 2. Store Vercel token and mark as queued ───────────────────────────
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vercel_token: tokenData.access_token,
          status: 'queued',
          step: 'Accounts connected. Starting build…',
          updated_at: new Date().toISOString(),
        }),
      },
    )

    if (!patchRes.ok) {
      console.error('[vercel/callback] Supabase patch failed:', patchRes.status, await patchRes.text())
      res.status(500).send('Failed to store Vercel token')
      return
    }

    // ── 3. Redirect to the /building progress page ─────────────────────────
    const base = siteBase()
    res.writeHead(302, { Location: `${base}/building?id=${encodeURIComponent(buildId)}` })
    res.end()
  } catch (err) {
    console.error('[vercel/callback] unhandled exception:', err)
    res.status(500).send(`Internal error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
