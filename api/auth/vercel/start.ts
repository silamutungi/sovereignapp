// api/auth/vercel/start.ts — Vercel Serverless Function
//
// GET /api/auth/vercel/start?build_id=<uuid>&mode=claim
//
// Kicks off the Vercel integration OAuth flow for an existing build that
// is missing a vercel_token. Used by the claim flow in EditApp when a
// try-mode build needs user credentials before transfer.
//
// Vercel marketplace integrations use /integrations/<slug>/new, not an
// /oauth/authorize URL. The state carries `claim:<buildId>` so the
// callback knows to store the token without mutating build status and
// to return the user to /app/<buildId>/edit.

import { checkRateLimit, getClientIp } from '../../_rateLimit.js'

function siteBase(): string {
  if (process.env.VERCEL_ENV === 'production') return 'https://visila.com'
  if (process.env.VERCEL_ENV === 'preview') {
    return `https://${process.env.VERCEL_URL ?? 'visila.vercel.app'}`
  }
  return `http://localhost:${process.env.PORT ?? 5173}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`vercel-start:${ip}`, 20, 15 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
    res.status(429).send('Too many requests. Try again later.')
    return
  }

  const { build_id: buildId, mode } = (req.query ?? {}) as Record<string, string>
  if (!buildId || !UUID_RE.test(buildId)) {
    res.status(400).send('Missing or invalid build_id')
    return
  }

  const slug = process.env.VERCEL_INTEGRATION_SLUG
  if (!slug) {
    res.status(500).send('Server misconfiguration — missing VERCEL_INTEGRATION_SLUG')
    return
  }

  const state = mode === 'claim' ? `claim:${buildId}` : buildId
  const redirectUri = `${siteBase()}/api/auth/vercel/callback`
  const authorizeUrl =
    `https://vercel.com/integrations/${encodeURIComponent(slug)}/new` +
    `?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`

  res.writeHead(302, { Location: authorizeUrl })
  res.end()
}
