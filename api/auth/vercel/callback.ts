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

import { checkRateLimit, getClientIp } from '../../_rateLimit.js'

function siteBase(): string {
  if (process.env.VERCEL_ENV === 'production') return 'https://visila.com'
  if (process.env.VERCEL_ENV === 'preview') {
    return `https://${process.env.VERCEL_URL ?? 'visila.vercel.app'}`
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

    const { code, state: rawState, error: oauthError } = (req.query ?? {}) as Record<string, string>

    if (oauthError) {
      const base = siteBase()
      res.writeHead(302, { Location: `${base}/?oauth_error=vercel_denied` })
      res.end()
      return
    }

    if (!code || !rawState) {
      res.status(400).send('Missing required parameters: code, state')
      return
    }

    // Claim flow encodes state as `claim:<buildId>` so this callback knows
    // not to mutate build status and to return the user to the edit page.
    const isClaimMode = rawState.startsWith('claim:')
    const buildId = isClaimMode ? rawState.slice('claim:'.length) : rawState
    if (!buildId) {
      res.status(400).send('Missing buildId in state')
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

    // ── 2. Store Vercel token ──────────────────────────────────────────────
    // In claim mode we only persist the token — the build is already complete,
    // so we must not mutate status/step.
    const patchBody: Record<string, unknown> = {
      vercel_token: tokenData.access_token,
      updated_at: new Date().toISOString(),
    }
    if (!isClaimMode) {
      patchBody.status = 'queued'
      patchBody.step   = 'Accounts connected. Starting build…'
    }

    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchBody),
      },
    )

    if (!patchRes.ok) {
      console.error('[vercel/callback] Supabase patch failed:', patchRes.status, await patchRes.text())
      res.status(500).send('Failed to store Vercel token')
      return
    }

    // ── 3. Redirect ────────────────────────────────────────────────────────
    // Claim mode → return to the edit page so the claim can be retried.
    // Normal mode → continue to the build progress page.
    const base = siteBase()
    const location = isClaimMode
      ? `${base}/app/${encodeURIComponent(buildId)}/edit?claim=vercel_connected`
      : `${base}/building?id=${encodeURIComponent(buildId)}`
    res.writeHead(302, { Location: location })
    res.end()
  } catch (err) {
    console.error('[vercel/callback] unhandled exception:', err)
    res.status(500).send(`Internal error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
