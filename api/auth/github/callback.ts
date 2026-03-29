// api/auth/github/callback.ts — Vercel Serverless Function
//
// GET /api/auth/github/callback?code=...&state=buildId
//
// Step 1 of 2 in the OAuth provisioning loop:
//   1. Exchange GitHub code for an access token.
//   2. Store the token against the build record in Supabase.
//   3. Redirect the user to Vercel OAuth (step 2), carrying the same buildId.
//
// Self-contained: no imports from src/ or server/.

import { checkRateLimit, getClientIp } from '../../_rateLimit.js'

function siteBase(): string {
  // VERCEL_ENV is set by the Vercel runtime. Absent in local dev.
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
    const rl = checkRateLimit(`github-cb:${ip}`, 20, 15 * 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
      res.status(429).send('Too many requests. Try again later.')
      return
    }

    const { code, state: buildId, error: oauthError } = (req.query ?? {}) as Record<string, string>

    // GitHub redirects here with ?error= if the user denied access
    if (oauthError) {
      const base = siteBase()
      res.writeHead(302, { Location: `${base}/?oauth_error=github_denied` })
      res.end()
      return
    }

    if (!code || !buildId) {
      res.status(400).send('Missing required parameters: code, state')
      return
    }

    const clientId           = process.env.GITHUB_CLIENT_ID
    const clientSecret       = process.env.GITHUB_CLIENT_SECRET
    const supabaseUrl        = process.env.SUPABASE_URL
    const serviceKey         = process.env.SUPABASE_SERVICE_ROLE_KEY
    // VERCEL_INTEGRATION_SLUG is the slug from the Vercel marketplace listing,
    // e.g. "sovereign-app". Used in the /integrations/<slug>/new authorization
    // URL. The oac_* client ID is only needed server-side for token exchange.
    const vercelIntegrationSlug = process.env.VERCEL_INTEGRATION_SLUG

    if (!clientId || !clientSecret || !supabaseUrl || !serviceKey || !vercelIntegrationSlug) {
      res.status(500).send('Server misconfiguration — missing environment variable')
      return
    }

    // ── 1. Exchange GitHub code for access token ───────────────────────────
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  `${siteBase()}/api/auth/github/callback`,
      }),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      error?: string
      error_description?: string
    }

    if (!tokenData.access_token) {
      const msg = tokenData.error_description ?? tokenData.error ?? 'unknown'
      console.error('[github/callback] token exchange failed:', msg)
      res.status(400).send(`GitHub token exchange failed: ${msg}`)
      return
    }

    // ── 2. Store GitHub token in Supabase build record ─────────────────────
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
          github_token: tokenData.access_token,
          status: 'pending_vercel',
          step: 'Waiting for Vercel connection…',
          updated_at: new Date().toISOString(),
        }),
      },
    )

    if (!patchRes.ok) {
      console.error('[github/callback] Supabase patch failed:', patchRes.status, await patchRes.text())
      res.status(500).send('Failed to store GitHub token')
      return
    }

    // ── 3. Redirect to Vercel integration authorization ───────────────────
    // Vercel marketplace integrations use /integrations/<slug>/new, NOT
    // /oauth/authorize?client_id=. The oac_* client ID only appears
    // server-side during the token exchange in /api/auth/vercel/callback.
    const vercelRedirectUri = `${siteBase()}/api/auth/vercel/callback`
    const vercelOAuthUrl =
      `https://vercel.com/integrations/${encodeURIComponent(vercelIntegrationSlug)}/new` +
      `?redirect_uri=${encodeURIComponent(vercelRedirectUri)}` +
      `&state=${encodeURIComponent(buildId)}`

    res.writeHead(302, { Location: vercelOAuthUrl })
    res.end()
  } catch (err) {
    console.error('[github/callback] unhandled exception:', err)
    res.status(500).send(`Internal error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
