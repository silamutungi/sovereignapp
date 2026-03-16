// api/start-build.ts — Vercel Serverless Function
//
// POST /api/start-build
// Body: { email, appName, idea, template? }
// Returns: { buildId }
//
// Creates a row in the `builds` table and returns its UUID.
// The build ID is threaded as `state` through both OAuth flows.
//
// Required Supabase SQL (run once in SQL editor):
//
//   CREATE TABLE builds (
//     id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//     email       text        NOT NULL,
//     app_name    text        NOT NULL,
//     idea        text        NOT NULL DEFAULT '',
//     template    text        NOT NULL DEFAULT 'react-vite-ts',
//     github_token text,
//     vercel_token text,
//     status      text        NOT NULL DEFAULT 'pending_github',
//     step        text,
//     repo_url    text,
//     deploy_url  text,
//     error       text,
//     created_at  timestamptz DEFAULT now(),
//     updated_at  timestamptz DEFAULT now()
//   );
//   ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
//   -- No anon policies — all access is via service role key server-side.
//
// Self-contained: no imports from src/ or server/.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
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

    const { email, appName, idea, template } = body ?? {}
    if (!email || !appName) {
      res.status(400).json({ error: '`email` and `appName` are required' })
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
        template: template ?? 'react-vite-ts',
        status: 'pending_github',
        step: 'Waiting for GitHub connection…',
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
