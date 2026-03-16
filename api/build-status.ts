// api/build-status.ts — Vercel Serverless Function
//
// GET /api/build-status?id=buildId
// Returns: { status, step, repoUrl, deployUrl, appName, error }
//
// Self-contained: no imports from src/ or server/.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { id: buildId } = (req.query ?? {}) as Record<string, string>
    if (!buildId) {
      res.status(400).json({ error: '`id` is required' })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Supabase not configured' })
      return
    }

    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}&select=status,step,app_name,repo_url,deploy_url,error`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      },
    )

    if (!dbRes.ok) {
      res.status(502).json({ error: 'Failed to query Supabase' })
      return
    }

    const rows = await dbRes.json() as Array<{
      status: string
      step: string | null
      app_name: string
      repo_url: string | null
      deploy_url: string | null
      error: string | null
    }>

    if (!rows.length) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    const row = rows[0]
    res.status(200).json({
      status:    row.status,
      step:      row.step,
      appName:   row.app_name,
      repoUrl:   row.repo_url,
      deployUrl: row.deploy_url,
      error:     row.error,
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
