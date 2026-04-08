// api/start-build.ts — Vercel Serverless Function
//
// POST /api/start-build
// Body: { email, appName, idea, files, supabaseSchema, setupInstructions }
// Returns: { buildId }
//
// Creates a row in the `builds` table and returns its UUID.
// The build ID is threaded as `state` through both OAuth flows.
//
// Required Supabase SQL (run in SQL editor before using this endpoint):
//
//   CREATE TABLE IF NOT EXISTS builds (
//     id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//     email             text        NOT NULL,
//     app_name          text        NOT NULL,
//     idea              text        NOT NULL DEFAULT '',
//     files             jsonb       DEFAULT NULL,
//     supabase_schema   text        DEFAULT NULL,
//     setup_instructions text       DEFAULT NULL,
//     github_token      text,
//     vercel_token      text,
//     status            text        NOT NULL DEFAULT 'pending_github',
//     step              text,
//     repo_url          text,
//     deploy_url        text,
//     error             text,
//     next_steps        jsonb       DEFAULT NULL,
//     created_at        timestamptz DEFAULT now(),
//     updated_at        timestamptz DEFAULT now(),
//     deleted_at        timestamptz DEFAULT NULL
//   );
//   ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
//   -- No anon policies — all access is via service role key server-side.
//
// Migration for existing builds tables (add new columns):
//   ALTER TABLE builds ADD COLUMN IF NOT EXISTS files jsonb DEFAULT NULL;
//   ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_schema text DEFAULT NULL;
//   ALTER TABLE builds ADD COLUMN IF NOT EXISTS setup_instructions text DEFAULT NULL;
//
// Self-contained: no imports from src/ or server/.

import { checkRateLimit } from './_rateLimit.js'

// Increase body limit — files array can be 100KB+ of React/TS source code
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`start-build:${ip}`, 20, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' })
      return
    }

    let body: Record<string, string>
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }

    const {
      email: rawEmail,
      appName,
      idea,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      files,
      supabaseSchema,
      setupInstructions,
      appCategory,
      competitors,
      parityFeatures,
      leapfrogFeatures,
      // CLI-only fields: when both tokens are present, skip OAuth and go straight to 'queued'
      github_token: githubToken,
      vercel_token: vercelToken,
      // Try mode: idea person path — skip OAuth, build on Visila infrastructure
      try_mode: tryModeRaw,
      brand_tokens: brandTokensRaw,
    } = body as Record<string, any> ?? {}
    const tryMode = tryModeRaw === true || tryModeRaw === 'true'
    if (!rawEmail || !appName) {
      res.status(400).json({ error: '`email` and `appName` are required' })
      return
    }
    const email = (rawEmail as string).trim().toLowerCase()

    // ── Rate limit: max 3 completed builds per email ───────────────────────
    // Internal testing emails — bypass rate limit
    const WHITELISTED_EMAILS = ['sila@visila.com', 'sila@juapath.com']

    // Note: completed builds have status = 'complete' in this codebase.
    const countRes = await fetch(
      `${supabaseUrl}/rest/v1/builds?email=eq.${encodeURIComponent(email)}&status=eq.complete&deleted_at=is.null&select=id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
      },
    )
    // Content-Range: 0-0/N  (or */N when range exceeds results)
    const contentRange = countRes.headers.get('content-range') ?? ''
    const countMatch = contentRange.match(/\/(\d+)$/)
    const completedBuilds = countMatch ? parseInt(countMatch[1], 10) : 0

    if (completedBuilds >= 3 && !WHITELISTED_EMAILS.includes(email)) {
      res.setHeader('Retry-After', '86400')
      res.status(429).json({
        error: 'rate_limited',
        message: 'You have used all 3 free builds. Upgrade to Pro for unlimited builds.',
        upgradeUrl: 'https://visila.com/#pricing',
      })
      return
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/builds`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email,
        app_name: appName,
        idea: idea ?? '',
        files: files ?? null,
        supabase_schema: supabaseSchema ?? null,
        setup_instructions: setupInstructions ?? null,
        app_category: appCategory ?? null,
        competitors: competitors ?? null,
        parity_features: parityFeatures ?? null,
        leapfrog_features: leapfrogFeatures ?? null,
        // CLI flow: tokens supplied directly → skip OAuth, go straight to queued
        ...(githubToken ? { github_token: githubToken } : {}),
        ...(vercelToken ? { vercel_token: vercelToken } : {}),
        // Try mode: skip OAuth, build on Visila infrastructure
        ...(tryMode ? { try_mode: true } : { try_mode: false }),
        ...(brandTokensRaw && typeof brandTokensRaw === 'object' ? { brand_tokens: brandTokensRaw } : {}),
        status: (githubToken && vercelToken) || tryMode ? 'queued' : 'pending_github',
        step: (githubToken && vercelToken) || tryMode ? 'Queued for build…' : 'Waiting for GitHub connection…',
      }),
    })

    if (!insertRes.ok) {
      const errText = await insertRes.text()
      console.error('[start-build] Supabase insert failed:', insertRes.status, errText)
      res.status(500).json({ error: `Failed to create build record: ${errText}` })
      return
    }

    const rows = await insertRes.json() as Array<{ id: string }>
    const buildId = rows[0]?.id
    if (!buildId) {
      res.status(500).json({ error: 'No build ID returned from Supabase' })
      return
    }

    res.status(200).json({ buildId })
  } catch (err) {
    console.error('[start-build] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
